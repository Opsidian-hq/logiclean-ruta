/**
 * Logiclean Ruta — Prospectos y visitas (H-01)
 *
 * - crearProspecto: alta de prospecto en "visita 1 de 4" con fecha de hoy.
 * - registrarVisita: registra la visita, avanza el contador del ciclo y
 *   reprograma la próxima visita del cliente.
 *
 * Escritura local instantánea + cola de sync idempotente (offline-first).
 * RLS permite que el vendedor inserte/actualice sus propios clientes y visitas.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { toDexieRow } from '../db/normalize';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { Cliente, Visita } from '../db/schema';

// ── Crear prospecto ───────────────────────────────────────────

export interface CrearProspectoInput {
  vendedorId: string;
  nombre: string;
  tipo: 'mayoreo' | 'menudeo';
  dia_ruta?: string;
  /** ISO date; por defecto hoy. Es la primera "próxima visita" del ciclo. */
  fecha?: string;
}

export async function crearProspecto(
  input: CrearProspectoInput
): Promise<Cliente> {
  const { vendedorId, nombre, tipo, dia_ruta, fecha } = input;
  if (!nombre.trim()) throw new Error('El nombre del prospecto es obligatorio.');

  const cliente: Cliente = {
    id: generateUUID(),
    vendedor_id: vendedorId,
    nombre: nombre.trim(),
    tipo,
    estado: 'prospecto',
    ciclo_visita: 1, // "visita 1 de 4"
    dia_ruta: dia_ruta?.trim() || null,
    fecha_proxima_visita: fecha ?? new Date().toISOString().slice(0, 10),
    activo: true,
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

// ── Registrar visita ──────────────────────────────────────────

export interface RegistrarVisitaInput {
  vendedorId: string;
  /** Cliente actual (se usa su ciclo_visita para numerar la visita). */
  cliente: Cliente;
  nota?: string;
  siguientePaso?: string;
  /** Próxima visita reprogramada (ISO date). */
  fechaProxima?: string;
  /** Fecha de la visita; por defecto hoy. */
  fecha?: string;
}

export interface RegistrarVisitaResult {
  visita: Visita;
  cliente: Cliente;
}

export async function registrarVisita(
  input: RegistrarVisitaInput
): Promise<RegistrarVisitaResult> {
  const {
    vendedorId,
    cliente,
    nota,
    siguientePaso,
    fechaProxima,
    fecha = new Date().toISOString().slice(0, 10),
  } = input;

  // 1) Registrar la visita con el número de ciclo actual.
  const visita: Visita = {
    id: generateUUID(),
    cliente_id: cliente.id,
    vendedor_id: vendedorId,
    fecha,
    numero_ciclo: cliente.ciclo_visita,
    nota: nota?.trim() || undefined,
    siguiente_paso: siguientePaso?.trim() || undefined,
    fecha_proxima: fechaProxima || undefined,
  };
  await db.visita.put(visita);
  await enqueueOperation('visita', 'upsert', visita as unknown as Record<string, unknown>);

  // 2) Avanzar el ciclo del cliente y reprogramar su próxima visita.
  const clienteActualizado: Cliente = {
    ...cliente,
    ciclo_visita: cliente.ciclo_visita + 1,
    fecha_proxima_visita: fechaProxima ?? cliente.fecha_proxima_visita ?? null,
  };
  await db.cliente.put(toDexieRow(clienteActualizado));
  await enqueueOperation(
    'cliente',
    'upsert',
    clienteActualizado as unknown as Record<string, unknown>
  );

  // 3) Un único disparo de sync para el lote.
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { visita, cliente: clienteActualizado };
}

// ── Reprogramar / insertar visita (H-09) ─────────────────────

export interface ReprogramarVisitaInput {
  cliente: Cliente;
  /** Nueva fecha de próxima visita (ISO date). Hoy = entra en la ruta de hoy. */
  fechaProxima: string;
  /** Opcional: reasignar el día de ruta (texto libre) para moverla de ruta. */
  diaRuta?: string | null;
}

/**
 * Mueve la próxima visita de un cliente a otra fecha (o a hoy) sin registrar
 * una visita ni avanzar el ciclo. Sirve para insertar/reprogramar cuando surge
 * un pedido fuera de la ruta planeada (H-09): al ponerla en hoy aparece en la
 * ruta del día; en otra fecha, cae en esa jornada.
 */
export async function reprogramarVisita(
  input: ReprogramarVisitaInput
): Promise<Cliente> {
  const { cliente, fechaProxima, diaRuta } = input;
  if (!fechaProxima) throw new Error('Falta la nueva fecha de visita.');

  const actualizado: Cliente = {
    ...cliente,
    fecha_proxima_visita: fechaProxima,
    dia_ruta: diaRuta !== undefined ? diaRuta?.trim() || null : cliente.dia_ruta,
  };

  await db.cliente.put(toDexieRow(actualizado));
  const item = await enqueueOperation(
    'cliente',
    'upsert',
    actualizado as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);
  return actualizado;
}

/** Visitas de un cliente, de la más reciente a la más antigua. */
export async function visitasDeCliente(clienteId: string): Promise<Visita[]> {
  const visitas = await db.visita
    .where('cliente_id')
    .equals(clienteId)
    .toArray();
  return visitas.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
