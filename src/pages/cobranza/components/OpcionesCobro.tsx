/**
 * Logiclean Ruta — OpcionesCobro (P1)
 *
 * Selector de las tres formas de cobrar una venta: total, parcial o a crédito.
 * Blancos de toque ≥ 44 px (prototipo: 78 px). El seleccionado se rellena de
 * azul primario con palomita; los demás quedan en blanco con borde.
 */

import type { CSSProperties } from 'react';

export type ModoCobro = 'total' | 'parcial' | 'credito';

interface OpcionDef {
  modo: ModoCobro;
  titulo: string;
  detalle: string;
}

const OPCIONES: OpcionDef[] = [
  { modo: 'total', titulo: 'Total', detalle: 'monto completo' },
  { modo: 'parcial', titulo: 'Parcial', detalle: 'abona una parte' },
  { modo: 'credito', titulo: 'A crédito', detalle: 'sin pago hoy' },
];

interface OpcionesCobroProps {
  value: ModoCobro | null;
  onChange: (modo: ModoCobro) => void;
}

export function OpcionesCobro({ value, onChange }: OpcionesCobroProps) {
  return (
    <div role="radiogroup" aria-label="¿Cómo se cobra?" style={{ display: 'flex', gap: '8px' }}>
      {OPCIONES.map((op) => {
        const selected = value === op.modo;
        return (
          <button
            key={op.modo}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(op.modo)}
            style={cardStyle(selected)}
          >
            <span style={{ fontSize: '15px', fontWeight: 800, color: selected ? '#fff' : 'var(--color-body)' }}>
              {op.titulo}
            </span>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textAlign: 'center',
                color: selected ? '#C5C8FF' : '#8A94A6',
              }}
            >
              {op.detalle}
            </span>
            {selected && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 800, marginTop: '1px' }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function cardStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    minHeight: '78px',
    borderRadius: '14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    padding: '8px 4px',
    cursor: 'pointer',
    background: selected ? 'var(--color-primary)' : 'var(--color-surface)',
    border: selected ? '1.5px solid var(--color-primary)' : '1.5px solid #CFD6E2',
    boxShadow: selected ? '0 6px 16px -6px rgba(6,6,254,.5)' : 'none',
  };
}
