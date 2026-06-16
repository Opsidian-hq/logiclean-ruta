/**
 * Logiclean Ruta — PrimaryCTA
 *
 * Botón primario del prototipo: ancho completo, alto 58px, radio 16px y la
 * sombra azul característica. Opcionalmente muestra un valor a la derecha
 * (p. ej. el total de la venta). Sólo presentación.
 */

import { IonButton, IonSpinner } from '@ionic/react';
import type { ReactNode } from 'react';

interface PrimaryCTAProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Contenido alineado a la derecha (total, importe…). */
  trailing?: ReactNode;
}

export function PrimaryCTA({ children, onClick, disabled, loading, trailing }: PrimaryCTAProps) {
  return (
    <IonButton
      expand="block"
      disabled={disabled}
      onClick={onClick}
      style={{
        '--background': 'var(--color-primary)',
        '--border-radius': 'var(--radius-lg)',
        '--box-shadow': 'var(--shadow-cta)',
        '--padding-start': '22px',
        '--padding-end': '22px',
        height: 'var(--cta-height)',
        margin: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: trailing ? 'space-between' : 'center',
          gap: '8px',
          width: '100%',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 800 }}>
          {loading && <IonSpinner name="crescent" style={{ width: '18px', height: '18px' }} />}
          {children}
        </span>
        {trailing != null && (
          <span style={{ fontSize: '19px', fontWeight: 800, fontVariantNumeric: 'var(--numeric)' }}>
            {trailing}
          </span>
        )}
      </div>
    </IonButton>
  );
}
