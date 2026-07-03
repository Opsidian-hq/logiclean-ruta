/**
 * Logiclean Ruta — Recepción de mercancía de La Moderna (Inc 6.2, H-16)
 *
 * Escritura offline-first del evento `movimiento_la_moderna` (tipo=recibido).
 * Alimenta el rollup `suministro_la_moderna` del lado servidor (ADR-0006,
 * migración 008) y, cuando el producto es un químico o una escoba/trapeador/
 * recogedor con presentación 'pieza', el inventario de bodega (migración 007)
 * — ambos vía trigger, sin captura aparte.
 *
 * `tipo='devuelto'` (devolución semanal de sellados) es Inc 6.5, junto con la
 * reescritura del corte — no se expone aquí todavía.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { MovimientoLaModerna } from '../db/schema';

export interface RegistrarRecepcionInput {
  productoBaseId: string;
  cantidad: number;
  responsableId: string;
  /** ISO date (YYYY-MM-DD); por defecto hoy. */
  fecha?: string;
  nota?: string;
}

export async function registrarRecepcion(
  input: RegistrarRecepcionInput
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
  if (!(cantidad > 0)) throw new Error('La cantidad recibida debe ser mayor que 0.');

  const evento: MovimientoLaModerna = {
    id: generateUUID(),
    producto_base_id: productoBaseId,
    tipo: 'recibido',
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
