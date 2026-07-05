/**
 * Logiclean Ruta — Registro de envasado (Inc 6.3, H-17, ADR-0007)
 *
 * Compone, en una sola operación local e instantánea:
 *  - ENVASADO (litros_envasados: Σ cantidad × factor_conversion de las líneas)
 *  - ENVASADO_LINEA por cada presentación que salió
 *
 * El gerente ya no captura origen (bidón nuevo/granel), residuo ni consumo
 * de granel: solo elige las presentaciones que salieron. Los contadores de
 * bodega (bidones_disponibles, litros_granel_estimado, presentaciones) se
 * materializan del lado servidor por trigger (migración 010) — ese trigger
 * decide cuánto de litros_envasados salió de bidones sellados vs. de granel
 * ya abierto, usando producto_base.litros_por_bidon. Esta pantalla solo
 * registra el evento (ADR-0007, mismo patrón que `lib/ventas.ts` con
 * `inventario_vehiculo`, pero server-side por ser bodega compartida).
 *
 * `bidones_abiertos` se envía en 0: el trigger lo sobreescribe justo después
 * del INSERT (alimenta la identidad de control de ADR-0009 en
 * `lib/corte.ts`); el próximo `pull` trae el valor real de vuelta a Dexie.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import { calcularLitrosEnvasados } from './conversion';
import type { Envasado, EnvasadoLinea } from '../db/schema';

export interface EnvasadoLineaInput {
  presentacionId: string;
  cantidad: number;
}

export interface RegistrarEnvasadoInput {
  productoBaseId: string;
  lineas: EnvasadoLineaInput[];
  responsableId: string;
  /** ISO date (YYYY-MM-DD); por defecto hoy. */
  fecha?: string;
  nota?: string;
}

export interface RegistrarEnvasadoResult {
  envasado: Envasado;
  lineas: EnvasadoLinea[];
}

export async function registrarEnvasado(
  input: RegistrarEnvasadoInput
): Promise<RegistrarEnvasadoResult> {
  const {
    productoBaseId,
    lineas: lineasInput,
    responsableId,
    fecha = new Date().toISOString().slice(0, 10),
    nota,
  } = input;

  if (!productoBaseId) throw new Error('Falta el producto base.');
  if (!responsableId) throw new Error('Falta el responsable.');
  if (lineasInput.length === 0) {
    throw new Error('Agrega al menos una línea de presentación envasada.');
  }
  if (lineasInput.some((l) => !l.presentacionId || !(l.cantidad > 0))) {
    throw new Error('Cada línea necesita una presentación y una cantidad mayor que 0.');
  }

  // Recalculado aquí (no confiado del caller): el mismo criterio que ya
  // aplica al resto de las validaciones de este módulo.
  const presentaciones = await db.presentacion.bulkGet(
    lineasInput.map((l) => l.presentacionId)
  );
  const litrosEnvasados = calcularLitrosEnvasados(
    lineasInput,
    presentaciones.filter((p): p is NonNullable<typeof p> => !!p)
  );
  if (!(litrosEnvasados > 0)) {
    throw new Error('No se pudo calcular los litros envasados (revisa las presentaciones elegidas).');
  }

  const envasadoId = generateUUID();
  const envasado: Envasado = {
    id: envasadoId,
    producto_base_id: productoBaseId,
    fecha,
    litros_envasados: litrosEnvasados,
    bidones_abiertos: 0,
    responsable_id: responsableId,
    nota,
  };

  await persist('envasado', envasado);

  const lineas: EnvasadoLinea[] = [];
  for (const l of lineasInput) {
    const linea: EnvasadoLinea = {
      id: generateUUID(),
      envasado_id: envasadoId,
      presentacion_id: l.presentacionId,
      cantidad: l.cantidad,
    };
    await persist('envasado_linea', linea);
    lineas.push(linea);
  }

  // Un único disparo de sync para todo el lote (igual que registrarVenta).
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { envasado, lineas };
}

// ── Persistencia local + cola (sin disparar sync por fila) ────

async function persist(
  table: 'envasado' | 'envasado_linea',
  row: object
): Promise<void> {
  const raw = row as Record<string, unknown>;
  await db.table(table).put(raw);
  await enqueueOperation(table, 'upsert', raw);
}
