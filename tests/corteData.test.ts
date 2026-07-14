/**
 * Logiclean Ruta — Tests: corteData (periodo en curso del dashboard)
 *
 * Regresión: una venta registrada el MISMO día calendario en que se confirmó
 * el corte de negocio (pero después de la hora exacta de confirmación) debe
 * seguir contando en el periodo en curso. Antes del fix, `ultimoPeriodoFin`
 * + `enRango` comparaban solo por fecha calendario con `>` estricto: como el
 * `periodo_fin` del corte recién confirmado es HOY, ninguna venta de hoy
 * podía ser "mayor" que hoy — la venta quedaba fuera del dashboard para
 * siempre (caso real: Eduardo, ventas hechas después de confirmar el corte
 * del día mostraban $0 en el panel del gerente).
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';

import { cargarInsumosCorte, ultimoInstanteCorte, ultimoPeriodoFin } from '../src/lib/corteData';
import { db } from '../src/db/index';
import type { Corte, Venta } from '../src/db/schema';

const VENDEDOR = 'eduardo-1';

const corteBase: Omit<Corte, 'id' | 'periodo_fin' | 'fecha_generado'> = {
  periodo_inicio: null,
  estado: 'confirmado',
  n_vendedores: 1,
  ventas_periodo: 0,
  adeudo_la_moderna: 0,
  backoffice_pendiente: 0,
  obligaciones_total: 0,
  pool_liquido: 0,
  v_remanente: 0,
  t_por_vendedor: 0,
  saldo_moderna_apertura: 0,
  saldo_moderna_cierre: 0,
  snapshot: {},
};

const venta = (overrides: Partial<Venta>): Venta => ({
  id: overrides.id ?? 'venta-1',
  vendedor_id: VENDEDOR,
  cliente_id: 'cliente-1',
  fecha: overrides.fecha ?? '2026-07-14T00:00:00.000Z',
  requiere_factura: false,
  total: overrides.total ?? 0,
});

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('corteData — periodo en curso tras un corte confirmado el mismo día', () => {
  it('incluye una venta hecha DESPUÉS del instante de confirmación del corte, aunque sea el mismo día calendario', async () => {
    await db.corte.add({
      ...corteBase,
      id: 'corte-1',
      periodo_fin: '2026-07-14',
      fecha_generado: '2026-07-14T03:01:43.746Z',
    });

    // Venta antes de confirmar el corte: ya debería estar cerrada, no cuenta en el periodo en curso.
    await db.venta.add(venta({ id: 'venta-antes', fecha: '2026-07-14T02:26:23.531Z', total: 570 }));
    // Venta después de confirmar el corte, mismo día: es la que se perdía.
    await db.venta.add(venta({ id: 'venta-despues', fecha: '2026-07-14T03:06:57.248Z', total: 875 }));

    const inicioInstante = await ultimoInstanteCorte();
    const insumos = await cargarInsumosCorte(VENDEDOR, inicioInstante, '2026-07-14');

    expect(insumos.ventas.map((v) => v.total)).toEqual([875]);
  });

  it('ultimoPeriodoFin (fecha calendario) sigue disponible para mostrar/persistir el periodo, sin usarse ya como corte del filtro', async () => {
    await db.corte.add({
      ...corteBase,
      id: 'corte-1',
      periodo_fin: '2026-07-14',
      fecha_generado: '2026-07-14T03:01:43.746Z',
    });

    expect(await ultimoPeriodoFin()).toBe('2026-07-14');
    expect(await ultimoInstanteCorte()).toBe('2026-07-14T03:01:43.746Z');
  });

  it('sin cortes previos, incluye todas las ventas hasta hoy (periodo abierto)', async () => {
    await db.venta.add(venta({ id: 'venta-1', fecha: '2026-07-01T10:00:00.000Z', total: 100 }));

    const inicioInstante = await ultimoInstanteCorte();
    expect(inicioInstante).toBe('');

    const insumos = await cargarInsumosCorte(VENDEDOR, inicioInstante, '2026-07-14');
    expect(insumos.ventas.map((v) => v.total)).toEqual([100]);
  });
});
