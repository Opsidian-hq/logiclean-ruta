/**
 * Logiclean Ruta — StorageWarningBanner (T2)
 *
 * Aviso informativo (no bloquea) cuando el almacenamiento del dispositivo supera
 * el 80% de su cuota. En iOS un dispositivo lleno aumenta el riesgo de purga del
 * almacenamiento local, así que se invita a sincronizar y liberar espacio.
 *
 * Se posiciona fijo en la parte superior para no alterar el layout de Ionic.
 */

interface StorageWarningBannerProps {
  onSincronizar: () => void;
  onDismiss: () => void;
}

export function StorageWarningBanner({ onSincronizar, onDismiss }: StorageWarningBannerProps) {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: '#FEF3E2',
        borderBottom: '1.5px solid #F6C97C',
        padding: 'max(8px, env(safe-area-inset-top)) 14px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '11px',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}
    >
      <span
        style={{
          width: '30px',
          height: '30px',
          flex: 'none',
          borderRadius: '8px',
          background: 'var(--color-amber)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#231A05',
          fontSize: '17px',
          fontWeight: 800,
        }}
      >
        !
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#7A3E06', lineHeight: 1.25 }}>
          Tu dispositivo tiene poco espacio
        </div>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-pending-text)', lineHeight: 1.3, marginTop: '1px' }}>
          Sincroniza y libera espacio para evitar perder datos.
        </div>
      </div>
      <button
        type="button"
        onClick={onSincronizar}
        style={{
          flex: 'none',
          minHeight: '38px',
          padding: '0 13px',
          border: 'none',
          borderRadius: '10px',
          background: 'var(--color-primary)',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        Sincronizar
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar aviso"
        style={{
          flex: 'none',
          width: '34px',
          height: '34px',
          border: 'none',
          borderRadius: '8px',
          background: 'transparent',
          color: '#7A3E06',
          fontSize: '20px',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}
