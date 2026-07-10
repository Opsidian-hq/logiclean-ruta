/**
 * Logiclean Ruta — Corte semanal (H-10, Inc 3 → reescrito Inc 6.5)
 *
 * Cuadra al vendedor con su ruta y a Logiclean con La Moderna:
 *  - Bolsas del vendedor por forma de pago, **netas de gastos de ruta**:
 *      efectivo  = cobros efectivo  − gastos ruta efectivo
 *      banco     = cobros transfer. − gastos ruta transferencia
 *  - Cartera (crédito) = ventas − cobros.
 *  - Gastos de **backoffice** = salidas de caja del negocio (no tocan bolsas).
 *  - Reconciliación con La Moderna por **consumo real**: adeudo =
 *    (recibido − devuelto) × precio_preferencial (ADR-0009). Esta fórmula NO
 *    cambió en 6.5 — ya era así desde Inc 3. Lo que sí cambió:
 *      · Se retiró `inventarioBidones` (traducía el inventario del vehículo a
 *        bidones vía `factor_conversion`): ADR-0008 prohíbe el factor en el
 *        cuadre del corte. `lib/conversion.ts` se conserva intacto para
 *        planeación (Inc 7), simplemente ya no se invoca aquí.
 *      · Se agrega el **inventario de bodega** (granel estimado en litros +
 *        presentaciones envasadas/piezas) — lo que sí pertenece al corte
 *        según H-10, en vez del inventario del vehículo.
 *      · Se agrega la **identidad de control** (ADR-0009): para químicos,
 *        recibido − devuelto debe igualar los bidones abiertos del periodo
 *        (envasado). Si no cuadra, es una alerta — no bloquea el cierre.
 *
 * `calcularCorte` es **pura** (recibe datos ya acotados al periodo y al
 * vendedor, salvo bodega que es estado actual de la empresa): es la pieza
 * que se valida contra el cuaderno real (riesgo T8) y que resalta
 * descuadres antes de cerrar (riesgo T10). `generarCorte` registra el evento
 * de cierre `CORTE` que delimita el periodo.
 */

import { adeudoLaModerna } from './suministro';
import type { ReconciliacionModerna } from './suministro';
import type {
  Venta,
  Cobro,
  Gasto,
  Envasado,
  Presentacion,
  SuministroLaModerna,
  ProductoBase,
  InventarioBodegaBase,
  InventarioBodegaPresentacion,
} from '../db/schema';

const round2 = (n: number) => Math.round(n * 100) / 100;

// Tolerancia de la identidad de control: solo absorbe error de punto
// flotante. recibido/devuelto/bidones_abiertos son cantidades DISCRETAS
// (bidones enteros), no hay redondeo "de negocio" que aplicar aquí — la
// fricción de captura (T13) se resuelve con un flujo de recepción/envasado
// simple, no relajando esta identidad.
const EPSILON_IDENTIDAD = 0.01;

// ── Tipos del resultado ───────────────────────────────────────

/** Una bolsa (efectivo o transferencia), neta de gastos de ruta. */
export interface Bolsa {
  cobrado: number;
  gastos: number;
  /** cobrado − gastos. Negativo = descuadre (gastos exceden cobranza). */
  neto: number;
}

/** Granel estimado en bodega (litros), por producto base. */
export interface BodegaGranelSnapshot {
  producto_base_id: string;
  nombre: string;
  litros: number;
}

/** Presentación vendible en bodega (químico envasado o pieza), por presentación. */
export interface BodegaPresentacionSnapshot {
  presentacion_id: string;
  nombre: string;
  cantidad: number;
}

/** Inventario de bodega al momento del corte (H-10). No incluye bidones
 * sellados sin abrir: son consignación de La Moderna, no inventario de
 * Logiclean (ADR-0010). */
export interface BodegaSnapshot {
  granel: BodegaGranelSnapshot[];
  presentaciones: BodegaPresentacionSnapshot[];
}

/** Identidad de control por producto químico (ADR-0009): recibido − devuelto
 * debe igualar los bidones abiertos del periodo (envasado). */
export interface IdentidadControlProducto {
  producto_base_id: string;
  nombre: string;
  recibido: number;
  devuelto: number;
  bidonesAbiertos: number;
  /** (recibido − devuelto) − bidonesAbiertos. */
  diferencia: number;
  cuadra: boolean;
}

export interface CorteSnapshot {
  ventasTotal: number;
  cobradoTotal: number;
  /** ventas − cobros (≥0): crédito vivo de la cartera. */
  saldoCartera: number;
  /** Bolsas del vendedor, netas de gastos de ruta. */
  bolsas: { efectivo: Bolsa; transferencia: Bolsa };
  /** Gastos de backoffice: salida de caja del negocio (no toca bolsas). */
  gastosBackoffice: number;
  /** Inventario de bodega al cierre (H-10). */
  bodega: BodegaSnapshot;
  /** Reconciliación por consumo real con La Moderna (ADR-0009). */
  moderna: ReconciliacionModerna;
  /** Identidad de control por producto químico (ADR-0009). */
  identidadControl: IdentidadControlProducto[];
  /** Descuadres a resaltar antes de cerrar (T10). */
  alertas: string[];
}

// ── Entradas del cálculo (ya acotadas a periodo + vendedor, salvo bodega
// que es el estado actual de la empresa, no un delta del periodo) ────────

export interface CalcularCorteInput {
  ventas: Pick<Venta, 'total'>[];
  cobros: Pick<Cobro, 'monto' | 'forma_pago'>[];
  gastos: Pick<Gasto, 'tipo' | 'forma_pago' | 'monto'>[];
  suministros: Pick<
    SuministroLaModerna,
    'producto_base_id' | 'cantidad_recibida' | 'cantidad_devuelta'
  >[];
  /** Envasados del periodo (para la identidad de control). */
  envasados: Pick<Envasado, 'producto_base_id' | 'bidones_abiertos'>[];
  /** Estado actual de bodega (no acotado al periodo). */
  bodegaBase: Pick<InventarioBodegaBase, 'producto_base_id' | 'litros_granel_estimado'>[];
  bodegaPresentaciones: Pick<InventarioBodegaPresentacion, 'presentacion_id' | 'cantidad'>[];
  presentaciones: Pick<Presentacion, 'id' | 'nombre'>[];
  productos: Pick<ProductoBase, 'id' | 'nombre' | 'precio_preferencial' | 'unidad_compra'>[];
}

// ── Bodega (H-10) ──────────────────────────────────────────────

function calcularBodegaSnapshot(
  bodegaBase: CalcularCorteInput['bodegaBase'],
  bodegaPresentaciones: CalcularCorteInput['bodegaPresentaciones'],
  productos: Pick<ProductoBase, 'id' | 'nombre'>[],
  presentaciones: Pick<Presentacion, 'id' | 'nombre'>[]
): BodegaSnapshot {
  const prodPorId = new Map(productos.map((p) => [p.id, p]));
  const presPorId = new Map(presentaciones.map((p) => [p.id, p]));

  const granel = bodegaBase
    .filter((b) => b.litros_granel_estimado !== 0)
    .map((b) => ({
      producto_base_id: b.producto_base_id,
      nombre: prodPorId.get(b.producto_base_id)?.nombre ?? b.producto_base_id,
      litros: round2(b.litros_granel_estimado),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const presentacionesOut = bodegaPresentaciones
    .filter((p) => p.cantidad !== 0)
    .map((p) => ({
      presentacion_id: p.presentacion_id,
      nombre: presPorId.get(p.presentacion_id)?.nombre ?? p.presentacion_id,
      cantidad: round2(p.cantidad),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { granel, presentaciones: presentacionesOut };
}

// ── Identidad de control (ADR-0009) ────────────────────────────

function calcularIdentidadControl(
  suministros: CalcularCorteInput['suministros'],
  envasados: CalcularCorteInput['envasados'],
  productos: Pick<ProductoBase, 'id' | 'nombre' | 'unidad_compra'>[]
): IdentidadControlProducto[] {
  const prodPorId = new Map(productos.map((p) => [p.id, p]));
  const acc = new Map<string, { recibido: number; devuelto: number; bidonesAbiertos: number }>();

  const entradaDe = (producto_base_id: string) =>
    acc.get(producto_base_id) ?? { recibido: 0, devuelto: 0, bidonesAbiertos: 0 };

  for (const s of suministros) {
    const prod = prodPorId.get(s.producto_base_id);
    if (!prod || prod.unidad_compra !== 'bidon') continue; // solo químicos
    const cur = entradaDe(s.producto_base_id);
    cur.recibido += s.cantidad_recibida;
    cur.devuelto += s.cantidad_devuelta;
    acc.set(s.producto_base_id, cur);
  }

  for (const e of envasados) {
    const prod = prodPorId.get(e.producto_base_id);
    if (!prod || prod.unidad_compra !== 'bidon') continue;
    const cur = entradaDe(e.producto_base_id);
    cur.bidonesAbiertos += e.bidones_abiertos;
    acc.set(e.producto_base_id, cur);
  }

  const out: IdentidadControlProducto[] = [];
  for (const [producto_base_id, { recibido, devuelto, bidonesAbiertos }] of acc) {
    const nombre = prodPorId.get(producto_base_id)?.nombre ?? producto_base_id;
    const diferencia = round2(recibido - devuelto - bidonesAbiertos);
    out.push({
      producto_base_id,
      nombre,
      recibido: round2(recibido),
      devuelto: round2(devuelto),
      bidonesAbiertos: round2(bidonesAbiertos),
      diferencia,
      cuadra: Math.abs(diferencia) <= EPSILON_IDENTIDAD,
    });
  }

  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Cálculo puro ──────────────────────────────────────────────

export function calcularCorte(input: CalcularCorteInput): CorteSnapshot {
  const {
    ventas, cobros, gastos, suministros, envasados,
    bodegaBase, bodegaPresentaciones, presentaciones, productos,
  } = input;

  // Cobranza por bolsa.
  let cobEfectivo = 0;
  let cobTransfer = 0;
  for (const c of cobros) {
    if (c.forma_pago === 'efectivo') cobEfectivo += c.monto;
    else cobTransfer += c.monto;
  }

  // Gastos de ruta por bolsa + gastos de backoffice.
  let gasRutaEfectivo = 0;
  let gasRutaTransfer = 0;
  let gastosBackoffice = 0;
  for (const g of gastos) {
    if (g.tipo === 'backoffice') {
      gastosBackoffice += g.monto;
    } else if (g.forma_pago === 'efectivo') {
      gasRutaEfectivo += g.monto;
    } else {
      gasRutaTransfer += g.monto;
    }
  }

  const efectivo: Bolsa = {
    cobrado: round2(cobEfectivo),
    gastos: round2(gasRutaEfectivo),
    neto: round2(cobEfectivo - gasRutaEfectivo),
  };
  const transferencia: Bolsa = {
    cobrado: round2(cobTransfer),
    gastos: round2(gasRutaTransfer),
    neto: round2(cobTransfer - gasRutaTransfer),
  };

  const ventasTotal = round2(ventas.reduce((s, v) => s + v.total, 0));
  const cobradoTotal = round2(cobEfectivo + cobTransfer);
  const saldoCartera = round2(Math.max(0, ventasTotal - cobradoTotal));

  const bodega = calcularBodegaSnapshot(bodegaBase, bodegaPresentaciones, productos, presentaciones);

  const moderna = adeudoLaModerna(suministros, productos);
  moderna.porProducto = moderna.porProducto.map((p) => ({ ...p, adeudo: round2(p.adeudo) }));
  moderna.total = round2(moderna.total);

  const identidadControl = calcularIdentidadControl(suministros, envasados, productos);

  // Descuadres a resaltar (T10).
  const alertas: string[] = [];
  if (efectivo.neto < 0) {
    alertas.push('La bolsa de efectivo es negativa: los gastos en efectivo superan lo cobrado.');
  }
  if (transferencia.neto < 0) {
    alertas.push('La bolsa de transferencias es negativa: los gastos por transferencia superan lo cobrado.');
  }
  if (saldoCartera > 0) {
    alertas.push(`Queda crédito por cobrar: ${saldoCartera.toFixed(2)} en cartera.`);
  }
  for (const ic of identidadControl) {
    if (ic.cuadra) continue;
    const lado = ic.diferencia > 0
      ? 'puede faltar registrar un envasado, o sobra recibido/falta devuelto'
      : 'puede faltar registrar un recibido/devuelto, o hay más bidones abiertos de los esperados';
    alertas.push(
      `${ic.nombre}: la identidad de control no cuadra (recibido−devuelto=${round2(ic.recibido - ic.devuelto)}, bidones abiertos=${ic.bidonesAbiertos}) — ${lado}.`
    );
  }
  for (const p of bodega.presentaciones) {
    if (p.cantidad < 0) {
      alertas.push(`Inventario de bodega negativo en ${p.nombre}: revisar sobreventa.`);
    }
  }

  return {
    ventasTotal,
    cobradoTotal,
    saldoCartera,
    bolsas: { efectivo, transferencia },
    gastosBackoffice: round2(gastosBackoffice),
    bodega,
    moderna,
    identidadControl,
    alertas,
  };
}

