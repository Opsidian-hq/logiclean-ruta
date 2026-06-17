/**
 * Logiclean Ruta — Tests: dashboard consolidado (H-15)
 *
 * DASH-001: suma ventas y caja por bolsa (netas) de todos los vendedores
 * DASH-002: marca descuadre por vendedor (bolsa negativa) y lo lleva a alertas
 * DASH-003: cartera activa = embudo.convertidos; alerta de vencidos
 */

import { describe, it, expect } from 'vitest';
import { construirDashboard } from '../src/lib/dashboard';
import type { SnapshotVendedor } from '../src/lib/dashboard';
import type { CorteSnapshot } from '../src/lib/corte';
import type { Embudo, Adherencia } from '../src/lib/prospectos';

function snap(ventas: number, efNeto: number, trNeto: number): CorteSnapshot {
  return {
    ventasTotal: ventas,
    cobradoTotal: efNeto + trNeto,
    saldoCartera: 0,
    bolsas: {
      efectivo: { cobrado: efNeto, gastos: 0, neto: efNeto },
      transferencia: { cobrado: trNeto, gastos: 0, neto: trNeto },
    },
    gastosBackoffice: 0,
    inventarioBidones: [],
    moderna: { porProducto: [], total: 0 },
    alertas: [],
  };
}

const sv = (vendedorId: string, nombre: string, s: CorteSnapshot): SnapshotVendedor => ({
  vendedorId,
  nombre,
  snapshot: s,
});

const embudo: Embudo = { etapas: [{ etapa: 1, count: 3 }, { etapa: 2, count: 2 }], convertidos: 5 };
const adher: Adherencia = { pct: 80, aTiempo: 8, total: 10 };

describe('construirDashboard', () => {
  it('DASH-001: agrega ventas y caja por bolsa', () => {
    const d = construirDashboard({
      porVendedor: [sv('v1', 'Ana', snap(500, 300, 150)), sv('v2', 'Beto', snap(300, 200, 100))],
      embudo,
      adherencia: adher,
      vencidos: 0,
    });
    expect(d.ventasTotal).toBe(800);
    expect(d.cajaEfectivo).toBe(500);
    expect(d.cajaTransferencia).toBe(250);
    expect(d.porVendedor).toHaveLength(2);
  });

  it('DASH-002: detecta descuadre por bolsa negativa y lo alerta', () => {
    const d = construirDashboard({
      porVendedor: [sv('v1', 'Ana', snap(100, -40, 20))],
      embudo,
      adherencia: adher,
      vencidos: 0,
    });
    expect(d.porVendedor[0].descuadre).toBe(true);
    expect(d.alertas.some((a) => a.includes('Ana'))).toBe(true);
  });

  it('DASH-003: cartera activa = convertidos; alerta de vencidos', () => {
    const d = construirDashboard({
      porVendedor: [sv('v1', 'Ana', snap(0, 0, 0))],
      embudo,
      adherencia: adher,
      vencidos: 2,
    });
    expect(d.carteraActiva).toBe(5);
    expect(d.alertas.some((a) => a.includes('2 prospectos'))).toBe(true);
  });
});
