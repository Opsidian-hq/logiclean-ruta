/**
 * Logiclean Ruta — ErrorSyncBanner (estado Error de sync)
 *
 * Mensaje tranquilizador cuando el cobro no pudo subir: el dinero NO se pierde,
 * está guardado en el equipo. Ofrece "Reintentar ahora". Mismo tono en P1–P4.
 */

import { money } from '../../../lib/money';

interface ErrorSyncBannerProps {
  /** Monto del cobro afectado (para el mensaje). */
  monto: number;
  onReintentar: () => void;
}

export function ErrorSyncBanner({ monto, onReintentar }: ErrorSyncBannerProps) {
  return (
    <div style={{ background: '#FDECEA', border: '1.5px solid #F4B3AC', borderRadius: '16px', padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-error)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <span style={{ color: '#fff', fontSize: '20px', fontWeight: 800 }}>!</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#911A11' }}>No se pudo sincronizar</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-error-text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#3E6B22' }}>Guardado en el equipo ✓</span>
            <span style={{ color: '#D89A93' }}>·</span>
            <span>no subió</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: '11px', paddingTop: '11px', borderTop: '1px solid #F4B3AC', fontSize: '13px', fontWeight: 700, color: '#7A1610', lineHeight: 1.4 }}>
        Tu cobro de <span className="numeric">{money(monto)}</span> está a salvo en tu equipo. El dinero{' '}
        <strong>no se pierde</strong>; solo falta subirlo.
      </div>
      <button
        type="button"
        onClick={onReintentar}
        style={{
          marginTop: '12px',
          width: '100%',
          minHeight: '46px',
          border: 'none',
          borderRadius: '12px',
          background: 'var(--color-primary)',
          color: '#fff',
          fontSize: '15px',
          fontWeight: 800,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '17px' }}>↻</span> Reintentar ahora
      </button>
    </div>
  );
}
