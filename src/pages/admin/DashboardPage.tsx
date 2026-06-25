/**
 * Logiclean Ruta — DashboardPage (H-15 — gerente) · Inc 4
 *
 * Panel consolidado del periodo en curso: ventas y posición de caja por
 * vendedor y bolsa (netos de gastos — flujo, se reinicia al corte), más el
 * embudo, la adherencia y la cartera activa (continuos). Resalta alertas.
 * Toda la lógica vive en `lib/dashboard` / `lib/corte` (puras).
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSpinner,
  IonText,
} from '@ionic/react';
import type { CSSProperties } from 'react';
import { useDashboard } from '../../hooks/useDashboard';
import { CICLO_OBJETIVO } from '../../lib/prospectos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';

const money = (n: number) => `$${n.toFixed(2)}`;

const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
};

const rowBetween: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
};

function Kpi({ label, valor, tono }: { label: string; valor: string; tono?: 'error' }) {
  return (
    <Card padding="13px 12px" style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#8A94A6' }}>
        {label}
      </div>
      <div
        className="numeric"
        style={{
          fontSize: '21px',
          fontWeight: 800,
          letterSpacing: '-0.5px',
          marginTop: '5px',
          color: tono === 'error' ? 'var(--color-error)' : 'var(--color-navy)',
        }}
      >
        {valor}
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const { dashboard, loading, error, refresh } = useDashboard();
  const maxEtapa = Math.max(1, ...(dashboard?.embudo.etapas.map((e) => e.count) ?? [1]));

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Inicio</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
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
            <IonText color="danger"><p>Error al cargar el panel: {error}</p></IonText>
          </div>
        )}

        {!loading && !error && dashboard && (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-0.2px' }}>
                Periodo en curso
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                Flujo desde el último corte · cartera continua
              </div>
            </div>

            {/* ── Alertas ── */}
            {dashboard.alertas.length > 0 && (
              <div style={{ background: '#FEF3E2', border: '1.5px solid #F6C97C', borderRadius: '16px', padding: '13px 15px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-pending-text)', marginBottom: '6px' }}>
                  ⚠ Atención
                </div>
                {dashboard.alertas.map((a, i) => (
                  <div key={i} style={{ fontSize: '13px', fontWeight: 600, color: '#7A3E06', lineHeight: 1.4 }}>· {a}</div>
                ))}
              </div>
            )}

            {/* ── KPIs de flujo ── */}
            <div>
              <span style={sectionLabel}>Flujo del periodo</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Kpi label="Ventas" valor={money(dashboard.ventasTotal)} />
                <Kpi label="Efectivo" valor={money(dashboard.cajaEfectivo)} tono={dashboard.cajaEfectivo < 0 ? 'error' : undefined} />
                <Kpi label="Banco" valor={money(dashboard.cajaTransferencia)} tono={dashboard.cajaTransferencia < 0 ? 'error' : undefined} />
              </div>
            </div>

            {/* ── Caja por vendedor ── */}
            <div>
              <span style={sectionLabel}>Caja por vendedor · neta de gastos</span>
              <Card padding="14px">
                {dashboard.porVendedor.length === 0 && (
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#8A94A6' }}>Sin vendedores.</div>
                )}
                {dashboard.porVendedor.map((v, idx) => (
                  <div
                    key={v.vendedorId}
                    style={{
                      paddingTop: idx ? '12px' : 0,
                      marginTop: idx ? '12px' : 0,
                      borderTop: idx ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <div style={rowBetween}>
                      <span style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-navy)' }}>{v.nombre}</span>
                      {v.descuadre && <Chip tone="error">descuadre</Chip>}
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>
                        ventas <strong style={{ color: 'var(--color-navy)' }}>{money(v.ventas)}</strong>
                      </span>
                      <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>
                        efectivo <strong style={{ color: v.efectivo < 0 ? 'var(--color-error)' : 'var(--color-navy)' }}>{money(v.efectivo)}</strong>
                      </span>
                      <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>
                        banco <strong style={{ color: v.transferencia < 0 ? 'var(--color-error)' : 'var(--color-navy)' }}>{money(v.transferencia)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {/* ── Cartera: adherencia + embudo + activa (continuos) ── */}
            <div>
              <span style={sectionLabel}>Cartera · continua</span>
              <Card padding="16px">
                <div style={rowBetween}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8A94A6' }}>Adherencia</div>
                    <div className="numeric" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.05, marginTop: '2px' }}>
                      {dashboard.adherencia.pct}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8A94A6' }}>Cartera activa</div>
                    <div className="numeric" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.05, marginTop: '2px' }}>
                      {dashboard.carteraActiva}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-divider)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8A94A6', marginBottom: '10px' }}>
                    Embudo de prospectos
                  </div>
                  {dashboard.embudo.etapas.map((e) => (
                    <div key={e.etapa} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0' }}>
                      <span style={{ minWidth: '64px', fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)' }}>
                        Visita {e.etapa}{e.etapa === CICLO_OBJETIVO ? '+' : ''}
                      </span>
                      <div style={{ flex: 1, height: '18px', background: 'var(--color-surface-muted)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <div style={{ width: `${(e.count / maxEtapa) * 100}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 'var(--radius-sm)', minWidth: e.count > 0 ? '4px' : 0 }} />
                      </div>
                      <span className="numeric" style={{ minWidth: '26px', textAlign: 'right', fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>{e.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => refresh()}
              onKeyDown={(ev) => ev.key === 'Enter' && refresh()}
              style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)', padding: '6px', cursor: 'pointer' }}
            >
              ↻ Actualizar
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}
