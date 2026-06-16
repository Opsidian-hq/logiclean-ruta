/**
 * Logiclean Ruta — RutaPage (vendedor) · H-08 Ruta del día
 *
 * Lista de clientes/prospectos a visitar hoy (por día de ruta o fecha próxima).
 * Cada uno ofrece "Vender" → abre el flujo de venta con el cliente
 * preseleccionado. Solo lectura: insertar/reprogramar (H-09) es Inc 3.
 * Ruta: /ruta
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonNote,
  IonText,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { cartOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useRutaDelDia } from '../../hooks/useRutaDelDia';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';

const HOY = new Date().toLocaleDateString('es-MX', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function RutaPage() {
  const { clientes, loading, error } = useRutaDelDia();
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Ruta del día</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonNote
          style={{ display: 'block', padding: '12px 16px 4px', fontSize: '13px' }}
        >
          {HOY.charAt(0).toUpperCase() + HOY.slice(1)}
        </IonNote>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '24px' }}>
            <IonText color="danger">
              <p>Error al cargar la ruta: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && clientes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonText color="medium">
              <p>No hay clientes en la ruta de hoy.</p>
            </IonText>
          </div>
        )}

        {!loading && !error && clientes.length > 0 && (
          <IonList>
            {clientes.map((c) => (
              <IonItem key={c.id}>
                <IonLabel>
                  <h2 style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                    {c.nombre}
                  </h2>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>
                    {c.tipo}
                    {c.dia_ruta && <> · {c.dia_ruta}</>}
                    {c.fecha_proxima_visita && <> · visita: {c.fecha_proxima_visita}</>}
                  </p>
                </IonLabel>

                <IonBadge
                  slot="start"
                  style={{
                    backgroundColor:
                      c.estado === 'prospecto'
                        ? 'var(--color-amber)'
                        : 'var(--color-lime)',
                    color: 'var(--color-navy)',
                  }}
                >
                  {c.estado}
                </IonBadge>

                <IonButton
                  slot="end"
                  size="small"
                  style={{ '--background': 'var(--color-primary)' }}
                  onClick={() => history.push(`/venta?cliente=${c.id}`)}
                >
                  <IonIcon icon={cartOutline} slot="start" />
                  Vender
                </IonButton>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
