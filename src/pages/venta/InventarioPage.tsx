/**
 * Logiclean Ruta — InventarioPage (vendedor)
 *
 * Carga/ajuste del inventario del vehículo del día. El vendedor fija cuántas
 * unidades de cada presentación trae cargadas. Escritura local + cola de sync.
 * Ruta: /inventario
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
  IonButtons,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonNote,
} from '@ionic/react';
import { useState } from 'react';
import { useInventario } from '../../hooks/useInventario';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';

export function InventarioPage() {
  const { rows, loading, error, setCantidad } = useInventario();
  const [search, setSearch] = useState('');

  const filtrados = rows.filter(
    (r) =>
      r.presentacion.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.productoNombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnidades = rows.reduce((acc, r) => acc + r.cantidad, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Inventario del vehículo</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value ?? '')}
          placeholder="Buscar presentación..."
          style={{ '--background': 'var(--color-surface)' }}
        />

        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar el inventario: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonText color="medium">
              <p>
                No hay presentaciones en el catálogo local. Sincroniza con
                conexión para descargarlo.
              </p>
            </IonText>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <>
            <IonNote
              style={{
                display: 'block',
                padding: 'var(--space-sm) var(--space-md)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {totalUnidades} unidad{totalUnidades !== 1 ? 'es' : ''} cargada
              {totalUnidades !== 1 ? 's' : ''} en total
            </IonNote>

            <IonList>
              {filtrados.map((row) => (
                <IonItem key={row.presentacion.id}>
                  <IonLabel>
                    <h2 style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                      {row.presentacion.nombre}
                    </h2>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                      {row.productoNombre} · {row.presentacion.unidad_venta}
                    </p>
                  </IonLabel>
                  <div slot="end">
                    <StepperCantidad
                      value={row.cantidad}
                      onChange={(v) => setCantidad(row.presentacion.id, v)}
                      min={0}
                    />
                  </div>
                </IonItem>
              ))}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
