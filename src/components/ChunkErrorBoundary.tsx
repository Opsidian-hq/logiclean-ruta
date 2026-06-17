/**
 * Logiclean Ruta — ChunkErrorBoundary
 *
 * Captura fallos al cargar un chunk de ruta (code-splitting). El caso típico:
 * el vendedor está **sin conexión** y navega por primera vez a una sección cuyo
 * chunk aún no se descargó ni quedó en el precache del service worker. En vez de
 * una pantalla en blanco, muestra un estado de error útil con opción de
 * reintentar (que sirve al recuperar señal).
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnóstico; el fallo más común es un import dinámico que no resolvió
    // (chunk no cacheado + sin conexión).
    console.error('[ChunkErrorBoundary] No se pudo cargar la sección:', error, info);
  }

  private retry = () => {
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '10px',
          padding: '24px',
        }}
      >
        <div
          style={{
            width: '70px',
            height: '70px',
            borderRadius: '20px',
            background: 'var(--color-surface-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
            fontWeight: 800,
            color: 'var(--color-navy)',
          }}
        >
          ⤓
        </div>
        <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '6px' }}>
          No se pudo abrir esta sección
        </div>
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45, maxWidth: '320px' }}>
          {online
            ? 'Algo falló al cargar esta parte de la app. Reintenta.'
            : 'Esta sección aún no está descargada en el equipo. Conéctate una vez para guardarla y vuelve a intentarlo.'}
        </div>
        <button
          type="button"
          onClick={this.retry}
          style={{
            marginTop: '8px',
            minHeight: '46px',
            padding: '0 22px',
            border: 'none',
            borderRadius: '12px',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: 'var(--shadow-cta)',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }
}
