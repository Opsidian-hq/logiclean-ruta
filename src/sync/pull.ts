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
 * - venta / linea_venta / cobro: movimientos del periodo. Imprescindibles para
 *   el dashboard y el corte del gerente: la RLS le da el consolidado de todos
 *   los vendedores, pero sin hidratarlos su BD local arranca vacía y agregaría
 *   $0 (D-004). Se traen juntos para que cada venta llegue con sus líneas y su
 *   cobro, igual que el `gasto` ya se hidrataba.
 * - Inc 6.1: contadores y eventos de bodega. Los contadores son los mismos
 *   para todos (RLS de lectura abierta a autenticados); los eventos de
 *   carga/devolución llegan acotados por vendedor_id (o completos al
 *   gerente), igual que `venta`.
 * - Inc 7.5: `corte_vendedor` / `liquidacion_movimiento` / `abono_saldo_vendedor`
 *   faltaban aquí — solo `corte` se hidrataba. Sin esto, cualquier dispositivo
 *   que no fuera el que confirmó el corte arrancaba con `corte_vendedor` vacía
 *   y ningún vendedor (ni el gerente en otro dispositivo) podía ver su saldo.
 */
export const PULL_TABLES: EntityTable[] = [
  'vendedor',
  'producto_base',
  'presentacion',
  'cliente',
  'visita',
  'venta',
  'linea_venta',
  'cobro',
  'pedido_pendiente',
  'inventario_vehiculo',
  'gasto',
  // Inc 3 — corte semanal y reconciliación con La Moderna.
  'suministro_la_moderna',
  'corte',
  // Inc 7.2/7.4/7.5 — corte por reparto: línea por vendedor, liquidación y abonos.
  'corte_vendedor',
  'liquidacion_movimiento',
  'abono_saldo_vendedor',
  // Inc 6.1 — inventario de bodega (contadores + eventos).
  'inventario_bodega_base',
  'inventario_bodega_presentacion',
  'movimiento_la_moderna',
  'envasado',
  'envasado_linea',
  'carga_vehiculo',
  'carga_linea',
  'devolucion_bodega',
  'devolucion_linea',
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
