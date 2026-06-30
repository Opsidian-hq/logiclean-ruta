/**
 * Logiclean Ruta — DiaVisitaSelect
 *
 * Selector de día semanal de ruta (`dia_ruta`). Sustituye el texto libre para
 * evitar typos que, por la normalización de `lib/ruta.ts`, sacarían al cliente
 * de su ruta. Guarda el nombre con mayúscula inicial (p. ej. "Lunes"), que
 * `normalizar()` compara sin distinguir mayúsculas ni acentos.
 *
 * `value` = nombre del día o null (sin día fijo).
 */

import { IonSelect, IonSelectOption } from '@ionic/react';
import { DIAS_VISITA } from '../../lib/diasVisita';

interface DiaVisitaSelectProps {
  value: string | null;
  onChange: (dia: string | null) => void;
  /** Texto del placeholder cuando no hay día seleccionado. */
  placeholder?: string;
}

// Centinela interno para la opción "sin día fijo" (IonSelect no admite null).
const SIN_DIA = '__sin_dia__';

export function DiaVisitaSelect({
  value,
  onChange,
  placeholder = 'Selecciona un día',
}: DiaVisitaSelectProps) {
  return (
    <IonSelect
      aria-label="Día de visita"
      value={value ?? SIN_DIA}
      placeholder={placeholder}
      onIonChange={(e) =>
        onChange(e.detail.value === SIN_DIA ? null : e.detail.value)
      }
    >
      <IonSelectOption value={SIN_DIA}>Sin día fijo</IonSelectOption>
      {DIAS_VISITA.map((d) => (
        <IonSelectOption key={d} value={d}>
          {d}
        </IonSelectOption>
      ))}
    </IonSelect>
  );
}
