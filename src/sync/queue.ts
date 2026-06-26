/**
 * Logiclean Ruta — Cola de operaciones offline
 *
 * Cada acción del usuario (crear/actualizar un registro) que
 * no puede enviarse inmediatamente al servidor se almacena aquí.
 *
 * Al reconectar, SyncEngine procesa la cola en orden FIFO.
 * Las operaciones son idempotentes gracias al upsert por `id`.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import type { EntityTable } from '../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

export type SyncOperation = 'upsert' | 'patch' | 'delete';

export type SyncStatus = 'pending' | 'synced' | 'error';

export interface SyncQueueItem {
  /** Secuencia autoincremental (solo local, para ordenar) */
  _seq?: number;
  /** UUID del ítem de cola (distinto del UUID del payload) */
  id: string;
  /** Tabla de destino en Supabase */
  table_name: EntityTable;
  /** Operación a realizar */
  operation: SyncOperation;
  /** Datos a enviar (payload completo del registro) */
  payload: Record<string, unknown>;
  /** Estado actual del ítem */
  status: SyncStatus;
  /** Cuántas veces se ha intentado enviar */
  retry_count: number;
  /** Mensaje del último error (si status='error') */
  error_message?: string;
  /** Fecha de creación (ISO timestamptz) */
  created_at: string;
  /** Fecha del último intento (ISO timestamptz) */
  attempted_at?: string;
}

// ── Funciones de la cola ──────────────────────────────────────

/**
 * Agrega una operación a la cola offline.
 * Llamar desde hooks/SyncEngine cuando se modifica un registro.
 */
export async function enqueueOperation(
  table: EntityTable,
  operation: SyncOperation,
  payload: Record<string, unknown>
): Promise<SyncQueueItem> {
  const item: SyncQueueItem = {
    id: generateUUID(),
    table_name: table,
    operation,
    payload,
    status: 'pending',
    retry_count: 0,
    created_at: new Date().toISOString(),
  };
  await db.sync_queue.add(item);
  return item;
}

/**
 * Devuelve todos los ítems con status='pending', ordenados por _seq (FIFO).
 */
export async function getPendingItems(): Promise<SyncQueueItem[]> {
  return db.sync_queue
    .where('status')
    .equals('pending')
    .sortBy('_seq');
}

/**
 * Marca un ítem como sincronizado.
 */
export async function markSynced(id: string): Promise<void> {
  await db.sync_queue.where('id').equals(id).modify({
    status: 'synced',
    attempted_at: new Date().toISOString(),
  });
}

/**
 * Marca un ítem como error y registra el mensaje.
 * Incrementa el contador de reintentos.
 */
export async function markError(id: string, errorMessage: string): Promise<void> {
  const item = await db.sync_queue.where('id').equals(id).first();
  if (!item) return;

  await db.sync_queue.where('id').equals(id).modify({
    status: 'error',
    error_message: errorMessage,
    retry_count: (item.retry_count ?? 0) + 1,
    attempted_at: new Date().toISOString(),
  });
}

/**
 * Pone de vuelta a 'pending' los ítems en estado 'error'
 * (para reintentar al reconectar).
 */
export async function resetErrorItems(): Promise<void> {
  await db.sync_queue.where('status').equals('error').modify({
    status: 'pending',
  });
}

/**
 * Cuenta los ítems pendientes (para mostrar en SyncStatusBadge).
 */
export async function countPending(): Promise<number> {
  return db.sync_queue.where('status').equals('pending').count();
}

/**
 * Limpia los ítems ya sincronizados (mantenimiento periódico).
 * Conserva los de error para revisión.
 */
export async function clearSynced(): Promise<void> {
  await db.sync_queue.where('status').equals('synced').delete();
}
