/**
 * Logiclean Ruta — Tests: Hidratación servidor → BD local (pull)
 *
 * Cubre el hueco de Inc 0: el motor solo subía cambios (push); faltaba traer
 * los datos del servidor a Dexie para que el vendedor opere sin conexión en un
 * dispositivo recién instalado.
 *
 * A diferencia de sync.test.ts (lógica pura en memoria), aquí ejercitamos el
 * **Dexie real** sobre `fake-indexeddb`, porque el punto fino que se valida es
 * el comportamiento de los índices de IndexedDB con booleanos.
 *
 * PULL-001: pullTable vuelca las filas del servidor en Dexie
 * PULL-002: los booleanos se normalizan a 1/0 → `.equals(1)` los encuentra
 * PULL-003: pull repetido es idempotente (upsert por id, sin duplicados)
 * PULL-004: hydrate recorre el conjunto por defecto y reporta por tabla
 * PULL-005: si una tabla falla, hydrate continúa con las demás
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock del cliente Supabase ─────────────────────────────────
// Almacén controlable por test; se referencia vía vi.hoisted para que el
// factory de vi.mock (hoisteado al tope) pueda usarlo sin ReferenceError.

const h = vi.hoisted(() => ({
  store: {
    data: {} as Record<string, Record<string, unknown>[]>,
    errors: {} as Record<string, string>,
  },
}));

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: async () =>
        h.store.errors[table]
          ? { data: null, error: { message: h.store.errors[table] } }
          : { data: h.store.data[table] ?? [], error: null },
    }),
  },
}));

import { pullTable, hydrate, PULL_TABLES } from '../src/sync/pull';
import { db } from '../src/db/index';

// ── Setup ─────────────────────────────────────────────────────

beforeEach(async () => {
  h.store.data = {};
  h.store.errors = {};
  await Promise.all(db.tables.map((t) => t.clear()));
});

// ── PULL-001 / PULL-002 ───────────────────────────────────────

describe('pullTable', () => {
  it('PULL-001: vuelca las filas del servidor en Dexie', async () => {
    h.store.data.producto_base = [
      { id: 'p1', nombre: 'Jabón', unidad_compra: 'bidon', activo: true },
      { id: 'p2', nombre: 'Cloro', unidad_compra: 'bidon', activo: true },
    ];

    const count = await pullTable('producto_base');

    expect(count).toBe(2);
    expect(await db.producto_base.count()).toBe(2);
    expect((await db.producto_base.get('p1'))?.nombre).toBe('Jabón');
  });

  it('PULL-002: normaliza booleanos a 1/0 para que el índice los encuentre', async () => {
    h.store.data.producto_base = [
      { id: 'activo1', nombre: 'A', unidad_compra: 'bidon', activo: true },
      { id: 'inactivo1', nombre: 'B', unidad_compra: 'bidon', activo: false },
    ];

    await pullTable('producto_base');

    // El hueco real: con `activo: true` (booleano) IndexedDB NO lo indexa y
    // esta consulta —la que usan los hooks— devolvería vacío.
    const activos = await db.producto_base.where('activo').equals(1).toArray();
    expect(activos.map((p) => p.id)).toEqual(['activo1']);

    // Y el inactivo queda fuera del índice de activos.
    const stored = await db.producto_base.get('inactivo1');
    expect(stored?.activo).toBe(0);
  });

  it('PULL-003: pull repetido es idempotente (sin duplicados)', async () => {
    h.store.data.cliente = [
      {
        id: 'c1',
        vendedor_id: 'v1',
        nombre: 'Tienda 1',
        tipo: 'mayoreo',
        estado: 'activo',
        ciclo_visita: 1,
        activo: true,
      },
    ];

    await pullTable('cliente');
    await pullTable('cliente');

    expect(await db.cliente.count()).toBe(1);
  });

  it('PULL-006: propaga el error del servidor', async () => {
    h.store.errors.cliente = 'permission denied';
    await expect(pullTable('cliente')).rejects.toThrow(/permission denied/);
  });

  it('PULL-007: hidrata ventas, líneas y cobros (D-004: dashboard/corte del gerente)', () => {
    // Regresión D-004: el gerente agregaba $0 porque venta/linea_venta/cobro
    // nunca se hidrataban a su BD local (sí el gasto). El consolidado del
    // dashboard y el corte dependen de que estas tablas se traigan.
    expect(PULL_TABLES).toContain('venta');
    expect(PULL_TABLES).toContain('linea_venta');
    expect(PULL_TABLES).toContain('cobro');
  });
});

// ── PULL-004 / PULL-005 ───────────────────────────────────────

describe('hydrate', () => {
  it('PULL-004: recorre el conjunto por defecto y reporta por tabla', async () => {
    h.store.data.producto_base = [
      { id: 'p1', nombre: 'A', unidad_compra: 'bidon', activo: true },
    ];
    h.store.data.inventario_vehiculo = [
      { id: 'i1', vendedor_id: 'v1', presentacion_id: 'pr1', cantidad: 10 },
    ];

    const results = await hydrate();

    expect(results.map((r) => r.table)).toEqual(PULL_TABLES);
    expect(results.find((r) => r.table === 'producto_base')?.count).toBe(1);
    expect(results.find((r) => r.table === 'inventario_vehiculo')?.count).toBe(1);
    expect(await db.inventario_vehiculo.get('i1')).toBeDefined();
  });

  it('PULL-005: si una tabla falla, continúa con las demás', async () => {
    h.store.errors.cliente = 'boom';
    h.store.data.producto_base = [
      { id: 'p1', nombre: 'A', unidad_compra: 'bidon', activo: true },
    ];

    const results = await hydrate();

    const cliente = results.find((r) => r.table === 'cliente');
    const producto = results.find((r) => r.table === 'producto_base');
    expect(cliente?.error).toMatch(/boom/);
    expect(producto?.count).toBe(1);
    // El fallo de una tabla no impide hidratar el resto.
    expect(await db.producto_base.count()).toBe(1);
  });
});
