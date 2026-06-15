/**
 * Logiclean Ruta — SyncStatusBadge
 *
 * Indicador permanente del estado de sincronización.
 * Visible siempre en la UI (toolbar o footer).
 *
 * Estados:
 *  - offline:  🔴 Sin conexión (N pendiente/s)
 *  - syncing:  🔄 Sincronizando...
 *  - error:    🟡 Error de sync
 *  - idle:     🟢 Sincronizado
 */

import { IonIcon, IonSpinner } from '@ionic/react';
import {
  cloudOfflineOutline,
  cloudDoneOutline,
  cloudUploadOutline,
  warningOutline,
} from 'ionicons/icons';
import { useSyncContext } from '../context/SyncContext';

// ── Tipos ─────────────────────────────────────────────────────

interface SyncStatusBadgeProps {
  /** Mostrar etiqueta de texto junto al ícono */
  showLabel?: boolean;
}

// ── Estilos inline (evitar dependencia de CSS externo) ────────

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    minHeight: 'var(--touch-min, 48px)',
    cursor: 'default',
    userSelect: 'none' as const,
  },
} as const;

// ── Componente ────────────────────────────────────────────────

export function SyncStatusBadge({ showLabel = true }: SyncStatusBadgeProps) {
  const { isOnline, pendingCount, syncStatus, lastSyncedAt, syncNow } = useSyncContext();

  // ── Estado: sin conexión ─────────────────────────────────
  if (!isOnline) {
    return (
      <div
        style={{
          ...styles.container,
          backgroundColor: 'var(--color-error, #D92D20)',
          color: '#fff',
        }}
        title="Sin conexión a internet"
      >
        <IonIcon icon={cloudOfflineOutline} />
        {showLabel && (
          <span>
            Sin conexión
            {pendingCount > 0 && ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>
    );
  }

  // ── Estado: sincronizando ────────────────────────────────
  if (syncStatus === 'syncing') {
    return (
      <div
        style={{
          ...styles.container,
          backgroundColor: 'var(--color-amber, #F79009)',
          color: '#fff',
        }}
        title="Sincronizando con el servidor..."
      >
        <IonSpinner name="crescent" style={{ width: '16px', height: '16px' }} />
        {showLabel && <span>Sincronizando...</span>}
      </div>
    );
  }

  // ── Estado: error ────────────────────────────────────────
  if (syncStatus === 'error') {
    return (
      <div
        style={{
          ...styles.container,
          backgroundColor: 'var(--color-amber, #F79009)',
          color: '#fff',
          cursor: 'pointer',
        }}
        title="Error al sincronizar. Haz clic para reintentar."
        onClick={syncNow}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && syncNow()}
      >
        <IonIcon icon={warningOutline} />
        {showLabel && (
          <span>
            Error sync
            {pendingCount > 0 && ` · ${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>
    );
  }

  // ── Estado: pendiente (online pero sin procesar) ─────────
  if (pendingCount > 0) {
    return (
      <div
        style={{
          ...styles.container,
          backgroundColor: 'var(--color-amber, #F79009)',
          color: '#fff',
          cursor: 'pointer',
        }}
        title={`${pendingCount} operación(es) pendiente(s). Haz clic para sincronizar.`}
        onClick={syncNow}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && syncNow()}
      >
        <IonIcon icon={cloudUploadOutline} />
        {showLabel && (
          <span>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    );
  }

  // ── Estado: sincronizado (idle, 0 pendientes) ────────────
  const lastSync = lastSyncedAt
    ? `Último sync: ${lastSyncedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
    : 'Sincronizado';

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: 'var(--color-lime, #63F714)',
        color: 'var(--color-navy, #001D51)',
      }}
      title={lastSync}
    >
      <IonIcon icon={cloudDoneOutline} />
      {showLabel && <span>Sincronizado</span>}
    </div>
  );
}
