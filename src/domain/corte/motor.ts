/**
 * Logiclean Ruta — Corte por reparto (H-20, Inc 7.1)
 *
 * Motor de dominio puro: dados los insumos de un periodo, calcula el
 * resultado del corte de negocio según las reglas 1-6 de
 * modelo-datos-v1_4-corte-reparto.md (ADR-0011). Sin UI, sin Supabase —
 * aislado de React/Ionic a propósito, para que sea testeable de forma
 * independiente (PRD delta v1.4 §6).
 */

import type {
  CorteEntrada,
  CorteSalida,
  Alerta,
  LiquidacionMovimiento,
  VendedorSalida,
} from './types';

interface PosicionInterna {
  vendedor_id: string;
  bolsa: number;
  efectivo: number;
  transferencia: number;
  posicion_objetivo: number;
  cobro_cxc_vieja: number;
  saldo_vendedor_apertura: number;
  /**
   * Física de efectivo (Inc 7.5.2): lo que el vendedor realmente tiene en
   * mano hoy, descontando abonos ya registrados (`negocio_a_vendedor` +
   * `vendedor_a_negocio`) desde el corte anterior — a diferencia de
   * `bolsa`/`efectivo`/`transferencia`/`posicion_objetivo`, que siguen siendo
   * la meta justa/cobranza cruda y no cambian por un retiro anticipado.
   */
  bolsa_fisica: number;
  efectivo_fisico: number;
  transferencia_fisico: number;
  objetivo_neto: number;
  abono_total: number;
}

export function calcularCorte(entrada: CorteEntrada): CorteSalida {
  const { vendedores, negocio } = entrada;
  const n = vendedores.length;

  const ventas_periodo = vendedores.reduce(
    (acc, v) => acc + v.efectivo_cobrado_neto + v.transfer_cobrado_neto + v.cxc_nueva,
    0
  );
  const pool_liquido_bruto = vendedores.reduce(
    (acc, v) => acc + v.efectivo_cobrado_neto + v.transfer_cobrado_neto,
    0
  );
  // Efectivo/transferencia que ya salió de la bolsa colectiva por abonos
  // "negocio_a_vendedor" (Inc 7.5.2) — a diferencia de "vendedor_a_negocio",
  // que reubica cash dentro del pool pero nunca lo saca de él.
  const abono_retirado_total = vendedores.reduce(
    (acc, v) => acc + (v.abono_ya_retirado_efectivo ?? 0) + (v.abono_ya_retirado_transferencia ?? 0),
    0
  );
  const pool_liquido = pool_liquido_bruto - abono_retirado_total;

  const obligaciones_total = negocio.adeudo_la_moderna + negocio.backoffice_pendiente;
  const v_remanente = ventas_periodo - obligaciones_total;
  // Regla 3, PRD §6: T = V / N sin ramas que asuman un N fijo (N=1 ⇒ T = V).
  // Usa ventas_periodo (crudo, sin ajustar por abonos): el retiro anticipado
  // de un vendedor no debe reducir la parte justa de los demás.
  const t_por_vendedor = v_remanente / n;

  const posiciones: PosicionInterna[] = vendedores.map((v) => {
    const bolsa = v.efectivo_cobrado_neto + v.transfer_cobrado_neto;
    const posicion_objetivo = t_por_vendedor - v.cxc_nueva;
    const abonoRetiradoEfectivo = v.abono_ya_retirado_efectivo ?? 0;
    const abonoRetiradoTransferencia = v.abono_ya_retirado_transferencia ?? 0;
    const abonoEntregadoEfectivo = v.abono_ya_entregado_efectivo ?? 0;
    const abonoEntregadoTransferencia = v.abono_ya_entregado_transferencia ?? 0;
    const abono_total =
      abonoRetiradoEfectivo + abonoRetiradoTransferencia + abonoEntregadoEfectivo + abonoEntregadoTransferencia;
    return {
      vendedor_id: v.vendedor_id,
      bolsa,
      efectivo: v.efectivo_cobrado_neto,
      transferencia: v.transfer_cobrado_neto,
      posicion_objetivo,
      cobro_cxc_vieja: v.cobro_cxc_vieja,
      saldo_vendedor_apertura: v.saldo_vendedor_apertura,
      bolsa_fisica: bolsa - abonoRetiradoEfectivo - abonoRetiradoTransferencia - abonoEntregadoEfectivo - abonoEntregadoTransferencia,
      efectivo_fisico: Math.max(v.efectivo_cobrado_neto - abonoRetiradoEfectivo - abonoEntregadoEfectivo, 0),
      transferencia_fisico: Math.max(v.transfer_cobrado_neto - abonoRetiradoTransferencia - abonoEntregadoTransferencia, 0),
      objetivo_neto: Math.max(posicion_objetivo - abonoRetiradoEfectivo - abonoRetiradoTransferencia, 0),
      abono_total,
    };
  });

  // Regla 4: los vendedores en positivo reservan su parte ANTES de pagar
  // obligaciones — no se compara el líquido total contra las obligaciones.
  // Usa objetivo_neto (meta ya descontando lo que el vendedor retiró
  // anticipado de SU PROPIA parte) y pool_liquido ya ajustado — así un
  // faltante real hacia La Moderna por un retiro anticipado no queda oculto.
  const reservado_positivos = posiciones.reduce(
    (acc, p) => acc + p.objetivo_neto,
    0
  );
  const disponible_obligaciones = pool_liquido - reservado_positivos;

  const faltante = Math.max(obligaciones_total - disponible_obligaciones, 0);
  const saldo_moderna_cierre = negocio.saldo_moderna_apertura + faltante;

  // Backoffice se paga completo primero; La Moderna absorbe el tope (regla 4:
  // "el pago a La Moderna se topa a la caja disponible").
  const pagado_backoffice = Math.min(negocio.backoffice_pendiente, Math.max(disponible_obligaciones, 0));
  const pagado_la_moderna = Math.max(disponible_obligaciones - pagado_backoffice, 0);

  const por_vendedor: VendedorSalida[] = posiciones.map((p) => ({
    vendedor_id: p.vendedor_id,
    posicion_objetivo: p.posicion_objetivo,
    efectivo_entregado: Math.max(p.posicion_objetivo, 0),
    // Regla 5: apertura + cobro de CxC vieja (salda arrastre, R9) + lo que
    // este corte no pudo liquidar (min(posicion_objetivo, 0)).
    saldo_vendedor_cierre:
      p.saldo_vendedor_apertura + p.cobro_cxc_vieja + Math.min(p.posicion_objetivo, 0),
  }));

  const liquidacion = generarLiquidacion(posiciones, pagado_la_moderna, pagado_backoffice);

  const alertas: Alerta[] = [];
  if (faltante > 0) {
    alertas.push({ tipo: 'la_moderna_topada', faltante });
  }
  if (negocio.saldo_moderna_apertura !== 0) {
    alertas.push({ tipo: 'arrastre_entrante' });
  }
  for (const p of posiciones) {
    if (p.posicion_objetivo < 0) {
      alertas.push({ tipo: 'vendedor_negativo', vendedor_id: p.vendedor_id, monto: p.posicion_objetivo });
    }
    if (p.saldo_vendedor_apertura !== 0) {
      alertas.push({ tipo: 'arrastre_entrante', vendedor_id: p.vendedor_id });
    }
    // Reclamó/entregó (Inc 7.5.2) más de lo que en realidad trajo de bolsa
    // esta semana — probable error de captura del abono; bloquea el cierre
    // (ver CorteRepartoPage) en vez de generar una instrucción no ejecutable.
    if (p.abono_total > p.bolsa) {
      alertas.push({ tipo: 'abono_excede_bolsa', vendedor_id: p.vendedor_id, monto: p.abono_total - p.bolsa });
    }
  }

  return {
    ventas_periodo,
    obligaciones_total,
    pool_liquido,
    v_remanente,
    t_por_vendedor,
    disponible_obligaciones,
    por_vendedor,
    saldo_moderna_cierre,
    liquidacion,
    alertas,
  };
}

/**
 * Pasada de liquidación (Paso 5, ADR-0011): movimientos mínimos que llevan a
 * cada actor de lo que tiene en mano a su posición objetivo.
 *
 * Deudores = vendedores cuya bolsa FÍSICA (Inc 7.5.2: cruda menos lo que ya
 * retiró o entregó por abono desde el corte anterior) excede lo que les
 * queda por reservar de su objetivo (incluye a quien tiene posición
 * negativa: se le entrega 0, así que debe su bolsa física completa).
 * Acreedores = La Moderna, backoffice y vendedores cuya bolsa CRUDA no
 * alcanza su objetivo crudo, en ese orden de prioridad — el lado acreedor no
 * se ajusta por abonos: un retiro anticipado de un vendedor nunca debe
 * generar una instrucción de pagarle MÁS desde el pool. Cada deudor drena
 * primero su efectivo físico y luego su transferencia física (preferencia
 * efectivo→transferencia, ADR-0011) contra el acreedor vigente, con un
 * puntero que solo avanza cuando el acreedor actual queda saldado — así
 * ningún origen-destino-forma se fragmenta en más de una fila.
 */
function generarLiquidacion(
  posiciones: PosicionInterna[],
  pagado_la_moderna: number,
  pagado_backoffice: number
): LiquidacionMovimiento[] {
  const movimientos: LiquidacionMovimiento[] = [];

  const acreedores: { tipo: 'la_moderna' | 'backoffice' | 'vendedor'; vendedor_id?: string; restante: number }[] = [];
  if (pagado_la_moderna > 0) acreedores.push({ tipo: 'la_moderna', restante: pagado_la_moderna });
  if (pagado_backoffice > 0) acreedores.push({ tipo: 'backoffice', restante: pagado_backoffice });
  for (const p of posiciones) {
    const necesita = p.posicion_objetivo - p.bolsa;
    if (necesita > 0) acreedores.push({ tipo: 'vendedor', vendedor_id: p.vendedor_id, restante: necesita });
  }

  const deudores = posiciones
    .map((p) => ({
      vendedor_id: p.vendedor_id,
      efectivo_disponible: p.efectivo_fisico,
      transferencia_disponible: p.transferencia_fisico,
      debe: p.bolsa_fisica - p.objetivo_neto,
    }))
    .filter((d) => d.debe > 0);

  let acreedorIdx = 0;

  for (const deudor of deudores) {
    for (const forma_pago of ['efectivo', 'transferencia'] as const) {
      let disponible = Math.min(
        forma_pago === 'efectivo' ? deudor.efectivo_disponible : deudor.transferencia_disponible,
        deudor.debe
      );

      while (disponible > 0 && acreedorIdx < acreedores.length) {
        const acreedor = acreedores[acreedorIdx];
        const monto = Math.min(disponible, acreedor.restante);
        movimientos.push({
          origen_tipo: 'vendedor',
          origen_vendedor_id: deudor.vendedor_id,
          destino_tipo: acreedor.tipo,
          destino_vendedor_id: acreedor.tipo === 'vendedor' ? (acreedor.vendedor_id ?? null) : null,
          monto,
          forma_pago,
        });
        acreedor.restante -= monto;
        disponible -= monto;
        deudor.debe -= monto;
        if (acreedor.restante === 0) acreedorIdx += 1;
      }
    }
  }

  return movimientos;
}
