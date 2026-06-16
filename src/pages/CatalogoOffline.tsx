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
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonNote,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { logOutOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { useAuthContext } from '../context/AuthContext';

// ── Componente ────────────────────────────────────────────────

export function CatalogoOfflinePage() {
  const { signOut } = useAuthContext();
  const { productos, loading, error } = useCatalog();
  const [search, setSearch] = useState('');

  const filtrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Catálogo</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
            <IonButton onClick={() => signOut()} title="Cerrar sesión">
              <IonIcon icon={logOutOutline} style={{ color: 'var(--color-on-dark)' }} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
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
          <IonList>
            {filtrados.map((producto) => (
              <div key={producto.id} style={{ marginBottom: 'var(--space-sm)' }}>
                {/* Encabezado del producto */}
                <IonItem
                  style={{
                    '--background': 'var(--color-navy)',
                    '--color': 'var(--color-on-dark)',
                    '--padding-start': 'var(--space-md)',
                  }}
                  lines="none"
                >
                  <IonLabel>
                    <h2 style={{ color: 'var(--color-on-dark)', fontWeight: 'var(--font-weight-bold)' }}>{producto.nombre}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'var(--font-size-sm)' }}>
                      Unidad de compra: {producto.unidad_compra}
                      {producto.precio_preferencial != null && (
                        <> · Precio pref: ${producto.precio_preferencial.toFixed(2)}</>
                      )}
                    </p>
                  </IonLabel>
                  <IonBadge
                    slot="end"
                    style={{
                      backgroundColor: 'var(--color-cyan)',
                      color: 'var(--color-navy)',
                    }}
                  >
                    {producto.presentaciones.length} pres.
                  </IonBadge>
                </IonItem>

                {/* Presentaciones del producto */}
                {producto.presentaciones.length === 0 && (
                  <IonItem>
                    <IonNote>Sin presentaciones activas</IonNote>
                  </IonItem>
                )}

                {producto.presentaciones.map((pres) => (
                  <IonItem key={pres.id} style={{ '--padding-start': 'var(--space-xl)' }}>
                    <IonLabel>
                      <h3>{pres.nombre}</h3>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {pres.unidad_venta} · factor {pres.factor_conversion}
                      </p>
                    </IonLabel>
                    <div slot="end" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, fontVariantNumeric: 'var(--numeric)' }}>
                        May: ${pres.precio_mayoreo.toFixed(2)}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontVariantNumeric: 'var(--numeric)' }}>
                        Men: ${pres.precio_menudeo.toFixed(2)}
                      </div>
                    </div>
                  </IonItem>
                ))}
              </div>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
