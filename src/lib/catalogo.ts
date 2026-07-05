/**
 * Logiclean Ruta — Gestión del catálogo (H-13)
 *
 * Persistencia local + cola de sync para alta/edición y baja lógica de
 * productos base y presentaciones. Funciones canónicas que consume
 * `useCatalog`; aisladas aquí para trazarlas a los criterios de aceptación.
 *
 * Criterios (PRD v1.2, H-13):
 *  - Alta de producto → queda disponible con presentaciones, precios y factor.
 *  - Editar precio/factor → las ventas posteriores usan el nuevo valor (el
 *    precio se congela al vender, ver lib/precios).
 *  - Baja → se **desactiva** (no se borra) para no romper el histórico de cortes.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { toDexieRow } from '../db/normalize';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { ProductoBase, Presentacion } from '../db/schema';

export type GuardarProductoInput = Omit<ProductoBase, 'id'> & { id?: string };
export type GuardarPresentacionInput = Omit<Presentacion, 'id'> & { id?: string };

/** Crea o actualiza un producto base. Escribe local + encola sync. */
export async function guardarProducto(data: GuardarProductoInput): Promise<ProductoBase> {
  const producto: ProductoBase = {
    id: data.id ?? generateUUID(),
    nombre: data.nombre,
    unidad_compra: data.unidad_compra,
    categoria: data.categoria,
    precio_preferencial: data.precio_preferencial,
    litros_por_bidon: data.litros_por_bidon,
    activo: data.activo ?? true,
  };

  await db.producto_base.put(toDexieRow(producto));
  const item = await enqueueOperation(
    'producto_base',
    'upsert',
    producto as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
  return producto;
}

/** Baja lógica de un producto base (se desactiva, nunca DELETE). */
export async function desactivarProducto(id: string): Promise<void> {
  const actual = await db.producto_base.get(id);
  if (!actual) return;
  const producto: ProductoBase = { ...actual, activo: false };

  await db.producto_base.put(toDexieRow(producto));
  const item = await enqueueOperation(
    'producto_base',
    'upsert',
    producto as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
}

/** Crea o actualiza una presentación (precios y factor de conversión). */
export async function guardarPresentacion(
  data: GuardarPresentacionInput
): Promise<Presentacion> {
  const presentacion: Presentacion = {
    id: data.id ?? generateUUID(),
    producto_base_id: data.producto_base_id,
    nombre: data.nombre,
    unidad_venta: data.unidad_venta,
    factor_conversion: data.factor_conversion,
    precio_mayoreo: data.precio_mayoreo,
    precio_menudeo: data.precio_menudeo,
    activo: data.activo ?? true,
  };

  await db.presentacion.put(toDexieRow(presentacion));
  const item = await enqueueOperation(
    'presentacion',
    'upsert',
    presentacion as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
  return presentacion;
}

/** Baja lógica de una presentación (se desactiva, nunca DELETE). */
export async function desactivarPresentacion(id: string): Promise<void> {
  const actual = await db.presentacion.get(id);
  if (!actual) return;
  const presentacion: Presentacion = { ...actual, activo: false };

  await db.presentacion.put(toDexieRow(presentacion));
  const item = await enqueueOperation(
    'presentacion',
    'upsert',
    presentacion as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
}
