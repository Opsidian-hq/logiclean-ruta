/**
 * Logiclean Ruta — CatalogoOffline (vendedor)
 *
 * Vista de solo lectura del catálogo para vendedores.
 * Lee exclusivamente desde Dexie (funciona sin conexión).
 * Ruta: /catalogo
 */

import React from 'react';
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
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Catálogo</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
            <IonButton onClick={() => signOut()} title="Cerrar sesión">
              <IonIcon icon={logOutOutline} style={{ color: '#fff' }} />
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
          style={{ '--background': '#fff' }}
        />

        {/* Estados */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
            <IonText color="medium">
              <p>Cargando catálogo...</p>
            </IonText>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '24px' }}>
            <IonText color="danger">
              <p>Error al cargar el catálogo: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
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
              <div key={producto.id} style={{ marginBottom: '8px' }}>
                {/* Encabezado del producto */}
                <IonItem
                  style={{
                    '--background': 'var(--color-navy)',
                    '--color': '#fff',
                    '--padding-start': '16px',
                  }}
                  lines="none"
                >
                  <IonLabel>
                    <h2 style={{ color: '#fff', fontWeight: 700 }}>{producto.nombre}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
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
                  <IonItem key={pres.id} style={{ '--padding-start': '32px' }}>
                    <IonLabel>
                      <h3>{pres.nombre}</h3>
                      <p style={{ fontSize: '13px', color: '#6B7280' }}>
                        {pres.unidad_venta} · factor {pres.factor_conversion}
                      </p>
                    </IonLabel>
                    <div slot="end" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>
                        May: ${pres.precio_mayoreo.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
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
