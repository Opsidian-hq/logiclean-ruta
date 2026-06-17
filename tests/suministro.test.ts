/**
 * Logiclean Ruta — Tests: suministro y reconciliación con La Moderna (Inc 3)
 *
 * SUM-001: adeudo = (recibido − devuelto) × precio_preferencial por producto
 * SUM-002: suma varios suministros del mismo producto base
 * SUM-003: ignora productos sin catálogo; total es la suma de adeudos
 * SUM-004: registrarSuministro persiste y encola (offline-first)
 * SUM-005: valida cantidades (no negativas; devuelto ≤ recibido)
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { adeudoLaModerna, registrarSuministro } from '../src/lib/suministro';
import { db } from '../src/db/index';

const productos = [
  { id: 'pb-cloro', nombre: 'Cloro', precio_preferencial: 120 },
  { id: 'pb-jabon', nombre: 'Jabón', precio_preferencial: 90 },
];

describe('adeudoLaModerna', () => {
  it('SUM-001: adeudo por producto = neto × precio preferencial', () => {
    const r = adeudoLaModerna(
      [{ producto_base_id: 'pb-cloro', cantidad_recibida: 10, cantidad_devuelta: 3 }],
      productos
    );
    expect(r.porProducto[0].neto).toBe(7);
    expect(r.porProducto[0].adeudo).toBe(840); // 7 × 120
    expect(r.total).toBe(840);
  });

  it('SUM-002: agrega varios suministros del mismo producto', () => {
    const r = adeudoLaModerna(
      [
        { producto_base_id: 'pb-cloro', cantidad_recibida: 10, cantidad_devuelta: 2 },
        { producto_base_id: 'pb-cloro', cantidad_recibida: 5, cantidad_devuelta: 1 },
      ],
      productos
    );
    expect(r.porProducto[0].recibido).toBe(15);
    expect(r.porProducto[0].devuelto).toBe(3);
    expect(r.porProducto[0].adeudo).toBe(12 * 120);
  });

  it('SUM-003: ignora productos sin catálogo; total suma adeudos', () => {
    const r = adeudoLaModerna(
      [
        { producto_base_id: 'pb-cloro', cantidad_recibida: 4, cantidad_devuelta: 0 },
        { producto_base_id: 'pb-jabon', cantidad_recibida: 2, cantidad_devuelta: 0 },
        { producto_base_id: 'fantasma', cantidad_recibida: 9, cantidad_devuelta: 0 },
      ],
      productos
    );
    expect(r.porProducto).toHaveLength(2);
    expect(r.total).toBe(4 * 120 + 2 * 90);
  });
});

describe('registrarSuministro', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('SUM-004: persiste y encola como pending', async () => {
    const s = await registrarSuministro({
      productoBaseId: 'pb-cloro',
      cantidadRecibida: 12,
      cantidadDevuelta: 4,
      fecha: '2026-06-15',
    });
    const enDb = await db.suministro_la_moderna.get(s.id);
    expect(enDb?.cantidad_recibida).toBe(12);
    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].table_name).toBe('suministro_la_moderna');
    expect(cola[0].status).toBe('pending');
  });

  it('SUM-005: rechaza cantidades inválidas', async () => {
    await expect(
      registrarSuministro({ productoBaseId: 'pb-cloro', cantidadRecibida: 2, cantidadDevuelta: 5 })
    ).rejects.toThrow();
    await expect(
      registrarSuministro({ productoBaseId: 'pb-cloro', cantidadRecibida: -1, cantidadDevuelta: 0 })
    ).rejects.toThrow();
  });
});
