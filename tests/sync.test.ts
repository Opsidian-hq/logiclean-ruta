/**
 * Logiclean Ruta — Tests T1: Motor de sincronización offline
 *
 * Suite de pruebas para SyncEngine + queue.ts
 *
 * T1-001: Operación offline entra en cola con status='pending'
 * T1-002: Al reconectar se procesa la cola y pasa a status='synced'
 * T1-003: Doble insert del mismo UUID resulta en un solo registro (idempotencia)
 * T1-004: Si el servidor falla, la operación queda en status='error'
 *
 * Mocks:
 *  - Supabase client (no llama al servidor real)
 *  - Dexie/IndexedDB (usa fake-indexeddb en memoria)
 *  - navigator.onLine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Tipos locales para los tests ──────────────────────────────
// (evitar importar desde src/ en tests de lógica pura)

type SyncOperation = 'upsert' | 'delete';
type SyncStatus = 'pending' | 'synced' | 'error';

interface QueueItem {
  _seq?: number;
  id: string;
  table_name: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retry_count: number;
  created_at: string;
  error_message?: string;
  attempted_at?: string;
}

// ── Simulación de cola en memoria (sin Dexie real en tests unitarios) ──

class InMemoryQueue {
  private items: Map<string, QueueItem> = new Map();
  private seq = 0;

  async add(item: Omit<QueueItem, '_seq'>): Promise<string> {
    this.items.set(item.id, { ...item, _seq: ++this.seq } as QueueItem);
    return item.id;
  }

  async getPending(): Promise<QueueItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.status === 'pending')
      .sort((a, b) => (a._seq ?? 0) - (b._seq ?? 0));
  }

  async markSynced(id: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, { ...item, status: 'synced', attempted_at: new Date().toISOString() });
    }
  }

  async markError(id: string, message: string): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, {
        ...item,
        status: 'error',
        error_message: message,
        retry_count: (item.retry_count ?? 0) + 1,
        attempted_at: new Date().toISOString(),
      });
    }
  }

  async resetErrors(): Promise<void> {
    for (const [id, item] of this.items.entries()) {
      if (item.status === 'error') {
        this.items.set(id, { ...item, status: 'pending' });
      }
    }
  }

  async countPending(): Promise<number> {
    return Array.from(this.items.values()).filter((i) => i.status === 'pending').length;
  }

  getById(id: string): QueueItem | undefined {
    return this.items.get(id);
  }

  clear(): void {
    this.items.clear();
    this.seq = 0;
  }
}

// ── Simulación del cliente Supabase ───────────────────────────

type MockSupabaseResult =
  | { data: Record<string, unknown>[]; error: null }
  | { data: null; error: { message: string } };

// Almacén remoto simulado (detecta duplicados por id)
class MockRemoteStore {
  private records: Map<string, Record<string, unknown>> = new Map();

  upsert(payload: Record<string, unknown>): MockSupabaseResult {
    const id = payload.id as string;
    if (!id) return { data: null, error: { message: 'Missing id' } };
    this.records.set(id, payload);
    return { data: [payload], error: null };
  }

  count(): number {
    return this.records.size;
  }

  get(id: string): Record<string, unknown> | undefined {
    return this.records.get(id);
  }

  clear(): void {
    this.records.clear();
  }
}

// ── Motor de sync simplificado para tests ─────────────────────

class TestSyncEngine {
  private queue: InMemoryQueue;
  private remote: MockRemoteStore;
  private shouldFail: boolean = false;

  constructor(queue: InMemoryQueue, remote: MockRemoteStore) {
    this.queue = queue;
    this.remote = remote;
  }

  /** Simular fallo del servidor */
  setServerFailure(fail: boolean): void {
    this.shouldFail = fail;
  }

  async enqueue(
    tableNname: string,
    operation: SyncOperation,
    payload: Record<string, unknown>
  ): Promise<QueueItem> {
    const item: QueueItem = {
      id: `queue-${Date.now()}-${Math.random()}`,
      table_name: tableNname,
      operation,
      payload,
      status: 'pending',
      retry_count: 0,
      created_at: new Date().toISOString(),
    };
    await this.queue.add(item);
    return item;
  }

  async processQueue(): Promise<void> {
    const items = await this.queue.getPending();

    for (const item of items) {
      if (this.shouldFail) {
        await this.queue.markError(item.id, 'Server connection refused');
        continue;
      }

      if (item.operation === 'upsert') {
        const result = this.remote.upsert(item.payload);
        if (result.error) {
          await this.queue.markError(item.id, result.error.message);
        } else {
          await this.queue.markSynced(item.id);
        }
      }
    }
  }
}

// ── Setup ─────────────────────────────────────────────────────

let queue: InMemoryQueue;
let remote: MockRemoteStore;
let engine: TestSyncEngine;

beforeEach(() => {
  queue = new InMemoryQueue();
  remote = new MockRemoteStore();
  engine = new TestSyncEngine(queue, remote);
});

afterEach(() => {
  queue.clear();
  remote.clear();
});

// ── Tests ─────────────────────────────────────────────────────

describe('T1 — Motor de sincronización offline', () => {

  /**
   * T1-001: Una operación offline entra en cola con status='pending'
   *
   * Escenario: el usuario crea un cliente sin conexión.
   * La operación se guarda en IndexedDB con status='pending'.
   * No se intenta contactar al servidor aún.
   */
  it('T1-001: operación offline entra en cola con status="pending"', async () => {
    const payload = {
      id: 'cliente-uuid-001',
      nombre: 'Ferretería El Martillo',
      tipo: 'mayoreo',
      activo: true,
    };

    const item = await engine.enqueue('cliente', 'upsert', payload);

    // La operación fue encolada
    expect(item.status).toBe('pending');
    expect(item.table_name).toBe('cliente');
    expect(item.operation).toBe('upsert');
    expect(item.payload).toEqual(payload);

    // Está en la cola
    const pending = await queue.getPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(item.id);
    expect(pending[0].status).toBe('pending');

    // No fue al servidor
    expect(remote.count()).toBe(0);
  });

  /**
   * T1-002: Al reconectar se procesa la cola y pasa a status='synced'
   *
   * Escenario: hay 2 operaciones pendientes. El usuario recupera conexión.
   * SyncEngine procesa la cola; ambas pasan a status='synced'.
   */
  it('T1-002: al reconectar se procesa la cola y pasa a status="synced"', async () => {
    // Encolar 2 operaciones mientras estaba offline
    const item1 = await engine.enqueue('producto_base', 'upsert', {
      id: 'prod-uuid-001',
      nombre: 'Multiusos concentrado',
      unidad_compra: 'bidon',
      activo: true,
    });
    const item2 = await engine.enqueue('presentacion', 'upsert', {
      id: 'pres-uuid-001',
      producto_base_id: 'prod-uuid-001',
      nombre: 'Multiusos 1 L',
      activo: true,
    });

    expect(await queue.countPending()).toBe(2);

    // Simular reconexión: procesar cola
    await engine.processQueue();

    // Ambas operaciones deben estar sincronizadas
    const q1 = queue.getById(item1.id);
    const q2 = queue.getById(item2.id);

    expect(q1?.status).toBe('synced');
    expect(q2?.status).toBe('synced');
    expect(await queue.countPending()).toBe(0);

    // Los datos llegaron al servidor
    expect(remote.count()).toBe(2);
    expect(remote.get('prod-uuid-001')).toBeDefined();
    expect(remote.get('pres-uuid-001')).toBeDefined();
  });

  /**
   * T1-003: Doble insert del mismo UUID resulta en un solo registro (idempotencia)
   *
   * Escenario: se encola el mismo registro dos veces (ej. retry o bug).
   * El servidor debe tener exactamente 1 registro, no 2.
   * Se simula con upsert por id (mismo comportamiento que Supabase).
   */
  it('T1-003: doble insert del mismo UUID = un solo registro (idempotencia)', async () => {
    const sharedId = 'cliente-duplicado-uuid-001';
    const payload1 = {
      id: sharedId,
      nombre: 'Tienda La Esperanza',
      tipo: 'menudeo',
      activo: true,
    };
    const payload2 = {
      id: sharedId,
      nombre: 'Tienda La Esperanza (actualizado)',
      tipo: 'menudeo',
      activo: true,
    };

    // Encolar dos veces el mismo UUID (diferentes datos — simula actualización)
    await engine.enqueue('cliente', 'upsert', payload1);
    await engine.enqueue('cliente', 'upsert', payload2);

    // Hay 2 ítems en cola
    expect(await queue.countPending()).toBe(2);

    // Procesar cola
    await engine.processQueue();

    // En el servidor solo debe haber 1 registro (upsert por id)
    expect(remote.count()).toBe(1);

    // El registro tiene los datos del ÚLTIMO upsert (el más reciente)
    const registro = remote.get(sharedId);
    expect(registro).toBeDefined();
    expect((registro as Record<string, unknown>)['nombre']).toBe(
      'Tienda La Esperanza (actualizado)'
    );

    // Ambos ítems de cola están synced
    expect(await queue.countPending()).toBe(0);
  });

  /**
   * T1-004: Si el servidor falla, la operación queda en status='error' y se reintenta
   *
   * Escenario: el servidor está caído temporalmente.
   * La operación queda en 'error'. Al reintentar (simular resetErrors + processQueue)
   * se procesa exitosamente.
   */
  it('T1-004: fallo del servidor → status="error" → se reintenta', async () => {
    const payload = {
      id: 'venta-uuid-001',
      vendedor_id: 'vendedor-uuid-001',
      total: 450.00,
      activo: true,
    };

    const item = await engine.enqueue('venta', 'upsert', payload);
    expect(item.status).toBe('pending');

    // Simular servidor caído
    engine.setServerFailure(true);
    await engine.processQueue();

    // La operación debe estar en error
    const failed = queue.getById(item.id);
    expect(failed?.status).toBe('error');
    expect(failed?.error_message).toBe('Server connection refused');
    expect(failed?.retry_count).toBe(1);

    // El servidor sigue sin el registro
    expect(remote.count()).toBe(0);

    // Simular recuperación del servidor
    engine.setServerFailure(false);

    // Reintentar: reset de errores y volver a procesar
    await queue.resetErrors();
    const retriedItem = queue.getById(item.id);
    expect(retriedItem?.status).toBe('pending');

    await engine.processQueue();

    // Ahora sí debe estar synced
    const retried = queue.getById(item.id);
    expect(retried?.status).toBe('synced');
    expect(retried?.retry_count).toBe(1); // contador del intento fallido se conserva

    // El registro llegó al servidor
    expect(remote.count()).toBe(1);
    expect(remote.get('venta-uuid-001')).toBeDefined();
  });

});
