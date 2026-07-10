/**
 * Logiclean Ruta — Corte por reparto: componentes compartidos entre pasos (Inc 7.4)
 */

import type { ReactNode } from 'react';
import { iniciales } from './styles';

interface AvatarInicialProps {
  nombre: string;
  size?: number;
  tono?: 'azul' | 'rojo';
}

export function AvatarInicial({ nombre, size = 34, tono = 'azul' }: AvatarInicialProps) {
  const colores =
    tono === 'rojo'
      ? { bg: '#F4B3AC', fg: '#911A11' }
      : { bg: '#EAF0FF', fg: 'var(--color-primary)' };
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: colores.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
      }}
    >
      <span style={{ color: colores.fg, fontSize: size * 0.38, fontWeight: 800 }}>{iniciales(nombre)}</span>
    </div>
  );
}

/** Banda informativa azul-suave (nota, contexto), patrón del prototipo. */
export function NotaInfo({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #C9D4FF',
        background: '#F6F8FF',
        borderRadius: '12px',
        padding: '11px 14px',
        fontSize: '12.5px',
        fontWeight: 600,
        color: '#3A4150',
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}
