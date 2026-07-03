/**
 * Logiclean Ruta — Tests Inc 6.5: devolución de sellados a La Moderna (M-1, ADR-0010)
 *
 * DEVLM-001: persiste y encola como pending (offline-first)
 * DEVLM-002: siempre registra tipo='devuelto'
 * DEVLM-003: rechaza cantidad <= 0
 * DEVLM-004: exige producto base y responsable
 * DEVLM-005: usa la fecha de hoy si no se especifica
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { registrarDevolucionLaModerna } from '../src/lib/movimientoLaModerna';
import { db } from '../src/db/index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('registrarDevolucionLaModerna', () => {
  it('DEVLM-001: persiste y encola como pending', async () => {
    const m = await registrarDevolucionLaModerna({
      productoBaseId: 'pb-cloro',
      cantidad: 4,
      responsableId: 'gerente-uuid-001',
      fecha: '2026-07-12',
    });

    const enDb = await db.movimiento_la_moderna.get(m.id);
    expect(enDb?.cantidad).toBe(4);
    expect(enDb?.tipo).toBe('devuelto');

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].table_name).toBe('movimiento_la_moderna');
    expect(cola[0].status).toBe('pending');
  });

  it('DEVLM-002: siempre registra tipo="devuelto"', async () => {
    const m = await registrarDevolucionLaModerna({
      productoBaseId: 'pb-cloro',
      cantidad: 2,
      responsableId: 'gerente-uuid-001',
    });
    expect(m.tipo).toBe('devuelto');
  });

  it('DEVLM-003: rechaza cantidad <= 0', async () => {
    await expect(
      registrarDevolucionLaModerna({ productoBaseId: 'pb-cloro', cantidad: 0, responsableId: 'g1' })
    ).rejects.toThrow();
    await expect(
      registrarDevolucionLaModerna({ productoBaseId: 'pb-cloro', cantidad: -1, responsableId: 'g1' })
    ).rejects.toThrow();
  });

  it('DEVLM-004: exige producto base y responsable', async () => {
    await expect(
      registrarDevolucionLaModerna({ productoBaseId: '', cantidad: 1, responsableId: 'g1' })
    ).rejects.toThrow();
    await expect(
      registrarDevolucionLaModerna({ productoBaseId: 'pb-cloro', cantidad: 1, responsableId: '' })
    ).rejects.toThrow();
  });

  it('DEVLM-005: usa la fecha de hoy si no se especifica', async () => {
    const m = await registrarDevolucionLaModerna({
      productoBaseId: 'pb-cloro',
      cantidad: 1,
      responsableId: 'g1',
    });
    expect(m.fecha).toBe(new Date().toISOString().slice(0, 10));
  });
});
