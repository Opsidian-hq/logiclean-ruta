/**
 * Logiclean Ruta — ProspectosPanelPage (H-03 — gerente)
 *
 * Embudo de prospectos por etapa del ciclo + adherencia al seguimiento.
 * Indicadores de cartera continuos (no se reinician con el corte).
 * Ruta: /admin/prospectos
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonNote,
  IonText,
  IonSpinner,
} from '@ionic/react';
import { usePanelGerente } from '../../hooks/usePanelGerente';
import { CICLO_OBJETIVO } from '../../lib/prospectos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';

export function ProspectosPanelPage() {
  const { embudo, adherencia, loading, error } = usePanelGerente();

  const maxEtapa = Math.max(1, ...embudo.etapas.map((e) => e.count));
  const totalProspectos = embudo.etapas.reduce((acc, e) => acc + e.count, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Prospectos</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>Error al cargar el panel: {error}</p>
            </IonText>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Adherencia ── */}
            <IonList>
              <IonListHeader>
                <IonLabel>Adherencia al seguimiento</IonLabel>
              </IonListHeader>
              <IonItem lines="none">
                <IonLabel>
                  <h1
                    style={{
                      fontSize: '40px',
                      fontWeight: 800,
                      color: 'var(--color-navy)',
                      margin: 0,
                      fontVariantNumeric: 'var(--numeric)',
                    }}
                  >
                    {adherencia.pct}%
                  </h1>
                  <IonNote>
                    {adherencia.total === 0
                      ? 'Aún no hay visitas con fecha vencida para evaluar.'
                      : `${adherencia.aTiempo} de ${adherencia.total} visitas recibieron su siguiente visita a tiempo.`}
                  </IonNote>
                </IonLabel>
              </IonItem>
            </IonList>

            {/* ── Embudo ── */}
            <IonList>
              <IonListHeader>
                <IonLabel>
                  Embudo de prospectos ({totalProspectos} en seguimiento)
                </IonLabel>
              </IonListHeader>

              {embudo.etapas.map((e) => (
                <IonItem key={e.etapa}>
                  <IonLabel style={{ minWidth: '90px', flex: '0 0 auto' }}>
                    Visita {e.etapa}
                    {e.etapa === CICLO_OBJETIVO ? '+' : ''}
                  </IonLabel>
                  {/* Barra proporcional */}
                  <div
                    style={{
                      flex: 1,
                      height: '20px',
                      margin: '0 12px',
                      background: 'var(--color-surface-muted)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(e.count / maxEtapa) * 100}%`,
                        height: '100%',
                        background: 'var(--color-primary)',
                      }}
                    />
                  </div>
                  <IonNote slot="end" style={{ fontWeight: 700 }}>
                    {e.count}
                  </IonNote>
                </IonItem>
              ))}

              <IonItem lines="none">
                <IonLabel>Convertidos (cartera activa)</IonLabel>
                <IonNote slot="end" style={{ fontWeight: 700, color: 'var(--color-navy)' }}>
                  {embudo.convertidos}
                </IonNote>
              </IonItem>
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
