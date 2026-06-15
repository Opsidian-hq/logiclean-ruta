/**
 * Logiclean Ruta — SyncContext
 *
 * Expone el estado del motor de sincronización a toda la app.
 *
 * Valor expuesto:
 *  - isOnline: boolean
 *  - pendingCount: number
 *  - lastSyncedAt: Date | null
 *  - syncStatus: 'idle' | 'syncing' | 'error'
 *  - syncNow(): Promise<void>        — forzar sync manual
 *  - enqueue(item): Promise<void>    — encolar operación + trigger sync
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { syncEngine } from '../sync/SyncEngine';
import type { SyncState } from '../sync/SyncEngine';
import type { SyncQueueItem } from '../sync/queue';

// ── Tipos ─────────────────────────────────────────────────────

export interface SyncContextValue extends SyncState {
  syncNow: () => Promise<void>;
  enqueue: (item: SyncQueueItem) => Promise<void>;
}

// ── Contexto ──────────────────────────────────────────────────

const SyncContext = createContext<SyncContextValue | null>(null);

// ── Proveedor ─────────────────────────────────────────────────

interface SyncProviderProps {
  children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
  const [syncState, setSyncState] = useState<SyncState>(syncEngine.getState());

  // Suscribirse a cambios del motor de sync
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });

    // Refrescar conteo de pendientes al montar
    syncEngine.refreshPendingCount();

    return unsubscribe;
  }, []);

  const syncNow = () => syncEngine.syncNow();
  const enqueue = (item: SyncQueueItem) => syncEngine.enqueueAndSync(item);

  const value: SyncContextValue = {
    ...syncState,
    syncNow,
    enqueue,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

// ── Hook de consumo ───────────────────────────────────────────

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSyncContext debe usarse dentro de <SyncProvider>');
  }
  return ctx;
}
