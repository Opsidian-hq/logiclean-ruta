/**
 * Logiclean Ruta — Tests Inc 6.1: extensión del motor de sync a bodega
 *
 * A diferencia de sync.test.ts (motor simplificado, lógica pura), aquí se
 * ejercitan los módulos REALES (`queue`, `pull`, `db`) sobre `fake-indexeddb`,
 * igual que pull.test.ts, para probar que las tablas de evento de bodega
 * quedaron correctamente conectadas a la cola y al pull existentes.
 *
 * Nota: no se importa `SyncEngine.ts` aquí — su singleton se instancia al
 * cargar el módulo y usa `window`/`document` (entorno de browser), fuera del
 * entorno `node` de este proyecto (vite.config.ts, igual que pull.test.ts).
 * El paso "procesar la cola" se replica con el mismo contrato que
 * `SyncEngine.processItem` usa para 'upsert' (llamar a `supabase.upsert` y
 * marcar `synced`), sobre la cola y el Dexie REALES — así se prueba que el
 * dato persistido y el mecanismo de idempotencia (upsert por id) funcionan
 * de verdad para las tablas nuevas, no solo en un mock aislado.
 *
 * BODEGA-SYNC-001: las 9 tablas nuevas están en EntityTable/DEXIE_SCHEMA_V2
 *   y Dexie las abre como stores reales.
 * BODEGA-SYNC-002: las 9 tablas nuevas están en PULL_TABLES (se hidratan).
 * BODEGA-SYNC-003: un evento de bodega "creado offline" (encolado en la cola
 *   real) sincroniza al servidor mockeado.
 * BODEGA-SYNC-004 (T11): reintentar el mismo id de negocio (doble encolado,
 *   como un retry) resulta en un solo registro remoto — idempotencia por
 *   UUID, igual que el resto de las tablas (T1-003), ahora también bodega.
 * BODEGA-SYNC-005: pullTable hidrata cada tabla nueva de bodega en Dexie.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock del cliente Supabase (select + upsert) ────────────────

const h = vi.hoisted(() => ({
  store: {
    data: {} as Record<string, Record<string, unknown>[]>,
    remote: {} as Record<string, Map<string, Record<string, unknown>>>,
  },
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: async () => ({ data: h.store.data[table] ?? [], error: null }),
      upsert: (payload: Record<string, unknown>) => {
        const remoteTable = (h.store.remote[table] ??= new Map());
        remoteTable.set(payload.id as string, payload);
        return Promise.resolve({ data: [payload], error: null });
      },
    }),
  },
}));

import { pullTable, hydrate, PULL_TABLES } from '../src/sync/pull';
import { supabase } from '../src/lib/supabase';
import { db } from '../src/db/index';
import { enqueueOperation, getPendingItems, markSynced } from '../src/sync/queue';
import type { EntityTable } from '../src/db/schema';
import type { SyncQueueItem } from '../src/sync/queue';

/** Replica el contrato de SyncEngine.processItem para 'upsert' (ver nota arriba). */
async function processPendingQueue(): Promise<void> {
  const items = await getPendingItems();
  for (const item of items as SyncQueueItem[]) {
    if (item.operation !== 'upsert') continue;
    const { error } = await supabase
      .from(item.table_name)
      .upsert(item.payload as Record<string, unknown>, { onConflict: 'id' });
    if (!error) await markSynced(item.id);
  }
}

const BODEGA_TABLES: EntityTable[] = [
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

beforeEach(async () => {
  h.store.data = {};
  h.store.remote = {};
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('BODEGA-SYNC-001: tablas de bodega registradas en Dexie', () => {
  it.each(BODEGA_TABLES)('%s existe como store de Dexie', async (table) => {
    expect(db.tables.map((t) => t.name)).toContain(table);
    await expect(db.table(table).count()).resolves.toBe(0);
  });
});

describe('BODEGA-SYNC-002: tablas de bodega en PULL_TABLES', () => {
  it.each(BODEGA_TABLES)('%s se hidrata desde el servidor', (table) => {
    expect(PULL_TABLES).toContain(table);
  });
});

describe('BODEGA-SYNC-003 / 004: push idempotente vía el motor real', () => {
  it('BODEGA-SYNC-003: un movimiento_la_moderna encolado offline llega al servidor mockeado', async () => {
    const payload = {
      id: 'mov-uuid-001',
      producto_base_id: 'prod-quimico-001',
      tipo: 'recibido',
      fecha: '2026-07-02',
      cantidad: 10,
      responsable_id: 'gerente-uuid-001',
    };

    const item = await enqueueOperation('movimiento_la_moderna', 'upsert', payload);
    expect((await getPendingItems()).map((i) => i.id)).toContain(item.id);

    await processPendingQueue();

    expect(h.store.remote.movimiento_la_moderna?.size).toBe(1);
    expect(h.store.remote.movimiento_la_moderna?.get('mov-uuid-001')).toMatchObject(payload);
    expect(await getPendingItems()).toHaveLength(0);
  });

  it('BODEGA-SYNC-004 (T11): reintentar el mismo UUID de carga_vehiculo no duplica en el servidor', async () => {
    const payload = {
      id: 'carga-uuid-001',
      vendedor_id: 'vendedor-uuid-001',
      fecha: '2026-07-04',
      responsable_id: 'vendedor-uuid-001',
    };

    // Primer intento (p. ej. offline, se encola pero aún no se sincroniza)
    const item1 = await enqueueOperation('carga_vehiculo', 'upsert', payload);
    // Reintento del mismo evento (mismo id de negocio) — simula un doble push
    // al reconectar, que es exactamente el escenario de T11.
    const item2 = await enqueueOperation('carga_vehiculo', 'upsert', payload);

    await processPendingQueue();

    // El servidor (upsert por id) queda con un solo registro.
    expect(h.store.remote.carga_vehiculo?.size).toBe(1);
    // Ambos ítems de la cola local se procesaron (no se pierde ninguno).
    const q1 = (await db.sync_queue.where('id').equals(item1.id).first())!;
    const q2 = (await db.sync_queue.where('id').equals(item2.id).first())!;
    expect(q1.status).toBe('synced');
    expect(q2.status).toBe('synced');
  });
});

describe('BODEGA-SYNC-005: pullTable hidrata cada tabla nueva de bodega', () => {
  it.each(BODEGA_TABLES)('%s', async (table) => {
    h.store.data[table] = [{ id: `${table}-row-1` }];

    const count = await pullTable(table);

    expect(count).toBe(1);
    expect(await db.table(table).get(`${table}-row-1`)).toBeDefined();
  });

  it('hydrate() por defecto incluye las 9 tablas de bodega en su reporte', async () => {
    const results = await hydrate();
    const reportedTables = results.map((r) => r.table);
    for (const table of BODEGA_TABLES) {
      expect(reportedTables).toContain(table);
    }
  });
});
