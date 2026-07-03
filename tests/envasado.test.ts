/**
 * Logiclean Ruta — Tests Inc 6.3: envasado (H-17, ADR-0007)
 *
 * ENV-001: bidon_nuevo persiste envasado + líneas, encola en un solo lote
 * ENV-002: bidon_nuevo abre exactamente 1 bidón (bidones_abiertos=1) y usa el
 *   residuo capturado
 * ENV-003: granel no abre ningún bidón (bidones_abiertos=0) y usa el consumo
 *   capturado; no toca litros_residuo_estimado
 * ENV-004: exige al menos una línea
 * ENV-005: valida cada línea (presentación + cantidad > 0)
 * ENV-006: bidon_nuevo exige residuo >= 0
 * ENV-007: granel exige consumo > 0
 * ENV-008: exige producto base y responsable
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

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const base = {
  productoBaseId: 'pb-multiusos',
  responsableId: 'gerente-uuid-001',
  fecha: '2026-07-09',
};

describe('registrarEnvasado', () => {
  it('ENV-001: persiste envasado + líneas y encola en un solo lote', async () => {
    const { envasado, lineas } = await registrarEnvasado({
      ...base,
      origen: 'bidon_nuevo',
      litrosResiduoEstimado: 2,
      lineas: [
        { presentacionId: 'pres-1L', cantidad: 15 },
        { presentacionId: 'pres-3.7L', cantidad: 1 },
      ],
    });

    expect(await db.envasado.get(envasado.id)).toBeDefined();
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

  it('ENV-002: bidon_nuevo abre exactamente 1 bidón y usa el residuo capturado', async () => {
    const { envasado } = await registrarEnvasado({
      ...base,
      origen: 'bidon_nuevo',
      litrosResiduoEstimado: 3.5,
      lineas: [{ presentacionId: 'pres-1L', cantidad: 10 }],
    });
    expect(envasado.bidones_abiertos).toBe(1);
    expect(envasado.litros_residuo_estimado).toBe(3.5);
    expect(envasado.litros_consumidos_granel).toBe(0);
  });

  it('ENV-003: granel no abre bidón y usa el consumo capturado', async () => {
    const { envasado } = await registrarEnvasado({
      ...base,
      origen: 'granel',
      litrosConsumidosGranel: 4,
      lineas: [{ presentacionId: 'pres-1L', cantidad: 4 }],
    });
    expect(envasado.bidones_abiertos).toBe(0);
    expect(envasado.litros_consumidos_granel).toBe(4);
    expect(envasado.litros_residuo_estimado).toBe(0);
  });

  it('ENV-004: exige al menos una línea', async () => {
    await expect(
      registrarEnvasado({ ...base, origen: 'bidon_nuevo', litrosResiduoEstimado: 1, lineas: [] })
    ).rejects.toThrow();
  });

  it('ENV-005: valida cada línea (presentación + cantidad > 0)', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        origen: 'bidon_nuevo',
        litrosResiduoEstimado: 1,
        lineas: [{ presentacionId: '', cantidad: 5 }],
      })
    ).rejects.toThrow();
    await expect(
      registrarEnvasado({
        ...base,
        origen: 'bidon_nuevo',
        litrosResiduoEstimado: 1,
        lineas: [{ presentacionId: 'pres-1L', cantidad: 0 }],
      })
    ).rejects.toThrow();
  });

  it('ENV-006: bidon_nuevo exige residuo >= 0', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        origen: 'bidon_nuevo',
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
  });

  it('ENV-007: granel exige consumo > 0', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        origen: 'granel',
        litrosConsumidosGranel: 0,
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
  });

  it('ENV-008: exige producto base y responsable', async () => {
    await expect(
      registrarEnvasado({
        ...base,
        productoBaseId: '',
        origen: 'bidon_nuevo',
        litrosResiduoEstimado: 1,
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
    await expect(
      registrarEnvasado({
        ...base,
        responsableId: '',
        origen: 'bidon_nuevo',
        litrosResiduoEstimado: 1,
        lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }],
      })
    ).rejects.toThrow();
  });
});
