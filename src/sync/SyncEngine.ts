/**
 * Logiclean Ruta — Motor de sincronización offline ↔ servidor
 *
 * Flujo:
 *  1. Usuario crea/edita registro → se guarda en Dexie + se agrega a sync_queue
 *  2. Si hay conexión: procesa la cola inmediatamente
 *  3. Si no hay conexión: al detectar `online`, procesa la cola
 *  4. Cada operación usa upsert idempotente por `id` (sin duplicados)
 *  5. Si falla: marca como 'error', se reintenta en la siguiente oportunidad
 */

import { supabase } from '../lib/supabase';
import { hydrate } from './pull';
import {
  getPendingItems,
  markSynced,
  markError,
  resetErrorItems,
  countPending,
  type SyncQueueItem,
} from './queue';

// ── Tipos exportados (usados por SyncContext) ─────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  syncStatus: SyncStatus;
}

export type SyncStateListener = (state: SyncState) => void;

// ── SyncEngine ────────────────────────────────────────────────

export class SyncEngine {
  private listeners: Set<SyncStateListener> = new Set();
  private state: SyncState = {
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncedAt: null,
    syncStatus: 'idle',
  };
  private isSyncing = false;
  private isHydrating = false;

  constructor() {
    // Escuchar cambios de conectividad
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    // Sync agresiva en primer plano (T2): al volver a primer plano, subir lo
    // pendiente de inmediato para acotar la ventana "guardado local, sin subir".
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  /** Liberar listeners al desmontar */
  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    this.listeners.clear();
  }

  /** Suscribirse a cambios de estado */
  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    // Notificar estado actual inmediatamente
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** Obtener estado actual sin suscripción */
  getState(): SyncState {
    return { ...this.state };
  }

  /** Actualizar conteo de pendientes (llamar después de encolar) */
  async refreshPendingCount(): Promise<void> {
    const pendingCount = await countPending();
    this.setState({ pendingCount });
  }

  /**
   * Notificar que una operación ya fue encolada (vía `enqueueOperation`)
   * y disparar la sincronización si hay conexión.
   * El ítem se recibe por claridad del contrato con los hooks; el motor
   * procesa la cola completa, no el ítem individual.
   * Este es el método principal que usan los hooks.
   */
  async enqueueAndSync(_item: SyncQueueItem): Promise<void> {
    await this.refreshPendingCount();
    if (this.state.isOnline) {
      await this.syncNow();
    }
  }

  /**
   * Procesar la cola completa de pendientes.
   * Idempotente: si ya está corriendo, no inicia otro ciclo.
   */
  async syncNow(): Promise<void> {
    if (this.isSyncing || !this.state.isOnline) return;

    this.isSyncing = true;
    this.setState({ syncStatus: 'syncing' });

    try {
      // Reintentar ítems en error antes de procesar nuevos
      await resetErrorItems();

      const items = await getPendingItems();

      if (items.length === 0) {
        this.setState({
          syncStatus: 'idle',
          pendingCount: 0,
          lastSyncedAt: new Date(),
        });
        return;
      }

      let hasErrors = false;

      for (const item of items) {
        const success = await this.processItem(item);
        if (!success) hasErrors = true;
      }

      const pendingCount = await countPending();
      this.setState({
        syncStatus: hasErrors ? 'error' : 'idle',
        pendingCount,
        lastSyncedAt: hasErrors ? this.state.lastSyncedAt : new Date(),
      });
    } catch (error) {
      console.error('[SyncEngine] Error inesperado durante sync:', error);
      this.setState({ syncStatus: 'error' });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Hidratar la BD local desde el servidor (pull).
   * Trae catálogo, clientes e inventario visibles para el usuario actual.
   * Requiere conexión y una sesión activa (RLS); si no hay, no hace nada.
   * Idempotente: si ya está corriendo, no inicia otro ciclo.
   */
  async hydrateNow(): Promise<void> {
    if (this.isHydrating || !this.state.isOnline) return;

    this.isHydrating = true;
    try {
      await hydrate();
      // Refrescar el conteo por si la hidratación tocó la cola en el futuro.
      await this.refreshPendingCount();
    } catch (error) {
      console.error('[SyncEngine] Error inesperado durante hidratación:', error);
    } finally {
      this.isHydrating = false;
    }
  }

  /** Procesar un ítem individual de la cola */
  private async processItem(item: SyncQueueItem): Promise<boolean> {
    try {
      if (item.operation === 'upsert') {
        const { error } = await supabase
          .from(item.table_name)
          .upsert(item.payload as Record<string, unknown>, { onConflict: 'id' });

        if (error) {
          await markError(item.id, error.message);
          console.error(`[SyncEngine] upsert error en ${item.table_name}:`, error.message);
          return false;
        }

        await markSynced(item.id);
        return true;
      }

      if (item.operation === 'delete') {
        const { error } = await supabase
          .from(item.table_name)
          .delete()
          .eq('id', (item.payload as { id: string }).id);

        if (error) {
          await markError(item.id, error.message);
          console.error(`[SyncEngine] delete error en ${item.table_name}:`, error.message);
          return false;
        }

        await markSynced(item.id);
        return true;
      }

      // Operación desconocida — no debería llegar aquí
      await markError(item.id, `Operación desconocida: ${item.operation}`);
      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markError(item.id, message);
      return false;
    }
  }

  private handleOnline = async () => {
    this.setState({ isOnline: true });
    // Primero subir los cambios locales pendientes, luego releer del servidor.
    await this.syncNow();
    await this.hydrateNow();
  };

  private handleOffline = () => {
    this.setState({ isOnline: false, syncStatus: 'idle' });
  };

  /**
   * Al recuperar visibilidad (app vuelve a primer plano), dispara sync. En iOS
   * (PWA) no hay background sync, así que este es el momento clave para subir lo
   * pendiente. `syncNow` ya es idempotente: si ya está corriendo, no duplica.
   */
  private handleVisibilityChange = async () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState !== 'visible' || !this.state.isOnline) return;
    await this.syncNow();
    await this.hydrateNow();
  };

  private setState(partial: Partial<SyncState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    const snapshot = { ...this.state };
    this.listeners.forEach((l) => l(snapshot));
  }
}

/** Instancia singleton del motor de sync */
export const syncEngine = new SyncEngine();
