/**
 * Logiclean Ruta — Chip
 *
 * Etiqueta compacta del prototipo (tipo de cliente, estado, urgencia…).
 * Estilo base: 11px / peso 800 / radio 6px. Sólo presentación.
 */

import type { CSSProperties, ReactNode } from 'react';

export type ChipTone =
  | 'menudeo' // lime sobre navy
  | 'mayoreo' // navy sobre blanco
  | 'neutral' // relleno gris
  | 'primarySoft' // azul suave
  | 'lime'
  | 'amber'
  | 'error'
  | 'pending'; // ámbar suave (texto cálido)

const TONES: Record<ChipTone, CSSProperties> = {
  menudeo: { background: 'var(--color-lime)', color: 'var(--color-navy)' },
  mayoreo: { background: 'var(--color-navy)', color: '#fff' },
  neutral: { background: 'var(--color-surface-muted)', color: '#5B6678' },
  primarySoft: { background: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  lime: { background: 'var(--color-lime)', color: 'var(--color-navy)' },
  amber: { background: 'var(--color-amber)', color: '#231A05' },
  error: { background: 'var(--color-error)', color: '#fff' },
  pending: { background: '#FDECEA', color: 'var(--color-error-text)' },
};

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  style?: CSSProperties;
}

export function Chip({ children, tone = 'neutral', style }: ChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '11px',
        fontWeight: 800,
        padding: '2px 7px',
        borderRadius: '6px',
        whiteSpace: 'nowrap',
        lineHeight: 1.3,
        ...TONES[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
