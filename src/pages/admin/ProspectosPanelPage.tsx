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
  IonText,
  IonSpinner,
} from '@ionic/react';
import type { CSSProperties } from 'react';
import { usePanelGerente } from '../../hooks/usePanelGerente';
import { CICLO_OBJETIVO } from '../../lib/prospectos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';

const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
};

export function ProspectosPanelPage() {
  const { embudo, adherencia, loading, error } = usePanelGerente();

  const maxEtapa = Math.max(1, ...embudo.etapas.map((e) => e.count));
  const totalProspectos = embudo.etapas.reduce((acc, e) => acc + e.count, 0);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Prospectos</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
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
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* ── Adherencia ── */}
            <div>
              <span style={sectionLabel}>Adherencia al seguimiento</span>
              <Card padding="16px">
                <div
                  className="numeric"
                  style={{ fontSize: '40px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1, letterSpacing: '-0.5px' }}
                >
                  {adherencia.pct}%
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                  {adherencia.total === 0
                    ? 'Aún no hay visitas con fecha vencida para evaluar.'
                    : `${adherencia.aTiempo} de ${adherencia.total} visitas recibieron su siguiente visita a tiempo.`}
                </div>
              </Card>
            </div>

            {/* ── Embudo ── */}
            <div>
              <span style={sectionLabel}>Embudo de prospectos · {totalProspectos} en seguimiento</span>
              <Card padding="14px">
                {embudo.etapas.map((e) => (
                  <div key={e.etapa} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '7px 0' }}>
                    <span style={{ minWidth: '72px', fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)' }}>
                      Visita {e.etapa}
                      {e.etapa === CICLO_OBJETIVO ? '+' : ''}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: '20px',
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
                          borderRadius: 'var(--radius-sm)',
                          minWidth: e.count > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <span className="numeric" style={{ minWidth: '28px', textAlign: 'right', fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>
                      {e.count}
                    </span>
                  </div>
                ))}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--color-divider)',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>Convertidos · cartera activa</span>
                  <span className="numeric" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)' }}>
                    {embudo.convertidos}
                  </span>
                </div>
              </Card>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
