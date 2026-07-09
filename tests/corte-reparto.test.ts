/**
 * Logiclean Ruta — Tests: motor de dominio del corte por reparto (H-20, Inc 7.1)
 *
 * Los 3 casos son los obligatorios del handoff (HANDOFF-code-corte-reparto-
 * cimiento-inc7_1-7_2.md), tomados literal de la definición del modelo delta
 * v1.4 (modelo-datos-v1_4-corte-reparto.md):
 *   CASO-1: camino feliz, ambos vendedores en positivo, cuadra exacto.
 *   CASO-2: La Moderna topada + vendedor en negativo (aserción de identidad).
 *   CASO-3: agnóstico al número de vendedores — N=1 (T=V, sin reparto).
 *
 * Además, dos casos no obligatorios que cubren reglas "no negociables" del
 * modelo que los 3 casos anteriores no ejercitan:
 *   R9: cobro_cxc_vieja no cuenta como ingreso, salda arrastre entrante.
 *   Conservación: la liquidación mueve exactamente lo que dice la posición
 *     de cada actor (ni pierde ni crea dinero).
 */

import { describe, it, expect } from 'vitest';
import { calcularCorte } from '../src/domain/corte';
import type { CorteEntrada } from '../src/domain/corte';

describe('calcularCorte — corte por reparto (H-20)', () => {
  it('CASO-1: camino feliz, ambos positivos, cuadra exacto', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'A',
          efectivo_cobrado_neto: 5000,
          transfer_cobrado_neto: 3000,
          cxc_nueva: 2000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
        {
          vendedor_id: 'B',
          efectivo_cobrado_neto: 4000,
          transfer_cobrado_neto: 4000,
          cxc_nueva: 6000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
      ],
      negocio: { adeudo_la_moderna: 8000, backoffice_pendiente: 1000, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);

    expect(salida.v_remanente).toBe(15000);
    expect(salida.t_por_vendedor).toBe(7500);

    const a = salida.por_vendedor.find((p) => p.vendedor_id === 'A')!;
    expect(a.posicion_objetivo).toBe(5500);
    expect(a.efectivo_entregado).toBe(5500);
    expect(a.saldo_vendedor_cierre).toBe(0);

    const b = salida.por_vendedor.find((p) => p.vendedor_id === 'B')!;
    expect(b.posicion_objetivo).toBe(1500);
    expect(b.efectivo_entregado).toBe(1500);
    expect(b.saldo_vendedor_cierre).toBe(0);

    expect(salida.saldo_moderna_cierre).toBe(0);
    expect(salida.alertas).toHaveLength(0);
  });

  it('CASO-2: La Moderna topada + vendedor en negativo (identidad de control)', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'A',
          efectivo_cobrado_neto: 6000,
          transfer_cobrado_neto: 2000,
          cxc_nueva: 1000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
        {
          vendedor_id: 'B',
          efectivo_cobrado_neto: 1000,
          transfer_cobrado_neto: 1000,
          cxc_nueva: 12000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
      ],
      negocio: { adeudo_la_moderna: 8000, backoffice_pendiente: 1000, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);

    expect(salida.v_remanente).toBe(14000);
    expect(salida.t_por_vendedor).toBe(7000);

    const a = salida.por_vendedor.find((p) => p.vendedor_id === 'A')!;
    expect(a.posicion_objetivo).toBe(6000);
    expect(a.efectivo_entregado).toBe(6000);
    expect(a.saldo_vendedor_cierre).toBe(0);

    const b = salida.por_vendedor.find((p) => p.vendedor_id === 'B')!;
    expect(b.posicion_objetivo).toBe(-5000);
    expect(b.efectivo_entregado).toBe(0);
    expect(b.saldo_vendedor_cierre).toBe(-5000);

    expect(salida.disponible_obligaciones).toBe(4000);
    expect(salida.saldo_moderna_cierre).toBe(5000);

    // Aserción de identidad (regla 4): el faltante de La Moderna es
    // exactamente la suma de las posiciones negativas — el mismo dinero
    // visto desde dos extremos.
    const faltante = salida.saldo_moderna_cierre - entrada.negocio.saldo_moderna_apertura;
    const sumaPosicionesNegativas = salida.por_vendedor
      .filter((p) => p.posicion_objetivo < 0)
      .reduce((acc, p) => acc + Math.abs(p.posicion_objetivo), 0);
    expect(faltante).toBe(sumaPosicionesNegativas);

    expect(salida.alertas).toContainEqual({ tipo: 'la_moderna_topada', faltante: 5000 });
    expect(salida.alertas).toContainEqual({ tipo: 'vendedor_negativo', vendedor_id: 'B', monto: -5000 });
  });

  it('CASO-3: agnóstico al número de vendedores — N=1 (T=V, sin reparto)', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'A',
          efectivo_cobrado_neto: 5000,
          transfer_cobrado_neto: 2000,
          cxc_nueva: 1000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
      ],
      negocio: { adeudo_la_moderna: 3000, backoffice_pendiente: 500, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);

    expect(salida.v_remanente).toBe(4500);
    expect(salida.t_por_vendedor).toBe(4500); // N=1 ⇒ T = V

    const a = salida.por_vendedor[0];
    expect(a.posicion_objetivo).toBe(3500);
    expect(a.efectivo_entregado).toBe(3500);
    expect(a.saldo_vendedor_cierre).toBe(0);

    expect(salida.saldo_moderna_cierre).toBe(0);
    expect(salida.alertas).toHaveLength(0);
  });

  it('R9 (no negociable): cobro_cxc_vieja no es ingreso — solo salda el arrastre entrante', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'A',
          efectivo_cobrado_neto: 5000,
          transfer_cobrado_neto: 2000,
          cxc_nueva: 1000,
          // Cobra 800 de una CxC de un corte anterior: no debe sumar a
          // ventas_periodo/V/T, solo debe saldar su arrastre negativo.
          cobro_cxc_vieja: 800,
          saldo_vendedor_apertura: -800,
        },
      ],
      negocio: { adeudo_la_moderna: 3000, backoffice_pendiente: 500, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);

    // Mismo V, T y posición que CASO-3: el cobro de CxC vieja no entra al cálculo.
    expect(salida.v_remanente).toBe(4500);
    expect(salida.t_por_vendedor).toBe(4500);
    const a = salida.por_vendedor[0];
    expect(a.posicion_objetivo).toBe(3500);
    expect(a.efectivo_entregado).toBe(3500);

    // El arrastre de -800 queda saldado por el cobro de 800; la posición de
    // este periodo se liquidó completa (0), así que el cierre es 0.
    expect(a.saldo_vendedor_cierre).toBe(0);
  });

  it('conservación: la liquidación mueve exactamente lo que cada actor debe/recibe', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'A',
          efectivo_cobrado_neto: 6000,
          transfer_cobrado_neto: 2000,
          cxc_nueva: 1000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
        {
          vendedor_id: 'B',
          efectivo_cobrado_neto: 1000,
          transfer_cobrado_neto: 1000,
          cxc_nueva: 12000,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
        },
      ],
      negocio: { adeudo_la_moderna: 8000, backoffice_pendiente: 1000, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);

    // Cada movimiento sale de la bolsa (efectivo/transferencia) del vendedor
    // origen — nunca excede lo que ese vendedor tenía en esa forma de pago.
    const porVendedor = new Map(entrada.vendedores.map((v) => [v.vendedor_id, v]));
    const gastadoPorFormaYVendedor = new Map<string, number>();
    for (const m of salida.liquidacion) {
      expect(m.origen_tipo).toBe('vendedor');
      const key = `${m.origen_vendedor_id}:${m.forma_pago}`;
      gastadoPorFormaYVendedor.set(key, (gastadoPorFormaYVendedor.get(key) ?? 0) + m.monto);
    }
    for (const [key, gastado] of gastadoPorFormaYVendedor) {
      const [vendedorId, forma] = key.split(':');
      const v = porVendedor.get(vendedorId)!;
      const disponible = forma === 'efectivo' ? v.efectivo_cobrado_neto : v.transfer_cobrado_neto;
      expect(gastado).toBeLessThanOrEqual(disponible);
    }

    // La Moderna recibe exactamente lo pagado (adeudo − faltante).
    const recibidoLaModerna = salida.liquidacion
      .filter((m) => m.destino_tipo === 'la_moderna')
      .reduce((acc, m) => acc + m.monto, 0);
    const faltante = salida.saldo_moderna_cierre - entrada.negocio.saldo_moderna_apertura;
    expect(recibidoLaModerna).toBe(entrada.negocio.adeudo_la_moderna - faltante);

    // Backoffice se paga completo (regla 4: solo La Moderna se topa).
    const recibidoBackoffice = salida.liquidacion
      .filter((m) => m.destino_tipo === 'backoffice')
      .reduce((acc, m) => acc + m.monto, 0);
    expect(recibidoBackoffice).toBe(entrada.negocio.backoffice_pendiente);
  });
});
