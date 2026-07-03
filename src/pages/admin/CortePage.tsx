/**
 * Logiclean Ruta — CortePage (H-10 — gerente) · Inc 3, reescrito Inc 6.5
 *
 * Previsualiza y registra el corte semanal de un vendedor: bolsas netas de
 * gastos de ruta, cartera, salidas del negocio (backoffice), inventario de
 * bodega y reconciliación con La Moderna por consumo real (ADR-0009).
 * Resalta los descuadres antes de cerrar (riesgo T10), incluida la identidad
 * de control (recibido − devuelto = bidones abiertos). Toda la lógica de
 * dinero vive en `lib/corte`.
 *
 * Se usa tanto como ruta propia (`/admin/corte`) como incrustada en el modal
 * del FAB de Inicio (H-15) — en ese caso recibe `onClose` para mostrar el
 * botón de cerrar en vez de depender de la navegación por tabs.
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonLabel,
  IonItem,
  IonSpinner,
  IonText,
  IonAlert,
  IonToast,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useEffect, useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useCorte } from '../../hooks/useCorte';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';

interface CortePageProps {
  /** Presente cuando la página vive dentro del modal del FAB de Inicio. */
  onClose?: () => void;
}

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

export function CortePage({ onClose }: CortePageProps = {}) {
  const {
    vendedores,
    vendedorId,
    setVendedorId,
    periodoInicio,
    periodoFin,
    setPeriodoFin,
    snapshot,
    loading,
    error,
    registrar,
    refresh,
  } = useCorte();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [entregaEf, setEntregaEf] = useState('');
  const [entregaTr, setEntregaTr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Pre-llenar la entrega con el neto esperado cada vez que cambia el corte.
  useEffect(() => {
    if (!snapshot) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setEntregaEf(snapshot.bolsas.efectivo.neto.toFixed(2));
    setEntregaTr(snapshot.bolsas.transferencia.neto.toFixed(2));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [snapshot]);

  const efGap = snapshot ? (parseFloat(entregaEf) || 0) - snapshot.bolsas.efectivo.neto : 0;
  const trGap = snapshot ? (parseFloat(entregaTr) || 0) - snapshot.bolsas.transferencia.neto : 0;

  const doRegistrar = async () => {
    try {
      await registrar({ efectivo: parseFloat(entregaEf) || 0, transferencias: parseFloat(entregaTr) || 0 });
      setToast('Corte registrado. El periodo quedó cerrado.');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar el corte.');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          {onClose && (
            <IonButtons slot="start">
              <IonButton onClick={onClose} style={{ '--color': 'var(--color-on-dark)' }}>
                Cerrar
              </IonButton>
            </IonButtons>
          )}
          <IonTitle>Corte semanal</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ── Selector ── */}
          <div>
            <span style={sectionLabel}>Corte de</span>
            <Card padding="4px 14px">
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Vendedor</IonLabel>
                <IonSelect
                  value={vendedorId}
                  placeholder="Selecciona un vendedor"
                  onIonChange={(e) => setVendedorId(e.detail.value)}
                >
                  {vendedores.map((v) => (
                    <IonSelectOption key={v.id} value={v.id}>
                      {v.nombre}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Periodo inicia</IonLabel>
                <IonInput readonly value={periodoInicio || 'desde el primer movimiento'} />
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Periodo cierra</IonLabel>
                <IonInput type="date" value={periodoFin} onIonInput={(e) => setPeriodoFin(e.detail.value ?? '')} />
              </IonItem>
            </Card>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
              <IonSpinner name="crescent" />
            </div>
          )}

          {!loading && error && (
            <IonText color="danger">
              <p style={{ fontSize: 'var(--font-size-sm)' }}>Error al calcular el corte: {error}</p>
            </IonText>
          )}

          {!loading && !error && snapshot && (
            <>
              {/* ── Alertas de descuadre (T10) ── */}
              {snapshot.alertas.length > 0 && (
                <div
                  style={{
                    background: '#FEF3E2',
                    border: '1.5px solid #F6C97C',
                    borderRadius: '16px',
                    padding: '13px 15px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--color-pending-text)', marginBottom: '6px' }}>
                    ⚠ Revisar antes de cerrar
                  </div>
                  {snapshot.alertas.map((a, i) => (
                    <div key={i} style={{ fontSize: '13px', fontWeight: 600, color: '#7A3E06', lineHeight: 1.4 }}>
                      · {a}
                    </div>
                  ))}
                </div>
              )}

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

              {/* ── Entrega ── */}
              <div>
                <span style={sectionLabel}>Entrega del vendedor</span>
                <Card padding="4px 14px">
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Efectivo entregado</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={entregaEf} onIonInput={(e) => setEntregaEf(e.detail.value ?? '')} />
                  </IonItem>
                  {Math.abs(efGap) >= 0.01 && (
                    <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-error-text)', padding: '0 0 8px' }}>
                      Difiere {money(Math.abs(efGap))} del esperado
                    </div>
                  )}
                  <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Transferencias entregadas</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={entregaTr} onIonInput={(e) => setEntregaTr(e.detail.value ?? '')} />
                  </IonItem>
                  {Math.abs(trGap) >= 0.01 && (
                    <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-error-text)', padding: '0 0 8px' }}>
                      Difiere {money(Math.abs(trGap))} del esperado
                    </div>
                  )}
                </Card>
              </div>

              {/* ── Resumen de ventas ── */}
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

              {/* ── Salidas del negocio (backoffice) ── */}
              <div>
                <span style={sectionLabel}>Salidas del negocio · backoffice</span>
                <Card padding="14px">
                  <div style={rowBetween}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Gastos de backoffice</span>
                    <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(snapshot.gastosBackoffice)}</span>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginTop: '4px' }}>
                    No afecta las bolsas del vendedor.
                  </div>
                </Card>
              </div>

              {/* ── Inventario de bodega (H-10) ── */}
              {(snapshot.bodega.granel.length > 0 || snapshot.bodega.presentaciones.length > 0) && (
                <div>
                  <span style={sectionLabel}>Inventario de bodega · al momento del corte</span>
                  <Card padding="14px">
                    {snapshot.bodega.granel.length > 0 && (
                      <div style={{ marginBottom: snapshot.bodega.presentaciones.length > 0 ? '10px' : 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Granel estimado
                        </div>
                        {snapshot.bodega.granel.map((g, idx) => (
                          <div
                            key={g.producto_base_id}
                            style={{
                              ...rowBetween,
                              paddingTop: idx ? '7px' : 0,
                              marginTop: idx ? '7px' : 0,
                            }}
                          >
                            <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>{g.nombre}</span>
                            <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{g.litros} L</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {snapshot.bodega.presentaciones.length > 0 && (
                      <div style={{ paddingTop: snapshot.bodega.granel.length > 0 ? '10px' : 0, borderTop: snapshot.bodega.granel.length > 0 ? '1px solid var(--color-divider)' : 'none' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Presentaciones envasadas y piezas
                        </div>
                        {snapshot.bodega.presentaciones.map((p, idx) => (
                          <div
                            key={p.presentacion_id}
                            style={{
                              ...rowBetween,
                              paddingTop: idx ? '7px' : 0,
                              marginTop: idx ? '7px' : 0,
                            }}
                          >
                            <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>{p.nombre}</span>
                            <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: p.cantidad < 0 ? 'var(--color-error)' : 'var(--color-navy)' }}>
                              {p.cantidad}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── Identidad de control (ADR-0009) ── */}
              {snapshot.identidadControl.length > 0 && (
                <div>
                  <span style={sectionLabel}>Identidad de control · recibido − devuelto = bidones abiertos</span>
                  <Card padding="14px">
                    {snapshot.identidadControl.map((ic, idx) => (
                      <div
                        key={ic.producto_base_id}
                        style={{
                          paddingTop: idx ? '10px' : 0,
                          marginTop: idx ? '10px' : 0,
                          borderTop: idx ? '1px solid var(--color-divider)' : 'none',
                        }}
                      >
                        <div style={rowBetween}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>{ic.nombre}</span>
                          <Chip tone={ic.cuadra ? 'menudeo' : 'error'}>{ic.cuadra ? 'cuadra' : 'no cuadra'}</Chip>
                        </div>
                        <div className="numeric" style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginTop: '2px' }}>
                          recibido {ic.recibido} · devuelto {ic.devuelto} · bidones abiertos {ic.bidonesAbiertos}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {/* ── Reconciliación La Moderna ── */}
              <div>
                <span style={sectionLabel}>Reconciliación La Moderna · del periodo</span>
                <Card padding="14px">
                  {snapshot.moderna.porProducto.length === 0 && (
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#8A94A6' }}>Sin suministros en el periodo.</div>
                  )}
                  {snapshot.moderna.porProducto.map((p, idx) => (
                    <div
                      key={p.producto_base_id}
                      style={{
                        paddingTop: idx ? '10px' : 0,
                        marginTop: idx ? '10px' : 0,
                        borderTop: idx ? '1px solid var(--color-divider)' : 'none',
                      }}
                    >
                      <div style={rowBetween}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>{p.nombre}</span>
                        <span className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(p.adeudo)}</span>
                      </div>
                      <div className="numeric" style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginTop: '2px' }}>
                        recibido {p.recibido} · devuelto {p.devuelto} · neto {p.neto}
                      </div>
                    </div>
                  ))}
                  {snapshot.moderna.porProducto.length > 0 && (
                    <div style={{ ...rowBetween, marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-divider)' }}>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-navy)' }}>Adeudo a La Moderna</span>
                      <span className="numeric" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(snapshot.moderna.total)}</span>
                    </div>
                  )}
                </Card>
              </div>

              <div style={{ height: 'var(--space-sm)' }} />
              <PrimaryCTA onClick={() => setConfirmOpen(true)}>Registrar corte</PrimaryCTA>
            </>
          )}
        </div>
      </IonContent>

      <IonAlert
        isOpen={confirmOpen}
        onDidDismiss={() => setConfirmOpen(false)}
        header="¿Registrar el corte?"
        message="El corte se registra como cierre y delimita el periodo. Los indicadores de flujo del vendedor arrancan de nuevo desde aquí."
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Registrar', role: 'confirm', handler: () => { doRegistrar(); } },
        ]}
      />

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3000} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
