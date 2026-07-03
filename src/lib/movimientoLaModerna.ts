/**
 * Logiclean Ruta — Movimientos con La Moderna: recepción y devolución
 * (Inc 6.2 H-16, Inc 6.5 ADR-0010/M-1)
 *
 * Escritura offline-first del evento `movimiento_la_moderna`. Alimenta el
 * rollup `suministro_la_moderna` del lado servidor (ADR-0006, migraciones
 * 008/009) y, para recepción de químicos/escobas·trapeadores·recogedores, el
 * inventario de bodega (migración 007) — todo vía trigger, sin captura aparte.
 *
 * `registrarRecepcion` (tipo=recibido): lo que entra de La Moderna a bodega.
 * `registrarDevolucionLaModerna` (tipo=devuelto): bidones sellados no
 * abiertos que se devuelven cada semana (M-1/ADR-0010) — a diferencia de la
 * devolución de H-19 (vehículo → bodega), esta es bodega → La Moderna.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { MovimientoLaModerna } from '../db/schema';

interface RegistrarMovimientoInput {
  productoBaseId: string;
  cantidad: number;
  responsableId: string;
  fecha?: string;
  nota?: string;
}

async function registrarMovimiento(
  tipo: 'recibido' | 'devuelto',
  input: RegistrarMovimientoInput,
  mensajeCantidad: string
): Promise<MovimientoLaModerna> {
  const {
    productoBaseId,
    cantidad,
    responsableId,
    fecha = new Date().toISOString().slice(0, 10),
    nota,
  } = input;

  if (!productoBaseId) throw new Error('Falta el producto base.');
  if (!responsableId) throw new Error('Falta el responsable.');
  if (!(cantidad > 0)) throw new Error(mensajeCantidad);

  const evento: MovimientoLaModerna = {
    id: generateUUID(),
    producto_base_id: productoBaseId,
    tipo,
    fecha,
    cantidad,
    responsable_id: responsableId,
    nota,
  };

  await db.movimiento_la_moderna.put(evento);
  const item = await enqueueOperation(
    'movimiento_la_moderna',
    'upsert',
    evento as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);

  return evento;
}

export type RegistrarRecepcionInput = RegistrarMovimientoInput;

export async function registrarRecepcion(
  input: RegistrarRecepcionInput
): Promise<MovimientoLaModerna> {
  return registrarMovimiento('recibido', input, 'La cantidad recibida debe ser mayor que 0.');
}

export type RegistrarDevolucionLaModernaInput = RegistrarMovimientoInput;

export async function registrarDevolucionLaModerna(
  input: RegistrarDevolucionLaModernaInput
): Promise<MovimientoLaModerna> {
  return registrarMovimiento('devuelto', input, 'La cantidad devuelta debe ser mayor que 0.');
}
