/**
 * Logiclean Ruta — FormaPagoSelector (P1, P3, P4)
 *
 * Selector binario de forma de pago: **Efectivo** o **Transferencia**
 * (únicamente estas dos — sin tarjeta, fuera del MVP). El seleccionado se
 * rellena de azul con palomita. Blancos de toque ≥ 50 px.
 */

import type { CSSProperties } from 'react';
import type { FormaPago } from '../../../lib/cobros';

interface FormaPagoSelectorProps {
  value: FormaPago;
  onChange: (forma: FormaPago) => void;
  /** Alto del control. Prototipo: 52 (P1) / 50 (resto) / 46 (P4 compacto). */
  height?: number;
}

const OPCIONES: { forma: FormaPago; label: string }[] = [
  { forma: 'efectivo', label: 'Efectivo' },
  { forma: 'transferencia', label: 'Transferencia' },
];

export function FormaPagoSelector({ value, onChange, height = 50 }: FormaPagoSelectorProps) {
  return (
    <div role="radiogroup" aria-label="Forma de pago" style={{ display: 'flex', gap: '9px' }}>
      {OPCIONES.map((op) => {
        const selected = value === op.forma;
        return (
          <button
            key={op.forma}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(op.forma)}
            style={btnStyle(selected, height)}
          >
            <span style={{ fontSize: '15.5px', fontWeight: selected ? 800 : 700, color: selected ? '#fff' : '#3A4150' }}>
              {op.label}
            </span>
            {selected && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 800 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function btnStyle(selected: boolean, height: number): CSSProperties {
  return {
    flex: 1,
    minHeight: `${height}px`,
    borderRadius: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    cursor: 'pointer',
    background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
    border: selected ? '1.5px solid var(--color-primary)' : '1.5px solid #CFD6E2',
  };
}
