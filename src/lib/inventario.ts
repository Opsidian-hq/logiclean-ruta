/**
 * Logiclean Ruta — Inventario del vehículo (escritura local + cola)
 *
 * El contador `INVENTARIO_VEHICULO.cantidad` se decrementa en el cliente al
 * vender. Es seguro porque cada vendedor es dueño único de su dispositivo: no
 * hay escritura concurrente sobre la misma fila (riesgo T1 acotado).
 *
 * Todas las escrituras: Dexie (instantáneo, offline) + cola de sync idempotente.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { InventarioVehiculo } from '../db/schema';

/** Busca la fila de inventario de un vendedor para una presentación. */
export async function getInventario(
  vendedorId: string,
  presentacionId: string
): Promise<InventarioVehiculo | undefined> {
  return db.inventario_vehiculo
    .where('vendedor_id')
    .equals(vendedorId)
    .filter((r) => r.presentacion_id === presentacionId)
    .first();
}

/** Cantidad disponible (0 si no hay fila). */
export async function getCantidad(
  vendedorId: string,
  presentacionId: string
): Promise<number> {
  const row = await getInventario(vendedorId, presentacionId);
  return row?.cantidad ?? 0;
}

/**
 * Fija (upsert) la cantidad de una presentación en el inventario del vendedor.
 * Conserva el `id` si la fila ya existe (idempotencia de sync).
 *
 * `trigger=false` solo encola sin disparar sync — útil cuando se escriben
 * varias filas en lote (p. ej. una venta) y se dispara un único sync al final.
 */
export async function setCantidad(
  vendedorId: string,
  presentacionId: string,
  cantidad: number,
  trigger = true
): Promise<InventarioVehiculo> {
  const existente = await getInventario(vendedorId, presentacionId);
  const row: InventarioVehiculo = {
    id: existente?.id ?? generateUUID(),
    vendedor_id: vendedorId,
    presentacion_id: presentacionId,
    cantidad: Math.max(0, cantidad),
  };

  await db.inventario_vehiculo.put(row);
  const item = await enqueueOperation(
    'inventario_vehiculo',
    'upsert',
    row as unknown as Record<string, unknown>
  );
  if (trigger) await syncEngine.enqueueAndSync(item);
  return row;
}

/**
 * Decrementa la cantidad de una presentación (al vender desde el vehículo).
 * Nunca baja de 0. Si no existía fila, queda en 0.
 */
export async function decrementar(
  vendedorId: string,
  presentacionId: string,
  cantidad: number,
  trigger = true
): Promise<InventarioVehiculo> {
  const actual = await getCantidad(vendedorId, presentacionId);
  return setCantidad(vendedorId, presentacionId, actual - cantidad, trigger);
}
