/**
 * Logiclean Ruta — StepperCantidad
 *
 * Control de cantidad −/+ del prototipo: una sola caja con borde fino, celdas
 * táctiles de 46px y el número en azul-navy. El centro sigue siendo editable
 * para capturar cantidades grandes sin perder la apariencia. Nunca baja del
 * mínimo (0 por defecto).
 */

import { IonInput } from '@ionic/react';
import type { CSSProperties } from 'react';

interface StepperCantidadProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export function StepperCantidad({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  disabled = false,
}: StepperCantidadProps) {
  const clamp = (n: number) => {
    let v = Number.isFinite(n) ? n : min;
    if (v < min) v = min;
    if (max != null && v > max) v = max;
    return v;
  };

  const atMin = disabled || value <= min;
  const atMax = disabled || (max != null && value >= max);

  const cellStyle = (off: boolean): CSSProperties => ({
    width: '46px',
    height: '46px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: off ? 'var(--color-disabled)' : 'var(--color-primary)',
    fontSize: '23px',
    fontWeight: 700,
    cursor: off ? 'default' : 'pointer',
    userSelect: 'none',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: '1.5px solid var(--color-stepper-border)',
        borderRadius: '11px',
        overflow: 'hidden',
        background: 'var(--color-surface)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div
        role="button"
        aria-label="Disminuir"
        tabIndex={atMin ? -1 : 0}
        onClick={() => !atMin && onChange(clamp(value - step))}
        onKeyDown={(e) => e.key === 'Enter' && !atMin && onChange(clamp(value - step))}
        style={cellStyle(atMin)}
      >
        −
      </div>

      <IonInput
        type="number"
        value={String(value)}
        onIonInput={(e) => onChange(clamp(parseFloat(e.detail.value ?? '')))}
        min={String(min)}
        max={max != null ? String(max) : undefined}
        step={String(step)}
        inputmode="decimal"
        disabled={disabled}
        aria-label="Cantidad"
        style={{
          width: '38px',
          minHeight: 'auto',
          textAlign: 'center',
          fontSize: '17px',
          fontWeight: 800,
          color: 'var(--color-navy)',
          fontVariantNumeric: 'var(--numeric)',
          '--padding-start': '0',
          '--padding-end': '0',
          '--padding-top': '0',
          '--padding-bottom': '0',
        }}
      />

      <div
        role="button"
        aria-label="Aumentar"
        tabIndex={atMax ? -1 : 0}
        onClick={() => !atMax && onChange(clamp(value + step))}
        onKeyDown={(e) => e.key === 'Enter' && !atMax && onChange(clamp(value + step))}
        style={cellStyle(atMax)}
      >
        +
      </div>
    </div>
  );
}
