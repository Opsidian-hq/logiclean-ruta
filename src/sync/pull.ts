/**
 * Logiclean Ruta — Hidratación servidor → BD local (pull)
 *
 * El motor de sync (`SyncEngine`) sube cambios locales a Supabase (push).
 * Este módulo cierra el ciclo en sentido inverso: trae las filas del servidor
 * y las vuelca en Dexie para que el vendedor opere **sin conexión** sobre datos
 * reales (catálogo, sus clientes, su inventario) — incluso en un dispositivo
 * recién instalado, donde la BD local arranca vacía.
 *
 * Garantías:
 *  - Idempotente: `bulkPut` hace upsert por `id`, sin duplicados.
 *  - RLS hace el filtrado: cada usuario solo recibe lo que puede ver
 *    (catálogo global; clientes/inventario/ventas acotados por vendedor_id).
 *  - Booleanos normalizados a 1/0 (`toDexieRow`) para que los índices de Dexie
 *    funcionen.
 *
 * Estrategia: pull completo por tabla. El conjunto de Inc 0 es pequeño
 * (catálogo + cartera del vendedor); la sincronización incremental por
 * marca de tiempo es una mejora posterior, no necesaria para el hito.
 *
 * Orden respecto al push: hidratar **después** de procesar la cola, para que
 * los cambios locales pendientes ya estén en el servidor antes de releer.
 */

import { supabase } from '../lib/supabase';
import { db } from '../db/index';
import { toDexieRow } from '../db/normalize';
import type { EntityTable } from '../db/schema';

/**
 * Tablas que se hidratan en Inc 0.
 * - vendedor / producto_base / presentacion: necesarias para el catálogo.
 * - cliente / inventario_vehiculo: cartera e inventario del vendedor (RLS).
 */
export const PULL_TABLES: EntityTable[] = [
  'vendedor',
  'producto_base',
  'presentacion',
  'cliente',
  'visita',
  'inventario_vehiculo',
  'gasto',
  // Inc 3 — corte semanal y reconciliación con La Moderna.
  'suministro_la_moderna',
  'corte',
];

/** Resultado de una hidratación, por tabla. */
export interface PullResult {
  table: EntityTable;
  count: number;
  error?: string;
}

/**
 * Trae todas las filas visibles de una tabla y las vuelca en Dexie.
 * Devuelve cuántas filas se escribieron.
 */
export async function pullTable(table: EntityTable): Promise<number> {
  const { data, error } = await supabase.from(table).select('*');

  if (error) {
    throw new Error(`pull ${table}: ${error.message}`);
  }

  const rows = (data ?? []).map((row) =>
    toDexieRow(row as Record<string, unknown>)
  );

  if (rows.length > 0) {
    // bulkPut = upsert por clave primaria (`id`): idempotente, sin duplicados.
    await db.table(table).bulkPut(rows);
  }

  return rows.length;
}

/**
 * Hidrata el conjunto indicado de tablas (por defecto `PULL_TABLES`).
 * No aborta ante el fallo de una tabla: registra el error y continúa, para que
 * un problema puntual (p. ej. RLS de una tabla) no impida hidratar el resto.
 */
export async function hydrate(
  tables: EntityTable[] = PULL_TABLES
): Promise<PullResult[]> {
  const results: PullResult[] = [];

  for (const table of tables) {
    try {
      const count = await pullTable(table);
      results.push({ table, count });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[pull] Error al hidratar ${table}:`, message);
      results.push({ table, count: 0, error: message });
    }
  }

  return results;
}
