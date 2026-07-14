/**
 * Logiclean Ruta — Abono de saldo vendedor↔negocio (Inc 7.5, migración 015)
 *
 * Ledger append-only que salda `saldo_vendedor_cierre` del último corte
 * confirmado sin reescribirlo (mismo espíritu que `cobro` salda `venta`).
 * `cargarAperturaVigente` (en `corteReparto.ts`) es quien neta estos abonos
 * contra el saldo del corte para obtener "cuánto debe/le deben hoy".
 */

import { db } from '../db/index';
import { generateUUID } from './uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { AbonoSaldoVendedor } from '../db/schema';

export type DireccionAbono = AbonoSaldoVendedor['direccion'];
export type FormaPagoAbono = AbonoSaldoVendedor['forma_pago'];

/** Abonos registrados contra un corte concreto (todos los vendedores). */
export async function abonosDelCorte(corteId: string): Promise<AbonoSaldoVendedor[]> {
  return db.abono_saldo_vendedor.where('corte_id').equals(corteId).toArray();
}

/**
 * Abonos de un vendedor contra un corte concreto, más recientes primero.
 * Para auditoría (H-15): el saldo neto puede dar $0 aunque haya movimientos
 * (p.ej. un retiro de honorario compensado por un cobro de cartera vieja) —
 * esta es la fuente para mostrárselos al gerente en vez de ocultarlos.
 */
export async function abonosDelCorteVendedor(corteId: string, vendedorId: string): Promise<AbonoSaldoVendedor[]> {
  const abonos = await abonosDelCorte(corteId);
  return abonos.filter((a) => a.vendedor_id === vendedorId).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export interface AbonoFisicoPorVendedor {
  ya_retirado_efectivo: number;
  ya_retirado_transferencia: number;
  ya_entregado_efectivo: number;
  ya_entregado_transferencia: number;
}

/**
 * Agrega los abonos de un corte por vendedor × dirección × forma_pago (Inc
 * 7.5.2), para que el motor de corte sepa cuánto de la bolsa cruda de cada
 * vendedor ya no está físicamente en su mano. Consumidor DISTINTO de las
 * mismas filas que lee `cargarAperturaVigente` (`corteReparto.ts`): esa
 * función neta los abonos contra el ledger de saldo entre cortes; esta
 * agrega los mismos abonos para la física de efectivo de ESTE corte (bolsa,
 * pool_liquido, instrucciones de liquidación) — no son redundantes.
 */
export async function abonoFisicoDelCorte(corteId: string): Promise<Map<string, AbonoFisicoPorVendedor>> {
  const abonos = await abonosDelCorte(corteId);
  const porVendedor = new Map<string, AbonoFisicoPorVendedor>();

  for (const a of abonos) {
    const entrada = porVendedor.get(a.vendedor_id) ?? {
      ya_retirado_efectivo: 0,
      ya_retirado_transferencia: 0,
      ya_entregado_efectivo: 0,
      ya_entregado_transferencia: 0,
    };
    if (a.direccion === 'negocio_a_vendedor') {
      if (a.forma_pago === 'efectivo') entrada.ya_retirado_efectivo += a.monto;
      else entrada.ya_retirado_transferencia += a.monto;
    } else {
      if (a.forma_pago === 'efectivo') entrada.ya_entregado_efectivo += a.monto;
      else entrada.ya_entregado_transferencia += a.monto;
    }
    porVendedor.set(a.vendedor_id, entrada);
  }

  return porVendedor;
}

export interface RegistrarAbonoSaldoVendedorInput {
  corteId: string;
  vendedorId: string;
  direccion: DireccionAbono;
  monto: number;
  forma_pago: FormaPagoAbono;
  nota?: string;
  /** Fecha ISO; por defecto ahora (parametrizable para pruebas). */
  fecha?: string;
}

/**
 * Registra un abono contra el saldo vigente de un vendedor. Escribe local +
 * encola sync; nunca bloquea esperando al servidor (offline-first).
 */
export async function registrarAbonoSaldoVendedor(
  input: RegistrarAbonoSaldoVendedorInput
): Promise<AbonoSaldoVendedor> {
  const { corteId, vendedorId, direccion, monto, forma_pago, nota, fecha = new Date().toISOString() } = input;

  if (monto <= 0) {
    throw new Error('El monto del abono debe ser mayor a cero.');
  }

  const abono: AbonoSaldoVendedor = {
    id: generateUUID(),
    corte_id: corteId,
    vendedor_id: vendedorId,
    direccion,
    monto: Math.round(monto * 100) / 100,
    forma_pago,
    fecha,
    nota,
  };

  await db.abono_saldo_vendedor.put(abono);
  await enqueueOperation('abono_saldo_vendedor', 'upsert', abono as unknown as Record<string, unknown>);

  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return abono;
}
