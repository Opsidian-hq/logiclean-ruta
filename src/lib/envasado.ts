/**
 * Logiclean Ruta — Registro de envasado (Inc 6.3, H-17, ADR-0007)
 *
 * Compone, en una sola operación local e instantánea:
 *  - ENVASADO (origen bidón nuevo / granel, residuo o consumo de granel)
 *  - ENVASADO_LINEA por cada presentación que salió
 *
 * Los contadores de bodega (bidones_disponibles, litros_granel_estimado,
 * presentaciones) se materializan del lado servidor por trigger (migración
 * 007) al sincronizar — no se calculan ni se empujan aquí (ADR-0007, mismo
 * patrón que `lib/ventas.ts` con `inventario_vehiculo`, pero server-side por
 * ser bodega compartida).
 *
 * `origen='bidon_nuevo'` siempre abre exactamente un bidón (H-17: "un bidón
 * de 20 L… registro un envasado"); `origen='granel'` no abre ningún bidón
 * nuevo (ya se contó al abrirse).
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { Envasado, EnvasadoLinea } from '../db/schema';

export interface EnvasadoLineaInput {
  presentacionId: string;
  cantidad: number;
}

export interface RegistrarEnvasadoInput {
  productoBaseId: string;
  origen: 'bidon_nuevo' | 'granel';
  /** Litros que quedan en el bidón al terminar (obligatorio si origen=bidon_nuevo). */
  litrosResiduoEstimado?: number;
  /** Litros tomados del granel (obligatorio si origen=granel). */
  litrosConsumidosGranel?: number;
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
    origen,
    litrosResiduoEstimado,
    litrosConsumidosGranel,
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
  if (origen === 'bidon_nuevo' && !(litrosResiduoEstimado! >= 0)) {
    throw new Error('Captura el residuo estimado (0 o más litros).');
  }
  if (origen === 'granel' && !(litrosConsumidosGranel! > 0)) {
    throw new Error('Captura los litros consumidos del granel (mayor que 0).');
  }

  const envasadoId = generateUUID();
  const envasado: Envasado = {
    id: envasadoId,
    producto_base_id: productoBaseId,
    fecha,
    origen,
    bidones_abiertos: origen === 'bidon_nuevo' ? 1 : 0,
    litros_consumidos_granel: origen === 'granel' ? litrosConsumidosGranel! : 0,
    litros_residuo_estimado: origen === 'bidon_nuevo' ? litrosResiduoEstimado! : 0,
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
