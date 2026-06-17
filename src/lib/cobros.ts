/**
 * Logiclean Ruta — Cobranza en ruta (H-07, Flujo C)
 *
 * Registro de cobros sobre ventas ya existentes y derivación del saldo del
 * cliente. Reglas de negocio del handoff (`handoff-logiclean-cobranza.md`):
 *
 *  - **Venta a crédito = venta sin fila en COBRO.** No existe un tipo "crédito";
 *    el crédito se modela por ausencia de cobro.
 *  - **El saldo es siempre derivado** (ventas − cobros), nunca almacenado.
 *  - **Cada cobro conserva su propia `forma_pago`**, independiente de los demás
 *    cobros sobre la misma venta (un abono en efectivo, el siguiente en
 *    transferencia).
 *  - `requiere_factura × forma_pago` se resuelve en el modelo; aquí no se captura.
 *
 * Todo cobro se escribe local al instante y entra a la cola de sync con estado
 * `pendiente`. La app nunca bloquea la operación esperando al servidor.
 *
 * Este incremento sólo escribe la tabla `COBRO`; no toca la lógica del corte
 * (Inc 3) ni el dashboard (Inc 4).
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { Cobro, Venta } from '../db/schema';

export type FormaPago = 'efectivo' | 'transferencia';

// ── Helpers puros (sin BD) ────────────────────────────────────

/** Redondeo a centavos para evitar arrastre de coma flotante. */
export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Suma de los montos de una lista de cobros. */
export function sumaCobros(cobros: Pick<Cobro, 'monto'>[]): number {
  return redondear(cobros.reduce((acc, c) => acc + c.monto, 0));
}

/**
 * Saldo derivado de una venta: total − Σ cobros. Nunca negativo.
 * El saldo NUNCA se almacena; siempre se recalcula desde los datos.
 */
export function saldoDerivado(total: number, cobros: Pick<Cobro, 'monto'>[]): number {
  return redondear(Math.max(0, total - sumaCobros(cobros)));
}

/**
 * Clasifica un cobro respecto al total de su venta. Un cobro que cubre el total
 * de la venta en una sola exhibición es 'total'; cualquier abono es 'parcial'.
 * (El campo es informativo; el saldo no depende de él, se deriva de los montos.)
 */
export function tipoCobro(monto: number, totalVenta: number): 'total' | 'parcial' {
  return monto >= totalVenta ? 'total' : 'parcial';
}

// ── Lectura ───────────────────────────────────────────────────

/** Cobros de una venta, ordenados del más antiguo al más reciente. */
export async function cobrosDeVenta(ventaId: string): Promise<Cobro[]> {
  const cobros = await db.cobro.where('venta_id').equals(ventaId).toArray();
  return cobros.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Saldo derivado de una sola venta (total − Σ cobros). */
export async function saldoDeVenta(ventaId: string): Promise<number> {
  const venta = await db.venta.get(ventaId);
  if (!venta) return 0;
  const cobros = await cobrosDeVenta(ventaId);
  return saldoDerivado(venta.total, cobros);
}

/** Saldo de una venta con sus cobros y monto cobrado (vista derivada). */
export interface SaldoVenta {
  venta: Venta;
  cobros: Cobro[];
  cobrado: number;
  saldo: number;
}

/** Desglose del saldo de un cliente, derivado de ventas − cobros. */
export interface DesgloseCliente {
  /** Saldo total pendiente del cliente (Σ saldos de venta). */
  saldoTotal: number;
  /** Total ya cobrado al cliente (Σ montos de cobro). */
  totalCobrado: number;
  /** Ventas con saldo pendiente (> 0), de la más antigua a la más reciente. */
  ventasConSaldo: SaldoVenta[];
  /** Todas las ventas del cliente con su saldo derivado. */
  ventas: SaldoVenta[];
  /** Historial de todos los cobros del cliente, del más reciente al más antiguo. */
  historial: Cobro[];
}

/**
 * Deriva el saldo del cliente: por cada venta, total − Σ cobros. El resultado
 * desglosa por venta y conserva el historial de cobros. Nada se almacena.
 */
export async function desgloseCliente(clienteId: string): Promise<DesgloseCliente> {
  const ventas = await db.venta.where('cliente_id').equals(clienteId).toArray();
  ventas.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const detalle: SaldoVenta[] = [];
  const historial: Cobro[] = [];
  let saldoTotal = 0;
  let totalCobrado = 0;

  for (const venta of ventas) {
    const cobros = await cobrosDeVenta(venta.id);
    const cobrado = sumaCobros(cobros);
    const saldo = saldoDerivado(venta.total, cobros);
    detalle.push({ venta, cobros, cobrado, saldo });
    historial.push(...cobros);
    saldoTotal = redondear(saldoTotal + saldo);
    totalCobrado = redondear(totalCobrado + cobrado);
  }

  historial.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return {
    saldoTotal,
    totalCobrado,
    ventasConSaldo: detalle.filter((d) => d.saldo > 0),
    ventas: detalle,
    historial,
  };
}

// ── Escritura ─────────────────────────────────────────────────

export interface RegistrarCobroInput {
  ventaId: string;
  monto: number;
  forma_pago: FormaPago;
  /** Fecha ISO; por defecto ahora (parametrizable para pruebas). */
  fecha?: string;
}

/**
 * Registra un cobro sobre una venta concreta. Escribe local + encola sync.
 * El `tipo` se deriva del total de la venta; el saldo no se persiste.
 *
 * Cada cobro guarda su propia `forma_pago`, sin afectar a los demás cobros de
 * la misma venta (criterio H-07: liquidación en varios momentos).
 */
export async function registrarCobro(input: RegistrarCobroInput): Promise<Cobro> {
  const { ventaId, monto, forma_pago, fecha = new Date().toISOString() } = input;

  if (monto <= 0) {
    throw new Error('El monto del cobro debe ser mayor a cero.');
  }

  const venta = await db.venta.get(ventaId);
  if (!venta) {
    throw new Error(`No existe la venta ${ventaId}.`);
  }

  const cobro: Cobro = {
    id: generateUUID(),
    venta_id: ventaId,
    fecha,
    monto: redondear(monto),
    forma_pago,
    tipo: tipoCobro(monto, venta.total),
  };

  await persistCobro(cobro);

  // Un único disparo de sync tras escribir local (offline-first).
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return cobro;
}

export interface RegistrarCobroClienteInput {
  clienteId: string;
  monto: number;
  forma_pago: FormaPago;
  fecha?: string;
}

/**
 * Registra un cobro a nivel cliente, asignándolo FIFO a las ventas con saldo
 * (la más antigua primero). Si el monto abarca varias ventas, genera un cobro
 * por venta, todos con la misma `forma_pago` y fecha. Devuelve los cobros
 * creados. Útil para "cobrar saldo previo" desde la ficha del cliente (P3).
 */
export async function registrarCobroCliente(
  input: RegistrarCobroClienteInput
): Promise<Cobro[]> {
  const { clienteId, monto, forma_pago, fecha = new Date().toISOString() } = input;

  if (monto <= 0) {
    throw new Error('El monto del cobro debe ser mayor a cero.');
  }

  const { ventasConSaldo, saldoTotal } = await desgloseCliente(clienteId);
  if (saldoTotal <= 0) {
    throw new Error('El cliente no tiene saldo pendiente.');
  }

  let restante = redondear(Math.min(monto, saldoTotal));
  const creados: Cobro[] = [];

  for (const { venta, saldo } of ventasConSaldo) {
    if (restante <= 0) break;
    const aplica = redondear(Math.min(restante, saldo));
    const cobro: Cobro = {
      id: generateUUID(),
      venta_id: venta.id,
      fecha,
      monto: aplica,
      forma_pago,
      tipo: tipoCobro(aplica, venta.total),
    };
    await persistCobro(cobro);
    creados.push(cobro);
    restante = redondear(restante - aplica);
  }

  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return creados;
}

// ── Persistencia local + cola (sin disparar sync) ─────────────

async function persistCobro(cobro: Cobro): Promise<void> {
  await db.cobro.put(cobro);
  await enqueueOperation('cobro', 'upsert', cobro as unknown as Record<string, unknown>);
}
