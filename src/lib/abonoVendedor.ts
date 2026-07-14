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
