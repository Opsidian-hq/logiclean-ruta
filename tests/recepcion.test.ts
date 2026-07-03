/**
 * Logiclean Ruta — Tests Inc 6.2: recepción de La Moderna (H-16, ADR-0006)
 *
 * REC-001: persiste y encola como pending (offline-first)
 * REC-002: siempre tipo='recibido' (la devolución vive en devolucionLaModerna.test.ts, Inc 6.5)
 * REC-003: valida cantidad > 0
 * REC-004: valida producto base y responsable obligatorios
 * REC-005: usa la fecha de hoy por defecto si no se especifica
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { registrarRecepcion } from '../src/lib/movimientoLaModerna';
import { db } from '../src/db/index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('registrarRecepcion', () => {
  it('REC-001: persiste y encola como pending', async () => {
    const m = await registrarRecepcion({
      productoBaseId: 'pb-cloro',
      cantidad: 12,
      responsableId: 'gerente-uuid-001',
      fecha: '2026-07-08',
    });

    const enDb = await db.movimiento_la_moderna.get(m.id);
    expect(enDb?.cantidad).toBe(12);
    expect(enDb?.producto_base_id).toBe('pb-cloro');

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].table_name).toBe('movimiento_la_moderna');
    expect(cola[0].status).toBe('pending');
  });

  it('REC-002: siempre registra tipo="recibido"', async () => {
    const m = await registrarRecepcion({
      productoBaseId: 'pb-cloro',
      cantidad: 5,
      responsableId: 'gerente-uuid-001',
    });
    expect(m.tipo).toBe('recibido');
  });

  it('REC-003: rechaza cantidad <= 0', async () => {
    await expect(
      registrarRecepcion({ productoBaseId: 'pb-cloro', cantidad: 0, responsableId: 'g1' })
    ).rejects.toThrow();
    await expect(
      registrarRecepcion({ productoBaseId: 'pb-cloro', cantidad: -3, responsableId: 'g1' })
    ).rejects.toThrow();
  });

  it('REC-004: exige producto base y responsable', async () => {
    await expect(
      registrarRecepcion({ productoBaseId: '', cantidad: 1, responsableId: 'g1' })
    ).rejects.toThrow();
    await expect(
      registrarRecepcion({ productoBaseId: 'pb-cloro', cantidad: 1, responsableId: '' })
    ).rejects.toThrow();
  });

  it('REC-005: usa la fecha de hoy si no se especifica', async () => {
    const m = await registrarRecepcion({
      productoBaseId: 'pb-cloro',
      cantidad: 1,
      responsableId: 'g1',
    });
    expect(m.fecha).toBe(new Date().toISOString().slice(0, 10));
  });
});
