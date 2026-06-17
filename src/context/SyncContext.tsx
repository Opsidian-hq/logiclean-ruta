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

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { syncEngine } from '../sync/SyncEngine';
import type { SyncState } from '../sync/SyncEngine';
import type { SyncQueueItem } from '../sync/queue';
import { useAuthContext } from './AuthContext';
import {
  solicitarAlmacenamientoPersistente,
  estimarAlmacenamiento,
} from '../lib/storage';
import { StorageWarningBanner } from '../components/StorageWarningBanner';

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
  const [lowStorage, setLowStorage] = useState(false);
  const [storageDismissed, setStorageDismissed] = useState(false);
  const { user } = useAuthContext();

  // Suscribirse a cambios del motor de sync
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState({ ...state });
    });

    // Refrescar conteo de pendientes al montar
    syncEngine.refreshPendingCount();

    return unsubscribe;
  }, []);

  // Resiliencia offline en iPhone (T2, ADR-0002):
  // 1) Solicitar almacenamiento persistente al arrancar (reduce purga de iOS).
  useEffect(() => {
    solicitarAlmacenamientoPersistente();
  }, []);

  // 3) Estimar el almacenamiento al montar y tras cada sync; si supera el 80%
  //    de la cuota, mostrar el aviso (no bloquea la operación).
  useEffect(() => {
    let activo = true;
    estimarAlmacenamiento().then((est) => {
      if (activo && est) setLowStorage(est.bajo);
    });
    return () => {
      activo = false;
    };
  }, [syncState.lastSyncedAt]);

  // Hidratar la BD local al iniciar sesión (el evento `online` no se dispara
  // en una carga normal con conexión, así que el pull inicial vive aquí).
  useEffect(() => {
    if (user && syncState.isOnline) {
      syncEngine.hydrateNow();
    }
  }, [user, syncState.isOnline]);

  const syncNow = () => syncEngine.syncNow();
  const enqueue = (item: SyncQueueItem) => syncEngine.enqueueAndSync(item);

  const value: SyncContextValue = {
    ...syncState,
    syncNow,
    enqueue,
  };

  return (
    <SyncContext.Provider value={value}>
      {lowStorage && !storageDismissed && (
        <StorageWarningBanner
          onSincronizar={() => {
            syncEngine.syncNow();
            setStorageDismissed(true);
          }}
          onDismiss={() => setStorageDismissed(true)}
        />
      )}
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
