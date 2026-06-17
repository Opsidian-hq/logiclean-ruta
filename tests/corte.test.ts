/**
 * Logiclean Ruta — Tests: corte semanal (H-10)
 *
 * CORTE-001: bolsas netas de gastos de ruta por forma de pago
 * CORTE-002: gastos de backoffice no tocan las bolsas del vendedor
 * CORTE-003: cartera = ventas − cobros (crédito vivo)
 * CORTE-004: inventario traducido a bidones + reconciliación La Moderna
 * CORTE-005: resalta descuadres (bolsa negativa, crédito pendiente)
 * CORTE-006: generarCorte registra el CORTE y lo encola; entrega = neto por defecto
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { calcularCorte, generarCorte } from '../src/lib/corte';
import type { CalcularCorteInput } from '../src/lib/corte';
import { db } from '../src/db/index';

const base: CalcularCorteInput = {
  ventas: [{ total: 500 }, { total: 300 }], // 800
  cobros: [
    { monto: 400, forma_pago: 'efectivo' },
    { monto: 200, forma_pago: 'transferencia' },
  ],
  gastos: [
    { tipo: 'ruta', forma_pago: 'efectivo', monto: 100 },
    { tipo: 'ruta', forma_pago: 'transferencia', monto: 50 },
    { tipo: 'backoffice', forma_pago: 'efectivo', monto: 70 },
  ],
  inventario: [{ presentacion_id: 'p-cloro1', cantidad: 20 }],
  presentaciones: [{ id: 'p-cloro1', producto_base_id: 'pb-cloro', factor_conversion: 10 }],
  suministros: [{ producto_base_id: 'pb-cloro', cantidad_recibida: 10, cantidad_devuelta: 3 }],
  productos: [{ id: 'pb-cloro', nombre: 'Cloro', precio_preferencial: 120 }],
};

describe('calcularCorte', () => {
  it('CORTE-001: bolsas netas de gastos de ruta', () => {
    const s = calcularCorte(base);
    expect(s.bolsas.efectivo).toEqual({ cobrado: 400, gastos: 100, neto: 300 });
    expect(s.bolsas.transferencia).toEqual({ cobrado: 200, gastos: 50, neto: 150 });
  });

  it('CORTE-002: backoffice no toca las bolsas, se reporta aparte', () => {
    const s = calcularCorte(base);
    expect(s.gastosBackoffice).toBe(70);
    // El gasto de backoffice en efectivo (70) NO se restó de la bolsa de efectivo.
    expect(s.bolsas.efectivo.gastos).toBe(100);
  });

  it('CORTE-003: cartera = ventas − cobros', () => {
    const s = calcularCorte(base);
    expect(s.ventasTotal).toBe(800);
    expect(s.cobradoTotal).toBe(600);
    expect(s.saldoCartera).toBe(200);
  });

  it('CORTE-004: inventario a bidones + adeudo La Moderna', () => {
    const s = calcularCorte(base);
    expect(s.inventarioBidones).toEqual([{ producto_base_id: 'pb-cloro', unidades: 2 }]);
    expect(s.moderna.total).toBe(7 * 120); // (10−3) × 120
  });

  it('CORTE-005: resalta crédito pendiente y bolsa negativa', () => {
    const s = calcularCorte(base);
    expect(s.alertas.some((a) => a.includes('crédito'))).toBe(true);

    const negativa = calcularCorte({
      ...base,
      cobros: [{ monto: 10, forma_pago: 'efectivo' }],
      gastos: [{ tipo: 'ruta', forma_pago: 'efectivo', monto: 80 }],
    });
    expect(negativa.bolsas.efectivo.neto).toBe(-70);
    expect(negativa.alertas.some((a) => a.includes('efectivo'))).toBe(true);
  });
});

describe('generarCorte', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('CORTE-006: registra el CORTE y encola; entrega = neto por defecto', async () => {
    const { corte, snapshot } = await generarCorte({
      ...base,
      vendedorId: 'vend-1',
      periodoInicio: '2026-06-08',
      periodoFin: '2026-06-14',
    });
    expect(corte.efectivo_entregado).toBe(snapshot.bolsas.efectivo.neto);
    expect(corte.transferencias_entregadas).toBe(snapshot.bolsas.transferencia.neto);
    expect(corte.periodo_inicio).toBe('2026-06-08');

    const enDb = await db.corte.get(corte.id);
    expect(enDb).toBeTruthy();
    const cola = await db.sync_queue.toArray();
    expect(cola[0].table_name).toBe('corte');
    expect(cola[0].status).toBe('pending');
  });
});
