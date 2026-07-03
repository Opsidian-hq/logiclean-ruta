/**
 * Logiclean Ruta — Carga y devolución a bodega (Inc 6.4, H-18/H-19)
 *
 * Compone, en un solo lote local + cola:
 *  - CARGA_VEHICULO / CARGA_LINEA — bodega baja, vehículo sube (H-18)
 *  - DEVOLUCION_BODEGA / DEVOLUCION_LINEA — vehículo baja, bodega sube (H-19)
 *
 * Los contadores (inventario_bodega_presentacion, inventario_vehiculo) se
 * materializan del lado servidor por los triggers de la migración 007 (Inc
 * 6.1) — aquí solo se registran los eventos.
 *
 * La carga es el único punto de la cadena de bodega que se asume online
 * (nota de operación, modelo-datos-inc6): por eso `registrarCarga` valida la
 * cantidad contra el disponible de bodega ya hidratado localmente antes de
 * escribir (H-18: "si no hay stock suficiente, el sistema lo impide"). Es una
 * advertencia de UX, no una garantía transaccional — el contador real vive en
 * el servidor y, si de cualquier forma quedara negativo, es la señal de
 * sobreventa documentada (vista `alerta_sobreventa_bodega`), no un error.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { CargaVehiculo, CargaLinea, DevolucionBodega, DevolucionLinea } from '../db/schema';

export interface LineaCantidadInput {
  presentacionId: string;
  cantidad: number;
}

function validarLineas(lineas: LineaCantidadInput[]): void {
  if (lineas.length === 0) {
    throw new Error('Agrega al menos una línea.');
  }
  if (lineas.some((l) => !l.presentacionId || !(l.cantidad > 0))) {
    throw new Error('Cada línea necesita una presentación y una cantidad mayor que 0.');
  }
}

// ── Carga (bodega → vehículo, H-18) ────────────────────────────

export interface RegistrarCargaInput {
  vendedorId: string;
  responsableId: string;
  lineas: LineaCantidadInput[];
  /** Disponible en bodega por presentación, para no cargar "de la nada". */
  disponibleBodega: Map<string, number>;
  fecha?: string;
  nota?: string;
}

export interface RegistrarCargaResult {
  carga: CargaVehiculo;
  lineas: CargaLinea[];
}

export async function registrarCarga(
  input: RegistrarCargaInput
): Promise<RegistrarCargaResult> {
  const {
    vendedorId,
    responsableId,
    lineas: lineasInput,
    disponibleBodega,
    fecha = new Date().toISOString().slice(0, 10),
    nota,
  } = input;

  if (!vendedorId) throw new Error('Falta el vendedor.');
  if (!responsableId) throw new Error('Falta el responsable.');
  validarLineas(lineasInput);

  for (const l of lineasInput) {
    const disponible = disponibleBodega.get(l.presentacionId) ?? 0;
    if (l.cantidad > disponible) {
      throw new Error(
        `No hay suficiente en bodega (disponible: ${disponible}, solicitado: ${l.cantidad}).`
      );
    }
  }

  const cargaId = generateUUID();
  const carga: CargaVehiculo = {
    id: cargaId,
    vendedor_id: vendedorId,
    fecha,
    responsable_id: responsableId,
    nota,
  };
  await persist('carga_vehiculo', carga);

  const lineas: CargaLinea[] = [];
  for (const l of lineasInput) {
    const linea: CargaLinea = {
      id: generateUUID(),
      carga_id: cargaId,
      presentacion_id: l.presentacionId,
      cantidad: l.cantidad,
    };
    await persist('carga_linea', linea);
    lineas.push(linea);
  }

  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { carga, lineas };
}

// ── Devolución (vehículo → bodega, H-19) ───────────────────────

export interface RegistrarDevolucionInput {
  vendedorId: string;
  responsableId: string;
  lineas: LineaCantidadInput[];
  fecha?: string;
  nota?: string;
}

export interface RegistrarDevolucionResult {
  devolucion: DevolucionBodega;
  lineas: DevolucionLinea[];
}

export async function registrarDevolucion(
  input: RegistrarDevolucionInput
): Promise<RegistrarDevolucionResult> {
  const {
    vendedorId,
    responsableId,
    lineas: lineasInput,
    fecha = new Date().toISOString().slice(0, 10),
    nota,
  } = input;

  if (!vendedorId) throw new Error('Falta el vendedor.');
  if (!responsableId) throw new Error('Falta el responsable.');
  validarLineas(lineasInput);

  const devolucionId = generateUUID();
  const devolucion: DevolucionBodega = {
    id: devolucionId,
    vendedor_id: vendedorId,
    fecha,
    responsable_id: responsableId,
    nota,
  };
  await persist('devolucion_bodega', devolucion);

  const lineas: DevolucionLinea[] = [];
  for (const l of lineasInput) {
    const linea: DevolucionLinea = {
      id: generateUUID(),
      devolucion_id: devolucionId,
      presentacion_id: l.presentacionId,
      cantidad: l.cantidad,
    };
    await persist('devolucion_linea', linea);
    lineas.push(linea);
  }

  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { devolucion, lineas };
}

// ── Persistencia local + cola (sin disparar sync por fila) ────

async function persist(
  table: 'carga_vehiculo' | 'carga_linea' | 'devolucion_bodega' | 'devolucion_linea',
  row: object
): Promise<void> {
  const raw = row as Record<string, unknown>;
  await db.table(table).put(raw);
  await enqueueOperation(table, 'upsert', raw);
}
