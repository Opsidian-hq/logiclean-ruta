/**
 * Logiclean Ruta — CatalogoOffline (vendedor)
 *
 * Vista de solo lectura del catálogo para vendedores.
 * Lee exclusivamente desde Dexie (funciona sin conexión).
 * Ruta: /catalogo
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useState, useCallback } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { CuentaButton } from '../components/CuentaButton';
import { ConnectivityStrip } from '../components/ui/ConnectivityStrip';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';

const money = (n: number) => `$${n.toFixed(2)}`;

// ── Componente ────────────────────────────────────────────────

export function CatalogoOfflinePage() {
  const { productos, loading, error, refresh } = useCatalog();
  const [search, setSearch] = useState('');

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const filtrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Catálogo</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip text="Catálogo guardado en el equipo · disponible sin conexión" />
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Buscador */}
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar producto..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {/* Estados */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
            <IonText color="medium">
              <p>Cargando catálogo...</p>
            </IonText>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar el catálogo: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                {search
                  ? `Sin resultados para "${search}"`
                  : 'No hay productos en el catálogo local.'}
              </p>
            </IonText>
          </div>
        )}

        {/* Lista de productos */}
        {!loading && !error && filtrados.length > 0 && (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filtrados.map((producto) => (
              <Card key={producto.id} padding="0" style={{ overflow: 'hidden' }}>
                {/* Encabezado del producto */}
                <div
                  style={{
                    background: 'var(--color-navy)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '11px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '16.5px', fontWeight: 800, color: '#fff' }}>{producto.nombre}</div>
                    <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                      Compra: {producto.unidad_compra}
                      {producto.precio_preferencial != null && <> · pref {money(producto.precio_preferencial)}</>}
                    </div>
                  </div>
                  <span
                    className="numeric"
                    style={{
                      flex: 'none',
                      background: 'var(--color-cyan)',
                      color: 'var(--color-navy)',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '7px',
                    }}
                  >
                    {producto.presentaciones.length} pres.
                  </span>
                </div>

                {/* Presentaciones del producto */}
                <div style={{ padding: '4px 14px' }}>
                  {producto.presentaciones.length === 0 && (
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', padding: '11px 0' }}>
                      Sin presentaciones activas
                    </div>
                  )}

                  {producto.presentaciones.map((pres, idx) => (
                    <div
                      key={pres.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '11px',
                        padding: '11px 0',
                        borderBottom:
                          idx < producto.presentaciones.length - 1 ? '1px solid var(--color-divider)' : 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-body)' }}>
                          {pres.nombre}
                          <span
                            style={{
                              background: 'var(--color-surface-muted)',
                              color: '#5B6678',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '5px',
                              marginLeft: '6px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pres.unidad_venta}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
                          factor {pres.factor_conversion}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Chip tone="mayoreo">May</Chip>
                          <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>
                            {money(pres.precio_mayoreo)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Chip tone="menudeo">Men</Chip>
                          <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                            {money(pres.precio_menudeo)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
