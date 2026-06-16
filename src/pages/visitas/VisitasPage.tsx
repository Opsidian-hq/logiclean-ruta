/**
 * Logiclean Ruta — VisitasPage (vendedor)
 *
 * Una sola pantalla con dos segmentos:
 *  - Hoy:    ruta del día (H-08) — clientes/prospectos a visitar hoy.
 *  - Semana: seguimiento de prospectos (H-02) — vencidos + por vencer, con
 *            ficha + registro de visita (H-01) y alta de prospecto.
 * Ruta: /visitas
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonBadge,
  IonNote,
  IonText,
  IonSpinner,
  IonIcon,
  IonModal,
  IonFab,
  IonFabButton,
} from '@ionic/react';
import { cartOutline, addOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRutaDelDia } from '../../hooks/useRutaDelDia';
import { useSeguimiento } from '../../hooks/useSeguimiento';
import { clasificarVencimiento } from '../../lib/prospectos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { FichaProspecto } from './components/FichaProspecto';
import { NuevoProspectoForm } from './components/NuevoProspectoForm';
import type { Cliente } from '../../db/schema';

const COLOR_VENCIMIENTO: Record<string, string> = {
  vencido: 'var(--color-error)',
  por_vencer: 'var(--color-amber)',
  al_dia: 'var(--color-lime)',
};

export function VisitasPage() {
  const [segmento, setSegmento] = useState<'hoy' | 'semana'>('hoy');
  const history = useHistory();

  const ruta = useRutaDelDia();
  const seg = useSeguimiento();

  const [fichaCliente, setFichaCliente] = useState<Cliente | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Visitas</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={segmento}
            onIonChange={(e) =>
              setSegmento((e.detail.value as 'hoy' | 'semana') ?? 'hoy')
            }
          >
            <IonSegmentButton value="hoy">
              <IonLabel>Hoy</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="semana">
              <IonLabel>Esta semana</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* ── Segmento HOY: ruta del día ── */}
        {segmento === 'hoy' && (
          <>
            {ruta.loading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {!ruta.loading && ruta.error && (
              <div style={{ padding: '24px' }}>
                <IonText color="danger">
                  <p>Error al cargar la ruta: {ruta.error}</p>
                </IonText>
              </div>
            )}

            {!ruta.loading && !ruta.error && ruta.clientes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonText color="medium">
                  <p>No hay clientes en la ruta de hoy.</p>
                </IonText>
              </div>
            )}

            {!ruta.loading && !ruta.error && ruta.clientes.length > 0 && (
              <IonList>
                {ruta.clientes.map((c) => (
                  <IonItem key={c.id}>
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
          </>
        )}

        {/* ── Segmento SEMANA: seguimiento de prospectos ── */}
        {segmento === 'semana' && (
          <>
            {seg.loading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {!seg.loading && seg.error && (
              <div style={{ padding: '24px' }}>
                <IonText color="danger">
                  <p>Error al cargar el seguimiento: {seg.error}</p>
                </IonText>
              </div>
            )}

            {!seg.loading && !seg.error && seg.prospectos.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonText color="medium">
                  <p>Sin prospectos por vencer esta semana.</p>
                </IonText>
              </div>
            )}

            {!seg.loading && !seg.error && seg.prospectos.length > 0 && (
              <IonList>
                {seg.prospectos.map((c) => {
                  const venc = clasificarVencimiento(c);
                  return (
                    <IonItem key={c.id} button onClick={() => setFichaCliente(c)}>
                      <div
                        slot="start"
                        style={{
                          width: '10px',
                          height: '40px',
                          borderRadius: '4px',
                          backgroundColor: COLOR_VENCIMIENTO[venc],
                        }}
                      />
                      <IonLabel>
                        <h2 style={{ fontWeight: 600, color: 'var(--color-navy)' }}>
                          {c.nombre}
                        </h2>
                        <p style={{ fontSize: '12px', color: '#6B7280' }}>
                          Visita {c.ciclo_visita} · próxima: {c.fecha_proxima_visita}
                        </p>
                      </IonLabel>
                      {venc === 'vencido' && (
                        <IonNote slot="end" color="danger" style={{ fontWeight: 600 }}>
                          Vencido
                        </IonNote>
                      )}
                    </IonItem>
                  );
                })}
              </IonList>
            )}

            {/* FAB: nuevo prospecto */}
            <IonFab vertical="bottom" horizontal="end" slot="fixed">
              <IonFabButton
                style={{ '--background': 'var(--color-primary)' }}
                onClick={() => setNuevoOpen(true)}
              >
                <IonIcon icon={addOutline} />
              </IonFabButton>
            </IonFab>
          </>
        )}
      </IonContent>

      {/* Modal: ficha del prospecto */}
      <IonModal isOpen={!!fichaCliente} onDidDismiss={() => setFichaCliente(null)}>
        {fichaCliente && (
          <FichaProspecto
            cliente={fichaCliente}
            cargarVisitas={seg.visitasDeCliente}
            onRegistrar={seg.registrarVisita}
            onClose={() => setFichaCliente(null)}
          />
        )}
      </IonModal>

      {/* Modal: nuevo prospecto */}
      <IonModal isOpen={nuevoOpen} onDidDismiss={() => setNuevoOpen(false)}>
        <NuevoProspectoForm
          onCrear={seg.crearProspecto}
          onClose={() => setNuevoOpen(false)}
        />
      </IonModal>
    </IonPage>
  );
}
