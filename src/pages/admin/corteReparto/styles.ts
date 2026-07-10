/**
 * Logiclean Ruta — Corte por reparto: estilos y helpers compartidos (Inc 7.4)
 */

import type { CSSProperties } from 'react';

export const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  fontWeight: 800,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
};

export const rowBetween: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
};

/** Iniciales de un nombre ("Rosa Martínez" → "RM"), para el avatar circular. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const letras = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return letras.join('') || '?';
}
