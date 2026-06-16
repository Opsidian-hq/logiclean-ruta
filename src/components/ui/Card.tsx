/**
 * Logiclean Ruta — Card
 *
 * Superficie blanca elevada del prototipo: borde fino, esquinas suaves.
 * Sólo composición visual; sin lógica.
 */

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Padding interno. Por defecto el del prototipo (≈13px). */
  padding?: CSSProperties['padding'];
}

export function Card({ children, padding = '13px 14px', style, ...rest }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-card-border)',
        borderRadius: 'var(--radius-card)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
