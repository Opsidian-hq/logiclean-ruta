/**
 * Logiclean Ruta — SyncStatusBadge
 *
 * Chip permanente de estado de sincronización para el header navy.
 * Reproduce los cuatro estados del prototipo:
 *  - offline:        ▢ Sin conexión   (relleno translúcido, punto gris)
 *  - syncing:        ◐ Sincronizando… (ámbar, spinner)
 *  - pending:        ● N pendiente(s) (ámbar)
 *  - error:          ✕ Error de sync  (rojo)
 *  - idle/synced:    ✓ Sincronizado   (lime)
 */

import type { CSSProperties } from 'react';
import { useSyncContext } from '../context/SyncContext';

interface SyncStatusBadgeProps {
  /** Mostrar la etiqueta de texto junto al indicador. */
  showLabel?: boolean;
}

const chip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '6px 10px',
  borderRadius: '8px',
  fontSize: '12.5px',
  fontWeight: 800,
  whiteSpace: 'nowrap',
  lineHeight: 1,
  userSelect: 'none',
};

const dot = (color: string): CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: color,
  display: 'inline-block',
  flex: 'none',
});

export function SyncStatusBadge({ showLabel = true }: SyncStatusBadgeProps) {
  const { isOnline, pendingCount, syncStatus, lastSyncedAt, syncNow } = useSyncContext();

  // ── Sin conexión ─────────────────────────────────────────
  if (!isOnline) {
    return (
      <div style={{ ...chip, background: 'rgba(255,255,255,.14)', color: '#CDD8EE' }} title="Sin conexión a internet">
        <span style={dot('#9AA9C8')} />
        {showLabel && (
          <span>
            Sin conexión
            {pendingCount > 0 && ` · ${pendingCount}`}
          </span>
        )}
      </div>
    );
  }

  // ── Sincronizando ────────────────────────────────────────
  if (syncStatus === 'syncing') {
    return (
      <div style={{ ...chip, background: 'var(--color-amber)', color: '#231A05' }} title="Sincronizando con el servidor…">
        <div
          style={{
            width: '13px',
            height: '13px',
            borderRadius: '50%',
            border: '2.5px solid rgba(35,26,5,.30)',
            borderTopColor: '#231A05',
            animation: 'lc-spin .8s linear infinite',
          }}
        />
        {showLabel && <span>Sincronizando…</span>}
      </div>
    );
  }

  // ── Error de sincronización ──────────────────────────────
  if (syncStatus === 'error') {
    return (
      <div
        style={{ ...chip, background: 'var(--color-error)', color: '#fff', cursor: 'pointer' }}
        title="Error al sincronizar. Toca para reintentar."
        onClick={syncNow}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && syncNow()}
      >
        <span style={{ fontWeight: 800 }}>✕</span>
        {showLabel && (
          <span>
            Error de sync
            {pendingCount > 0 && ` · ${pendingCount}`}
          </span>
        )}
      </div>
    );
  }

  // ── Pendiente (en línea, aún sin subir) ──────────────────
  if (pendingCount > 0) {
    return (
      <div
        style={{ ...chip, background: 'var(--color-amber)', color: '#231A05', cursor: 'pointer' }}
        title={`${pendingCount} operación(es) pendiente(s). Toca para sincronizar.`}
        onClick={syncNow}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && syncNow()}
      >
        <span style={dot('#231A05')} />
        {showLabel && (
          <span>
            {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    );
  }

  // ── Sincronizado ─────────────────────────────────────────
  const lastSync = lastSyncedAt
    ? `Último sync: ${lastSyncedAt.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
    : 'Sincronizado';

  return (
    <div style={{ ...chip, background: 'var(--color-lime)', color: 'var(--color-navy)' }} title={lastSync}>
      <span style={{ fontWeight: 800 }}>✓</span>
      {showLabel && <span>Sincronizado</span>}
    </div>
  );
}
