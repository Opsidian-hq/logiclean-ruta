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

// ── Inc 7.5.2: la liquidación descuenta el efectivo que un vendedor ya
// retiró/entregó por abono (abono_saldo_vendedor) antes de este corte ──────

describe('calcularCorte — física de efectivo tras un abono (Inc 7.5.2)', () => {
  it('regresión: sin campos de abono, pool_liquido es el bruto (idéntico a hoy)', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        { vendedor_id: 'A', efectivo_cobrado_neto: 5000, transfer_cobrado_neto: 3000, cxc_nueva: 2000, cobro_cxc_vieja: 0, saldo_vendedor_apertura: 0 },
        { vendedor_id: 'B', efectivo_cobrado_neto: 4000, transfer_cobrado_neto: 4000, cxc_nueva: 6000, cobro_cxc_vieja: 0, saldo_vendedor_apertura: 0 },
      ],
      negocio: { adeudo_la_moderna: 8000, backoffice_pendiente: 1000, saldo_moderna_apertura: 0 },
    };
    const salida = calcularCorte(entrada);
    expect(salida.pool_liquido).toBe(16000); // 5000+3000+4000+4000, sin ajustar
    expect(salida.alertas.some((a) => a.tipo === 'abono_excede_bolsa')).toBe(false);
  });

  // n=1, bolsa cruda=780 (efectivo), obligaciones=400, cxc_nueva=0 ⇒
  // t_por_vendedor=380=posicion_objetivo (caso de mano validado en el plan).
  const entradaBase = (abono: Partial<CorteEntrada['vendedores'][0]>): CorteEntrada => ({
    vendedores: [
      {
        vendedor_id: 'eduardo',
        efectivo_cobrado_neto: 780,
        transfer_cobrado_neto: 0,
        cxc_nueva: 0,
        cobro_cxc_vieja: 0,
        saldo_vendedor_apertura: 0,
        ...abono,
      },
    ],
    negocio: { adeudo_la_moderna: 400, backoffice_pendiente: 0, saldo_moderna_apertura: 0 },
  });

  it('retiro dentro de lo que le tocaba ($330 de $380): sin faltante, movimiento ejecutable', () => {
    const salida = calcularCorte(entradaBase({ abono_ya_retirado_efectivo: 330 }));

    expect(salida.pool_liquido).toBe(450); // 780 − 330
    expect(salida.disponible_obligaciones).toBe(400); // 450 − max(380−330,0)=450−50
    expect(salida.saldo_moderna_cierre).toBe(0); // sin faltante
    expect(salida.alertas.some((a) => a.tipo === 'abono_excede_bolsa')).toBe(false);

    // La instrucción pide exactamente $400 — ejecutable con los $450 que le
    // quedan físicamente (450−330 retirados ya = 780 originales).
    expect(salida.liquidacion).toEqual([
      { origen_tipo: 'vendedor', origen_vendedor_id: 'eduardo', destino_tipo: 'la_moderna', destino_vendedor_id: null, monto: 400, forma_pago: 'efectivo' },
    ]);
  });

  it('retiro que excede lo que le tocaba pero cabe en su bolsa física ($500 de $380): revela el faltante real', () => {
    const salida = calcularCorte(entradaBase({ abono_ya_retirado_efectivo: 500 }));

    expect(salida.pool_liquido).toBe(280); // 780 − 500
    expect(salida.disponible_obligaciones).toBe(280); // objetivo_neto = max(380−500,0) = 0
    expect(salida.saldo_moderna_cierre).toBe(120); // faltante real hacia La Moderna, hoy oculto
    expect(salida.alertas.some((a) => a.tipo === 'abono_excede_bolsa')).toBe(false); // 500 ≤ 780

    // Antes del fix la instrucción pedía $400 (no ejecutable, ya solo le
    // quedan $280 en mano); ahora pide exactamente lo físicamente disponible.
    expect(salida.liquidacion).toEqual([
      { origen_tipo: 'vendedor', origen_vendedor_id: 'eduardo', destino_tipo: 'la_moderna', destino_vendedor_id: null, monto: 280, forma_pago: 'efectivo' },
    ]);
  });

  it('reclama más de toda su bolsa física (900 de 780): bloquea con abono_excede_bolsa, sin movimientos negativos', () => {
    const salida = calcularCorte(entradaBase({ abono_ya_retirado_efectivo: 900 }));

    expect(salida.alertas).toContainEqual({ tipo: 'abono_excede_bolsa', vendedor_id: 'eduardo', monto: 120 });
    // Nadie puede cubrir un debe negativo/NaN: el deudor queda filtrado, sin
    // movimientos generados para él (ni para nadie, con n=1 y sin acreedores).
    expect(salida.liquidacion).toHaveLength(0);
    for (const m of salida.liquidacion) {
      expect(m.monto).toBeGreaterThan(0);
      expect(Number.isFinite(m.monto)).toBe(true);
    }
  });

  it('multi-vendedor: el abono de A nunca cambia lo que le toca a B', () => {
    const base: CorteEntrada = {
      vendedores: [
        { vendedor_id: 'A', efectivo_cobrado_neto: 6000, transfer_cobrado_neto: 2000, cxc_nueva: 1000, cobro_cxc_vieja: 0, saldo_vendedor_apertura: 0 },
        { vendedor_id: 'B', efectivo_cobrado_neto: 1000, transfer_cobrado_neto: 1000, cxc_nueva: 12000, cobro_cxc_vieja: 0, saldo_vendedor_apertura: 0 },
      ],
      negocio: { adeudo_la_moderna: 8000, backoffice_pendiente: 1000, saldo_moderna_apertura: 0 },
    };
    const conAbono: CorteEntrada = {
      ...base,
      vendedores: [{ ...base.vendedores[0], abono_ya_retirado_efectivo: 2000 }, base.vendedores[1]],
    };

    const salidaBase = calcularCorte(base);
    const salidaConAbono = calcularCorte(conAbono);

    const bBase = salidaBase.por_vendedor.find((p) => p.vendedor_id === 'B')!;
    const bConAbono = salidaConAbono.por_vendedor.find((p) => p.vendedor_id === 'B')!;
    expect(bConAbono).toEqual(bBase);
    expect(salidaConAbono.t_por_vendedor).toBe(salidaBase.t_por_vendedor);
  });

  it('dirección vendedor_a_negocio: entrega anticipada reduce el movimiento de hoy, no el faltante ni el pool', () => {
    const salidaBase = calcularCorte(entradaBase({}));
    const salidaConEntrega = calcularCorte(entradaBase({ abono_ya_entregado_efectivo: 100 }));

    // El pool y el faltante no se mueven: lo entregado nunca salió del pool,
    // solo cambió de manos antes de este corte.
    expect(salidaConEntrega.pool_liquido).toBe(salidaBase.pool_liquido);
    expect(salidaConEntrega.saldo_moderna_cierre).toBe(salidaBase.saldo_moderna_cierre);

    const movimientoBase = salidaBase.liquidacion.find((m) => m.destino_tipo === 'la_moderna')!.monto;
    const movimientoConEntrega = salidaConEntrega.liquidacion.find((m) => m.destino_tipo === 'la_moderna')!.monto;
    expect(movimientoConEntrega).toBe(movimientoBase - 100);
  });

  it('descuadre por forma de pago (abono de transferencia mayor a lo cobrado en esa forma): siempre drena completo, sin negativos', () => {
    const entrada: CorteEntrada = {
      vendedores: [
        {
          vendedor_id: 'eduardo',
          efectivo_cobrado_neto: 500,
          transfer_cobrado_neto: 500,
          cxc_nueva: 0,
          cobro_cxc_vieja: 0,
          saldo_vendedor_apertura: 0,
          // Reclama más transferencia de la que realmente cobró en esa forma
          // (piso en 0 en `transferencia_fisico`), pero el total (700) sigue
          // dentro de su bolsa combinada (1000).
          abono_ya_retirado_transferencia: 700,
        },
      ],
      negocio: { adeudo_la_moderna: 200, backoffice_pendiente: 0, saldo_moderna_apertura: 0 },
    };

    const salida = calcularCorte(entrada);
    expect(salida.alertas.some((a) => a.tipo === 'abono_excede_bolsa')).toBe(false);

    for (const m of salida.liquidacion) {
      expect(m.monto).toBeGreaterThan(0);
    }
    // debe=200 (bolsa_fisica 300 − objetivo_neto 100) queda drenado completo
    // desde efectivo_fisico (500) solo — el piso en 0 de transferencia_fisico
    // (por reclamar más transferencia de la cobrada) nunca deja un residual
    // sin cubrir, porque efectivo_fisico+transferencia_fisico siempre
    // alcanza `debe` cuando objetivo_neto ≥ 0 (max(x,0) por forma nunca
    // resta más que el combinado sin piso).
    const drenado = salida.liquidacion.reduce((s, m) => s + m.monto, 0);
    expect(drenado).toBe(200);
    expect(salida.liquidacion.every((m) => m.forma_pago === 'efectivo')).toBe(true);
  });
});
