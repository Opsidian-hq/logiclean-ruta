/**
 * Logiclean Ruta — Tests: gastos de backoffice (Inc 3)
 *
 * BACK-001: un gasto de backoffice se guarda sin vendedor (vendedor_id null)
 * BACK-002: un gasto de ruta sin vendedor es rechazado
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { registrarGasto } from '../src/lib/gastos';
import { db } from '../src/db/index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('gastos de backoffice', () => {
  it('BACK-001: se guarda sin vendedor (negocio)', async () => {
    const g = await registrarGasto({
      tipo: 'backoffice',
      categoria: 'Etiquetas',
      monto: 70,
      forma_pago: 'efectivo',
    });
    expect(g.tipo).toBe('backoffice');
    expect(g.vendedor_id).toBeNull();
    const enDb = await db.gasto.get(g.id);
    expect(enDb?.vendedor_id).toBeNull();
  });

  it('BACK-002: un gasto de ruta sin vendedor es rechazado', async () => {
    await expect(
      registrarGasto({ tipo: 'ruta', categoria: 'Gasolina', monto: 50, forma_pago: 'efectivo' })
    ).rejects.toThrow();
  });
});
