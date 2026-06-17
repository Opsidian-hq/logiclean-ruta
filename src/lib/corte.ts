/**
 * Logiclean Ruta — Corte semanal (H-10, Inc 3)
 *
 * Cuadra al vendedor con su ruta y a Logiclean con La Moderna:
 *  - Bolsas del vendedor por forma de pago, **netas de gastos de ruta**:
 *      efectivo  = cobros efectivo  − gastos ruta efectivo
 *      banco     = cobros transfer. − gastos ruta transferencia
 *  - Cartera (crédito) = ventas − cobros.
 *  - Gastos de **backoffice** = salidas de caja del negocio (no tocan bolsas).
 *  - Inventario del vehículo traducido a unidad de compra (vía factor).
 *  - Reconciliación venta-o-devolución con La Moderna.
 *
 * `calcularCorte` es **pura** (recibe datos ya acotados al periodo y al
 * vendedor): es la pieza que se valida contra el cuaderno real (riesgo T8) y
 * que resalta descuadres antes de cerrar (riesgo T10). `generarCorte` registra
 * el evento de cierre `CORTE` que delimita el periodo.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import { inventarioAUnidadCompra } from './conversion';
import { adeudoLaModerna } from './suministro';
import type { UnidadCompraPorProducto } from './conversion';
import type { ReconciliacionModerna } from './suministro';
import type {
  Venta,
  Cobro,
  Gasto,
  Presentacion,
  InventarioVehiculo,
  SuministroLaModerna,
  ProductoBase,
  Corte,
} from '../db/schema';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Tipos del resultado ───────────────────────────────────────

/** Una bolsa (efectivo o transferencia), neta de gastos de ruta. */
export interface Bolsa {
  cobrado: number;
  gastos: number;
  /** cobrado − gastos. Negativo = descuadre (gastos exceden cobranza). */
  neto: number;
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
  /** Inventario que queda en el vehículo, en unidad de compra (bidones). */
  inventarioBidones: UnidadCompraPorProducto[];
  /** Reconciliación venta-o-devolución con La Moderna. */
  moderna: ReconciliacionModerna;
  /** Descuadres a resaltar antes de cerrar (T10). */
  alertas: string[];
}

// ── Entradas del cálculo (ya acotadas a periodo + vendedor) ───

export interface CalcularCorteInput {
  ventas: Pick<Venta, 'total'>[];
  cobros: Pick<Cobro, 'monto' | 'forma_pago'>[];
  gastos: Pick<Gasto, 'tipo' | 'forma_pago' | 'monto'>[];
  inventario: Pick<InventarioVehiculo, 'presentacion_id' | 'cantidad'>[];
  presentaciones: Pick<Presentacion, 'id' | 'producto_base_id' | 'factor_conversion'>[];
  suministros: Pick<
    SuministroLaModerna,
    'producto_base_id' | 'cantidad_recibida' | 'cantidad_devuelta'
  >[];
  productos: Pick<ProductoBase, 'id' | 'nombre' | 'precio_preferencial'>[];
}

// ── Cálculo puro ──────────────────────────────────────────────

export function calcularCorte(input: CalcularCorteInput): CorteSnapshot {
  const { ventas, cobros, gastos, inventario, presentaciones, suministros, productos } = input;

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

  const inventarioBidones = inventarioAUnidadCompra(inventario, presentaciones).map((u) => ({
    producto_base_id: u.producto_base_id,
    unidades: round2(u.unidades),
  }));

  const moderna = adeudoLaModerna(suministros, productos);
  moderna.porProducto = moderna.porProducto.map((p) => ({ ...p, adeudo: round2(p.adeudo) }));
  moderna.total = round2(moderna.total);

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

  return {
    ventasTotal,
    cobradoTotal,
    saldoCartera,
    bolsas: { efectivo, transferencia },
    gastosBackoffice: round2(gastosBackoffice),
    inventarioBidones,
    moderna,
    alertas,
  };
}

// ── Registro del cierre ───────────────────────────────────────

export interface GenerarCorteInput extends CalcularCorteInput {
  vendedorId: string;
  /** Inicio del periodo (fin del corte anterior). ISO date. */
  periodoInicio: string;
  /** Fin del periodo. ISO date; por defecto hoy. */
  periodoFin?: string;
  /**
   * Lo realmente entregado por el vendedor. Si se omite, se asume el neto
   * calculado de cada bolsa (entrega exacta, sin descuadre).
   */
  efectivoEntregado?: number;
  transferenciasEntregadas?: number;
}

export interface GenerarCorteResult {
  corte: Corte;
  snapshot: CorteSnapshot;
}

/**
 * Calcula y **registra** el corte como evento de cierre (`CORTE`), con su
 * snapshot completo. Escritura local + cola de sync (gerente, RLS).
 */
export async function generarCorte(input: GenerarCorteInput): Promise<GenerarCorteResult> {
  const {
    vendedorId,
    periodoInicio,
    periodoFin = new Date().toISOString().slice(0, 10),
    efectivoEntregado,
    transferenciasEntregadas,
  } = input;

  if (!vendedorId) throw new Error('Falta el vendedor del corte.');
  if (!periodoInicio) throw new Error('Falta el inicio del periodo.');

  const snapshot = calcularCorte(input);

  const corte: Corte = {
    id: generateUUID(),
    vendedor_id: vendedorId,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    fecha_generado: new Date().toISOString(),
    efectivo_entregado: efectivoEntregado ?? snapshot.bolsas.efectivo.neto,
    transferencias_entregadas:
      transferenciasEntregadas ?? snapshot.bolsas.transferencia.neto,
    snapshot: snapshot as unknown as Record<string, unknown>,
  };

  await db.corte.put(corte);
  const item = await enqueueOperation(
    'corte',
    'upsert',
    corte as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);

  return { corte, snapshot };
}
