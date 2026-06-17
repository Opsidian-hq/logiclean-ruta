/**
 * Logiclean Ruta — MontoCobroBox
 *
 * Caja del monto a cobrar. Dos modos:
 *  - precargado (read-only): el total, cuando el cobro es "Total" (P1).
 *  - editable: campo de monto para cobro parcial / saldo previo (P1, P3, P4).
 *
 * En modo editable resalta con borde azul. Blanco de toque ≥ 48 px.
 */

import type { CSSProperties } from 'react';
import { money } from '../../../lib/money';

interface MontoCobroBoxProps {
  label: string;
  /** Subtítulo opcional (p. ej. "Precargado con el total"). */
  hint?: string;
  /** Valor numérico actual. */
  monto: number;
  /** Si se provee, la caja es editable y notifica el nuevo monto. */
  onChange?: (monto: number) => void;
  /** Tamaño de la cifra. Prototipo: 26 (precargado) / 28 (editable) / 25/23. */
  montoSize?: number;
}

export function MontoCobroBox({ label, hint, monto, onChange, montoSize = 26 }: MontoCobroBoxProps) {
  const editable = !!onChange;

  return (
    <div style={boxStyle(editable)}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A94A6' }}>
          {label}
        </div>
        {hint && <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#3E6B22', marginTop: '2px' }}>{hint}</div>}
      </div>

      {editable ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <span className="numeric" style={{ fontSize: `${montoSize}px`, fontWeight: 800, color: 'var(--color-navy)' }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            aria-label={label}
            value={Number.isFinite(monto) ? String(monto) : ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            style={{
              width: '120px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              textAlign: 'right',
              fontFamily: 'inherit',
              fontVariantNumeric: 'tabular-nums',
              fontSize: `${montoSize}px`,
              fontWeight: 800,
              color: 'var(--color-navy)',
            }}
          />
        </div>
      ) : (
        <span className="numeric" style={{ fontSize: `${montoSize}px`, fontWeight: 800, color: 'var(--color-navy)' }}>
          {money(monto)}
        </span>
      )}
    </div>
  );
}

function boxStyle(editable: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    minHeight: '48px',
    background: 'var(--color-surface)',
    borderRadius: '14px',
    padding: '13px 15px',
    border: editable ? '1.5px solid var(--color-primary)' : '1px solid #E9EDF3',
    boxShadow: editable ? '0 0 0 4px rgba(6,6,254,.08)' : 'none',
  };
}
