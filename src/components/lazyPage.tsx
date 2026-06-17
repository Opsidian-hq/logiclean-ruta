/**
 * Logiclean Ruta — lazyPage
 *
 * Carga diferida (code-splitting) de una página de ruta. Cada página vive en su
 * propio chunk y solo se descarga al navegar a ella; el service worker la deja
 * en precache para usarla sin conexión después de la primera visita.
 *
 * Envuelve la página en un Suspense (skeleton de carga) y un ChunkErrorBoundary
 * (estado de error útil si el chunk no está cacheado y no hay señal).
 */

/* eslint-disable react-refresh/only-export-components -- factory de carga diferida, no un componente */
import { lazy, Suspense, type ComponentType } from 'react';
import { IonSpinner } from '@ionic/react';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';

function PageFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IonSpinner name="crescent" />
    </div>
  );
}

/**
 * Crea un componente de página con carga diferida a partir de un import dinámico
 * que resuelve a un export con nombre.
 *
 * @example
 *   const VentaPage = lazyPage(() => import('../pages/venta/VentaPage'), 'VentaPage');
 */
export function lazyPage<M, K extends keyof M>(
  loader: () => Promise<M>,
  named: K
): ComponentType {
  const Loaded = lazy(async () => {
    const mod = await loader();
    return { default: mod[named] as ComponentType };
  });

  return function LazyRoute() {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Loaded />
        </Suspense>
      </ChunkErrorBoundary>
    );
  };
}
