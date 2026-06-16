/**
 * Logiclean Ruta — Tests: gastos de ruta (H-12)
 *
 * Persistencia real en Dexie (fake-indexeddb) con el motor de sync mockeado.
 *
 * GASTO-001: registra un gasto de ruta con tipo/categoría/forma de pago y lo persiste
 * GASTO-002: el gasto entra a la cola de sync como 'pending' (offline-first)
 * GASTO-003: valida monto > 0 y categoría no vacía
 * GASTO-004: totalesPorBolsa separa efectivo y transferencia
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: {
    enqueueAndSync: vi.fn(async () => {}),
    refreshPendingCount: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {}),
  },
}));

import { registrarGasto, totalesPorBolsa } from '../src/lib/gastos';
import { db } from '../src/db/index';
import type { Gasto } from '../src/db/schema';

const VENDEDOR = 'vend-1';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('registrarGasto', () => {
  it('GASTO-001: registra y persiste un gasto de ruta', async () => {
    const gasto = await registrarGasto({
      vendedorId: VENDEDOR,
      categoria: 'Gasolina',
      monto: 250,
      forma_pago: 'efectivo',
      fecha: '2026-06-15',
    });

    expect(gasto.tipo).toBe('ruta');
    expect(gasto.vendedor_id).toBe(VENDEDOR);

    const enDB = await db.gasto.get(gasto.id);
    expect(enDB?.categoria).toBe('Gasolina');
    expect(enDB?.monto).toBe(250);
    expect(enDB?.forma_pago).toBe('efectivo');
  });

  it('GASTO-002: encola el gasto como pending', async () => {
    await registrarGasto({
      vendedorId: VENDEDOR,
      categoria: 'Casetas',
      monto: 80,
      forma_pago: 'transferencia',
    });

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    expect(pendientes).toHaveLength(1);
    expect(pendientes[0].table_name).toBe('gasto');
  });

  it('GASTO-003: rechaza monto <= 0 y categoría vacía', async () => {
    await expect(
      registrarGasto({ vendedorId: VENDEDOR, categoria: 'Gasolina', monto: 0, forma_pago: 'efectivo' })
    ).rejects.toThrow(/monto/);
    await expect(
      registrarGasto({ vendedorId: VENDEDOR, categoria: '  ', monto: 10, forma_pago: 'efectivo' })
    ).rejects.toThrow(/categoría/);
  });
});

describe('totalesPorBolsa', () => {
  it('GASTO-004: separa efectivo y transferencia', () => {
    const gastos = [
      { forma_pago: 'efectivo', monto: 100 },
      { forma_pago: 'efectivo', monto: 50 },
      { forma_pago: 'transferencia', monto: 80 },
    ] as Gasto[];

    expect(totalesPorBolsa(gastos)).toEqual({ efectivo: 150, transferencia: 80 });
  });
});
