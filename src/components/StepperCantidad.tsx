/**
 * Logiclean Ruta — StepperCantidad
 *
 * Control de cantidad con botones −/+ y campo editable, pensado para uso táctil
 * (objetivos ≥ 48px, ADR-0001). Nunca baja del mínimo (0 por defecto).
 */

import { IonButton, IonIcon, IonInput } from '@ionic/react';
import { addOutline, removeOutline } from 'ionicons/icons';

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
      <IonButton
        fill="outline"
        size="small"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - step))}
        style={{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)', margin: 0 }}
        aria-label="Disminuir"
      >
        <IonIcon icon={removeOutline} slot="icon-only" />
      </IonButton>

      <IonInput
        type="number"
        value={String(value)}
        onIonInput={(e) => onChange(clamp(parseFloat(e.detail.value ?? '')))}
        min={String(min)}
        max={max != null ? String(max) : undefined}
        step={String(step)}
        inputmode="decimal"
        disabled={disabled}
        style={{
          width: '64px',
          textAlign: 'center',
          fontVariantNumeric: 'var(--numeric)',
          '--padding-start': 'var(--space-xs)',
          '--padding-end': 'var(--space-xs)',
        }}
      />

      <IonButton
        fill="outline"
        size="small"
        disabled={disabled || (max != null && value >= max)}
        onClick={() => onChange(clamp(value + step))}
        style={{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)', margin: 0 }}
        aria-label="Aumentar"
      >
        <IonIcon icon={addOutline} slot="icon-only" />
      </IonButton>
    </div>
  );
}
