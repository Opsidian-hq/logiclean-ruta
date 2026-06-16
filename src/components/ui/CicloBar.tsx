/**
 * Logiclean Ruta — CicloBar
 *
 * Barras del ciclo de visitas (prototipo): N segmentos, los completados en
 * navy y los pendientes en gris. Opcionalmente resalta el último avance en
 * lime. Sólo presentación.
 */

interface CicloBarProps {
  /** Visitas completadas. */
  actual: number;
  /** Total del ciclo (objetivo). */
  objetivo: number;
  /** Segmentos a lo ancho (height 9) en vez de compactos (17×5). */
  block?: boolean;
  /** Pinta el último segmento completado en lime (avance reciente). */
  highlightLast?: boolean;
}

export function CicloBar({ actual, objetivo, block = false, highlightLast = false }: CicloBarProps) {
  const filled = Math.max(0, Math.min(actual, objetivo));

  return (
    <div style={{ display: 'flex', gap: block ? '7px' : '3px' }}>
      {Array.from({ length: objetivo }, (_, i) => {
        const done = i < filled;
        const isLast = highlightLast && i === filled - 1;
        return (
          <div
            key={i}
            style={{
              flex: block ? 1 : 'none',
              width: block ? undefined : '17px',
              height: block ? '9px' : '5px',
              borderRadius: block ? '5px' : '3px',
              background: isLast
                ? 'var(--color-lime)'
                : done
                  ? 'var(--color-navy)'
                  : '#D7DCE5',
            }}
          />
        );
      })}
    </div>
  );
}
