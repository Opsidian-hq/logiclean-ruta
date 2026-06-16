/**
 * Logiclean Ruta — ConnectivityStrip
 *
 * Franja offline-first permanente bajo el header navy (prototipo: #0A2566).
 * Refleja el estado de conexión real (punto lime/gris) pero permite un texto
 * propio por pantalla. Sólo presentación: no dispara sincronizaciones.
 */

import { useSyncContext } from '../../context/SyncContext';

interface ConnectivityStripProps {
  /** Mensaje a la derecha del punto. Si se omite, depende de la conexión. */
  text?: string;
}

export function ConnectivityStrip({ text }: ConnectivityStripProps) {
  const { isOnline } = useSyncContext();
  const message =
    text ?? (isOnline ? 'En línea · se sincroniza solo' : 'Sin conexión · guardado en el equipo');

  return (
    <div
      style={{
        background: 'var(--color-navy-strip)',
        padding: '7px var(--space-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isOnline ? 'var(--color-lime)' : 'var(--color-strip-dot)',
          display: 'inline-block',
          flex: 'none',
        }}
      />
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 600,
          color: 'var(--color-strip-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {message}
      </span>
    </div>
  );
}
