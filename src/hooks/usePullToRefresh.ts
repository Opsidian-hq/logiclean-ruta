import { useCallback } from 'react';
import { syncEngine } from '../sync/SyncEngine';
import { useSyncContext } from '../context/SyncContext';

/**
 * Devuelve un handler para IonRefresher.onIonRefresh.
 *
 * Secuencia:
 *  1. Si online: syncNow() — sube la cola pendiente al servidor.
 *  2. Si online: hydrateNow() — trae datos frescos del servidor a Dexie.
 *  3. onRefresh() — recarga la vista desde Dexie (siempre, online u offline).
 *  4. event.detail.complete() — cierra el spinner (garantizado por finally).
 */
export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const { isOnline, syncNow } = useSyncContext();

  const handleRefresh = useCallback(
    async (event: CustomEvent) => {
      try {
        if (isOnline) {
          await syncNow();
          await syncEngine.hydrateNow();
        }
        await onRefresh();
      } finally {
        (event.detail as { complete: () => void }).complete();
      }
    },
    [isOnline, syncNow, onRefresh]
  );

  return { handleRefresh };
}
