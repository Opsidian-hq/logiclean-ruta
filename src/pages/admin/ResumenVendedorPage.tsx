/**
 * Logiclean Ruta — ResumenVendedorPage (H-15 — gerente)
 *
 * Resumen de solo lectura de un vendedor: ventas y cartera, y bolsas netas
 * de gastos de ruta del periodo en curso. Se abre al tocar al vendedor en
 * "Caja por vendedor" (Inicio) — antes vivía como parte del formulario de
 * corte, pero es una consulta, no un paso del registro del cierre.
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import type { CSSProperties } from 'react';
import { useVendedorResumen } from '../../hooks/useVendedorResumen';
import type { AbonoSaldoVendedor } from '../../db/schema';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';

interface ResumenVendedorPageProps {
  vendedorId: string;
  onClose: () => void;
}

const money = (n: number) => `$${n.toFixed(2)}`;

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const etiquetaMovimiento = (m: AbonoSaldoVendedor) =>
  m.direccion === 'negocio_a_vendedor' ? 'Retiro de caja' : 'Devolución a caja';

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

export function ResumenVendedorPage({ vendedorId, onClose }: ResumenVendedorPageProps) {
  const { vendedor, snapshot, saldoNegocio, movimientos, loading, error } = useVendedorResumen(vendedorId);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onClose} style={{ '--color': 'var(--color-on-dark)' }}>
              Cerrar
            </IonButton>
          </IonButtons>
          <IonTitle>{vendedor?.nombre ?? 'Resumen del vendedor'}</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {!loading && error && (
            <IonText color="danger">
              <p style={{ fontSize: 'var(--font-size-sm)' }}>Error al calcular el resumen: {error}</p>
            </IonText>
          )}

          {!loading && !error && snapshot && (
            <>
              {/* ── Saldo con el negocio (Inc 7.5) ── */}
              <div>
                <span style={sectionLabel}>Saldo con el negocio</span>
                <Card padding="14px">
                  <div style={rowBetween}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>
                      {saldoNegocio === 0 ? 'Al corriente' : saldoNegocio < 0 ? 'Debe al negocio' : 'A favor del vendedor'}
                    </span>
                    <Chip
                      tone={saldoNegocio === 0 ? 'neutral' : saldoNegocio < 0 ? 'error' : 'amber'}
                      style={saldoNegocio > 0 ? { background: '#FEF3E2', color: '#7A3E06' } : undefined}
                    >
                      {money(Math.abs(saldoNegocio))}
                    </Chip>
                  </div>
                </Card>
              </div>

              {/* ── Movimientos de caja (H-15): retiros/devoluciones del corte vigente. ──
                  El saldo de arriba puede dar $0 aunque haya movimientos (p.ej. un retiro
                  de honorario compensado por un cobro de cartera vieja) — se listan para
                  que el gerente pueda auditar qué pasó, no solo el neto. */}
              {movimientos.length > 0 && (
                <div>
                  <span style={sectionLabel}>Movimientos de caja</span>
                  <Card padding="14px">
                    {movimientos.map((m, idx) => (
                      <div
                        key={m.id}
                        style={{
                          paddingTop: idx ? '10px' : 0,
                          marginTop: idx ? '10px' : 0,
                          borderTop: idx ? '1px solid var(--color-divider)' : 'none',
                        }}
                      >
                        <div style={rowBetween}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-navy)' }}>
                            {etiquetaMovimiento(m)}
                          </span>
                          <span
                            className="numeric"
                            style={{
                              fontSize: '14px',
                              fontWeight: 800,
                              color: m.direccion === 'negocio_a_vendedor' ? 'var(--color-error)' : 'var(--color-navy)',
                            }}
                          >
                            {m.direccion === 'negocio_a_vendedor' ? '−' : '+'}
                            {money(m.monto)}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginTop: '2px' }}>
                          {fechaHora(m.fecha)} · {m.forma_pago}
                          {m.nota ? ` · ${m.nota}` : ''}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* ── Ventas y cartera ── */}
              <div>
                <span style={sectionLabel}>Ventas y cartera</span>
                <Card padding="14px">
                  <div style={rowBetween}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Ventas del periodo</span>
                    <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(snapshot.ventasTotal)}</span>
                  </div>
                  <div style={{ ...rowBetween, marginTop: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Cobrado</span>
                    <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(snapshot.cobradoTotal)}</span>
                  </div>
                  <div style={{ ...rowBetween, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-divider)' }}>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>Cartera (crédito vivo)</span>
                    <Chip tone={snapshot.saldoCartera > 0 ? 'pending' : 'menudeo'}>{money(snapshot.saldoCartera)}</Chip>
                  </div>
                </Card>
              </div>

              {/* ── Bolsas del vendedor ── */}
              <div>
                <span style={sectionLabel}>Bolsas del vendedor · netas de gastos de ruta</span>
                <Card padding="14px">
                  {(['efectivo', 'transferencia'] as const).map((bolsa, idx) => {
                    const b = snapshot.bolsas[bolsa];
                    return (
                      <div
                        key={bolsa}
                        style={{
                          paddingTop: idx ? '12px' : 0,
                          marginTop: idx ? '12px' : 0,
                          borderTop: idx ? '1px solid var(--color-divider)' : 'none',
                        }}
                      >
                        <div style={rowBetween}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)', textTransform: 'capitalize' }}>
                            {bolsa}
                          </span>
                          <span className="numeric" style={{ fontSize: '20px', fontWeight: 800, color: b.neto < 0 ? 'var(--color-error)' : 'var(--color-navy)' }}>
                            {money(b.neto)}
                          </span>
                        </div>
                        <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
                          cobrado {money(b.cobrado)} − gastos {money(b.gastos)}
                          {b.neto < 0 && <Chip tone="error" style={{ marginLeft: '8px' }}>descuadre</Chip>}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
