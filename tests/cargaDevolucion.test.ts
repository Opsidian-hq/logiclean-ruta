/**
 * Logiclean Ruta — Tests Inc 6.4: carga y devolución a bodega (H-18/H-19)
 *
 * CARGA-001: persiste carga + líneas y encola en un solo lote
 * CARGA-002: exige al menos una línea
 * CARGA-003: valida cada línea (presentación + cantidad > 0)
 * CARGA-004: exige vendedor y responsable
 * CARGA-005: impide cargar más de lo disponible en bodega (H-18)
 * CARGA-006: permite cargar hasta exactamente lo disponible
 * DEV-001: persiste devolución + líneas y encola en un solo lote
 * DEV-002: exige al menos una línea
 * DEV-003: exige vendedor y responsable
 * DEV-004: impide devolver más de lo disponible en el vehículo (H-19)
 * DEV-005: permite devolver hasta exactamente lo disponible
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

import { registrarCarga, registrarDevolucion } from '../src/lib/cargaDevolucion';
import { db } from '../src/db/index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const base = {
  vendedorId: 'vendedor-uuid-001',
  responsableId: 'gerente-uuid-001',
  fecha: '2026-07-10',
};

describe('registrarCarga', () => {
  it('CARGA-001: persiste carga + líneas y encola en un solo lote', async () => {
    const disponibleBodega = new Map([['pres-1L', 20], ['pres-3.7L', 5]]);
    const { carga, lineas } = await registrarCarga({
      ...base,
      disponibleBodega,
      lineas: [
        { presentacionId: 'pres-1L', cantidad: 10 },
        { presentacionId: 'pres-3.7L', cantidad: 2 },
      ],
    });

    expect(await db.carga_vehiculo.get(carga.id)).toBeDefined();
    expect(lineas).toHaveLength(2);
    for (const l of lineas) {
      expect(await db.carga_linea.get(l.id)).toBeDefined();
    }

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(3);
  });

  it('CARGA-002: exige al menos una línea', async () => {
    await expect(
      registrarCarga({ ...base, disponibleBodega: new Map(), lineas: [] })
    ).rejects.toThrow();
  });

  it('CARGA-003: valida cada línea (presentación + cantidad > 0)', async () => {
    const disponibleBodega = new Map([['pres-1L', 20]]);
    await expect(
      registrarCarga({ ...base, disponibleBodega, lineas: [{ presentacionId: '', cantidad: 1 }] })
    ).rejects.toThrow();
    await expect(
      registrarCarga({ ...base, disponibleBodega, lineas: [{ presentacionId: 'pres-1L', cantidad: 0 }] })
    ).rejects.toThrow();
  });

  it('CARGA-004: exige vendedor y responsable', async () => {
    const disponibleBodega = new Map([['pres-1L', 20]]);
    await expect(
      registrarCarga({ ...base, vendedorId: '', disponibleBodega, lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }] })
    ).rejects.toThrow();
    await expect(
      registrarCarga({ ...base, responsableId: '', disponibleBodega, lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }] })
    ).rejects.toThrow();
  });

  it('CARGA-005: impide cargar más de lo disponible en bodega (H-18: no se carga de la nada)', async () => {
    const disponibleBodega = new Map([['pres-1L', 5]]);
    await expect(
      registrarCarga({ ...base, disponibleBodega, lineas: [{ presentacionId: 'pres-1L', cantidad: 6 }] })
    ).rejects.toThrow(/no hay suficiente/i);
    expect(await db.carga_vehiculo.count()).toBe(0);
  });

  it('CARGA-006: permite cargar hasta exactamente lo disponible', async () => {
    const disponibleBodega = new Map([['pres-1L', 5]]);
    const { carga } = await registrarCarga({
      ...base,
      disponibleBodega,
      lineas: [{ presentacionId: 'pres-1L', cantidad: 5 }],
    });
    expect(carga.id).toBeDefined();
  });
});

describe('registrarDevolucion', () => {
  it('DEV-001: persiste devolución + líneas y encola en un solo lote', async () => {
    const disponibleVehiculo = new Map([['pres-1L', 10]]);
    const { devolucion, lineas } = await registrarDevolucion({
      ...base,
      disponibleVehiculo,
      lineas: [{ presentacionId: 'pres-1L', cantidad: 3 }],
    });

    expect(await db.devolucion_bodega.get(devolucion.id)).toBeDefined();
    expect(lineas).toHaveLength(1);
    expect(await db.devolucion_linea.get(lineas[0].id)).toBeDefined();

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(2);
  });

  it('DEV-002: exige al menos una línea', async () => {
    await expect(
      registrarDevolucion({ ...base, disponibleVehiculo: new Map(), lineas: [] })
    ).rejects.toThrow();
  });

  it('DEV-003: exige vendedor y responsable', async () => {
    const disponibleVehiculo = new Map([['pres-1L', 10]]);
    await expect(
      registrarDevolucion({ ...base, vendedorId: '', disponibleVehiculo, lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }] })
    ).rejects.toThrow();
    await expect(
      registrarDevolucion({ ...base, responsableId: '', disponibleVehiculo, lineas: [{ presentacionId: 'pres-1L', cantidad: 1 }] })
    ).rejects.toThrow();
  });

  it('DEV-004: impide devolver más de lo disponible en el vehículo (H-19)', async () => {
    const disponibleVehiculo = new Map([['pres-1L', 5]]);
    await expect(
      registrarDevolucion({ ...base, disponibleVehiculo, lineas: [{ presentacionId: 'pres-1L', cantidad: 6 }] })
    ).rejects.toThrow(/no hay suficiente/i);
    expect(await db.devolucion_bodega.count()).toBe(0);
  });

  it('DEV-005: permite devolver hasta exactamente lo disponible', async () => {
    const disponibleVehiculo = new Map([['pres-1L', 5]]);
    const { devolucion } = await registrarDevolucion({
      ...base,
      disponibleVehiculo,
      lineas: [{ presentacionId: 'pres-1L', cantidad: 5 }],
    });
    expect(devolucion.id).toBeDefined();
  });
});
