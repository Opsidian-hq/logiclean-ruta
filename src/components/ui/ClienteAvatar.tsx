/**
 * Logiclean Ruta — ClienteAvatar
 *
 * Cuadro de iniciales del cliente (prototipo: 40px, radio 11px, azul suave).
 */

interface ClienteAvatarProps {
  nombre: string;
  /** Lado del cuadro en px. Prototipo: 40 (cliente) / 38 (resumen). */
  size?: number;
}

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export function ClienteAvatar({ nombre, size = 40 }: ClienteAvatarProps) {
  return (
    <div
      className="numeric"
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '11px',
        background: 'var(--color-primary-soft)',
        color: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size >= 40 ? '15px' : '14px',
        fontWeight: 800,
      }}
    >
      {iniciales(nombre)}
    </div>
  );
}
