/**
 * Logiclean Ruta — Administración de clientes (H-14)
 *
 * Persistencia local + cola de sync para alta/edición, reasignación entre
 * vendedores y baja lógica de clientes. Funciones canónicas que consume
 * `useClientes`; aisladas aquí para trazarlas a los criterios de aceptación.
 *
 * Criterios (PRD v1.2, H-14):
 *  - Editar un cliente → se actualizan sus datos para el vendedor dueño.
 *  - Reasignar a otro vendedor → pasa a la cartera del nuevo y deja de verse en
 *    la del anterior (el dueño es exclusivo, ADR-0001).
 *  - Baja lógica: el cliente se desactiva (nunca se borra).
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { toDexieRow } from '../db/normalize';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { Cliente } from '../db/schema';

export type GuardarClienteInput = Omit<Cliente, 'id'> & { id?: string };

/** Crea o actualiza un cliente. Escribe local + encola sync. */
export async function guardarCliente(data: GuardarClienteInput): Promise<Cliente> {
  const cliente: Cliente = {
    id: data.id ?? generateUUID(),
    vendedor_id: data.vendedor_id,
    nombre: data.nombre,
    tipo: data.tipo,
    estado: data.estado,
    ciclo_visita: data.ciclo_visita ?? 1,
    dia_ruta: data.dia_ruta,
    fecha_proxima_visita: data.fecha_proxima_visita,
    activo: data.activo ?? true,
  };

  await db.cliente.put(toDexieRow(cliente));
  const item = await enqueueOperation(
    'cliente',
    'upsert',
    cliente as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
  return cliente;
}

/**
 * Reasigna un cliente a otro vendedor. El cliente pasa a la cartera del nuevo
 * dueño (exclusivo); deja de verse en la del anterior. Devuelve el cliente.
 */
export async function reasignarCliente(
  clienteId: string,
  nuevoVendedorId: string
): Promise<Cliente> {
  const actual = await db.cliente.get(clienteId);
  if (!actual) {
    throw new Error(`No existe el cliente ${clienteId}.`);
  }
  const cliente: Cliente = { ...actual, vendedor_id: nuevoVendedorId };

  await db.cliente.put(toDexieRow(cliente));
  const item = await enqueueOperation(
    'cliente',
    'upsert',
    cliente as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
  return cliente;
}

/** Baja lógica: desactiva el cliente (nunca DELETE) para preservar histórico. */
export async function desactivarCliente(id: string): Promise<void> {
  const actual = await db.cliente.get(id);
  if (!actual) return;
  const cliente: Cliente = { ...actual, activo: false };

  await db.cliente.put(toDexieRow(cliente));
  const item = await enqueueOperation(
    'cliente',
    'upsert',
    cliente as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
}
