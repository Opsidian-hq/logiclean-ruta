/**
 * Logiclean Ruta — StepsBar
 *
 * Barra de pasos encadenados sobre fondo navy (prototipo `.steps`): círculos
 * numerados con líneas conectoras. Los pasos anteriores al activo se marcan como
 * completados (lima con palomita), el activo en azul, los siguientes atenuados.
 */

import { IonIcon } from '@ionic/react';
import { checkmarkOutline } from 'ionicons/icons';

interface StepsBarProps {
  pasos: string[];
  /** Índice (0-based) del paso activo. */
  activo: number;
}

export function StepsBar({ pasos, activo }: StepsBarProps) {
  return (
    <div style={{ background: 'var(--color-navy)', padding: '0 20px 14px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {pasos.map((paso, i) => {
        const done = i < activo;
        const isActive = i === activo;
        return (
          <div key={paso} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: '64px' }}>
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  background: done ? 'var(--color-lime)' : isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)',
                  color: done ? 'var(--color-navy)' : isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                }}
              >
                {done ? <IonIcon icon={checkmarkOutline} style={{ fontSize: '14px' }} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  marginTop: '5px',
                  textAlign: 'center',
                  color: done ? 'var(--color-lime)' : isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                }}
              >
                {paso}
              </span>
            </div>
            {i < pasos.length - 1 && (
              <div style={{ flex: 1, height: '1.5px', marginTop: '-13px', background: done ? 'var(--color-lime)' : 'rgba(255,255,255,0.2)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
