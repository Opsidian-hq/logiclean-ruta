/**
 * Logiclean Ruta — SaldoInfo (ámbar informativo)
 *
 * Muestra el saldo pendiente en **ámbar informativo, no rojo de error**: el
 * saldo es información (lo que queda por cobrar), no un fallo. Se usa en P1
 * (saldo tras cobro parcial), P2 (confirmación con saldo) y P4 (saldo derivado).
 */

import type { ReactNode } from 'react';
import { money } from '../../../lib/money';

interface SaldoInfoProps {
  /** Etiqueta a la izquierda. */
  label: string;
  /** Monto del saldo. */
  monto: number;
  /** Texto aclaratorio bajo la fila (opcional). */
  nota?: ReactNode;
  /** Mostrar el punto ámbar antes de la etiqueta. */
  dot?: boolean;
  /** Tamaño de la cifra. Prototipo: 22 (P2) / 20 (P1). */
  montoSize?: number;
}

export function SaldoInfo({ label, monto, nota, dot = false, montoSize = 20 }: SaldoInfoProps) {
  return (
    <div
      style={{
        background: '#FEF3E2',
        border: '1.5px solid #F6C97C',
        borderRadius: '14px',
        padding: '14px 15px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15.5px', fontWeight: 800, color: '#7A3E06' }}>
          {dot && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--color-amber)', display: 'inline-block' }} />}
          {label}
        </span>
        <span className="numeric" style={{ fontSize: `${montoSize}px`, fontWeight: 800, color: '#7A3E06' }}>
          {money(monto)}
        </span>
      </div>
      {nota && (
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-pending-text)', marginTop: '6px' }}>
          {nota}
        </div>
      )}
    </div>
  );
}
