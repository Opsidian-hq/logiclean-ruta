/**
 * Logiclean Ruta — Tests Inc 6.3: envasado (H-17, ADR-0007)
 *
 * ENV-001: persiste envasado + líneas, encola en un solo lote, con
 *   litros_envasados calculado a partir de las líneas
 * ENV-004: exige al menos una línea
 * ENV-005: valida cada línea (presentación + cantidad > 0)
 * ENV-008: exige producto base y responsable
 * ENV-011: calcula litros_envasados como Σ cantidad × factor_conversion con
 *   líneas mixtas
 * ENV-012: rechaza si el total calculado es 0 (presentación sin catálogo)
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

import { registrarEnvasado } from '../src/lib/envasado';
import { db } from '../src/db/index';

const base = {
  productoBaseId: 'pb-multiusos',
  responsableId: 'gerente-uuid-001',
  fecha: '2026-07-09',
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.presentacion.bulkPut([
    { id: 'pres-1L', producto_base_id: 'pb-multiusos', nombre: 'Multiusos 1 L', unidad_venta: 'litro', factor_conversion: 1, precio_mayoreo: 30, precio_menudeo: 30, activo: true },
    { id: 'pres-3.7L', producto_base_id: 'pb-multiusos', nombre: 'Multiusos 3.75 L', unidad_venta: 'litro', factor_conversion: 3.75, precio_mayoreo: 90, precio_menudeo: 90, activo: true },
    { id: 'pres-20L', producto_base_id: 'pb-multiusos', nombre: 'Multiusos 20 L', unidad_venta: 'litro', factor_conversion: 20, precio_mayoreo: 450, precio_menudeo: 450, activo: true },
  ]);
});

describe('registrarEnvasado', () => {
  it('ENV-001: persiste envasado + líneas y encola en un solo lote', async () => {
    const { envasado, lineas } = await registrarEnvasado({
      ...base,
      lineas: [
        { presentacionId: 'pres-1L', cantidad: 15 },
        { presentacionId: 'pres-3.7L', cantidad: 1 },
      ],
    });

    expect(await db.envasado.get(envasado.id)).toBeDefined();
    expect(envasado.litros_envasados).toBe(15 * 1 + 1 * 3.75);
    expect(envasado.bidones_abiertos).toBe(0); // lo sobreescribe el trigger server-side
    expect(lineas).toHaveLength(2);
    for (const l of lineas) {
      expect(await db.envasado_linea.get(l.id)).toBeDefined();
    }

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(3); // 1 envasado + 2 líneas
    expect(cola.map((c) => c.table_name).sort()).toEqual(
      ['envasado', 'envasado_linea', 'envasado_linea'].sort()
    );
  });

  it('ENV-004: exige al menos una línea', async () => {
    await expect(
      registrarEnvasado({ ...base, lineas: [] })
    ).rejects.toThrow();
  });

  it('ENV-005: valida cada línea (presentación + cantidad > 0)', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        lineas: [{ presentacionId: '', cantidad: 5 }],
      })
    ).rejects.toThrow();
    await expect(
      registrarEnvasado({
        ...base,
        lineas: [{ presentacionId: 'pres-1L', cantidad: 0 }],
      })
    ).rejects.toThrow();
  });

  it('ENV-008: exige producto base y responsable', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        productoBaseId: '',
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
    await expect(
      registrarEnvasado({
        ...base,
        responsableId: '',
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
  });

  it('ENV-011: calcula litros_envasados como Σ cantidad × factor_conversion con líneas mixtas', async () => {
    const { envasado } = await registrarEnvasado({
      ...base,
      lineas: [
        { presentacionId: 'pres-1L', cantidad: 10 },
        { presentacionId: 'pres-3.7L', cantidad: 2 },
        { presentacionId: 'pres-20L', cantidad: 1 },
      ],
    });
    expect(envasado.litros_envasados).toBe(10 * 1 + 2 * 3.75 + 1 * 20);
  });

  it('ENV-012: rechaza si el total calculado es 0 (presentación sin catálogo)', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        lineas: [{ presentacionId: 'pres-inexistente', cantidad: 5 }],
      })
    ).rejects.toThrow();
  });
});
