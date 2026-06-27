/**
 * Logiclean Ruta — CobrarSaldoPage (P3 · P4)
 *
 * Cobro de saldo previo desde la ficha del cliente, sin venta activa. El saldo
 * se deriva (ventas − cobros), desglosado por venta. Permite registrar un cobro
 * (monto + forma de pago) que se asigna FIFO a las ventas con saldo. El
 * historial de cobros previos es colapsable; cada cobro conserva su propia
 * forma de pago (P4).
 *
 * Cinco estados del gate:
 *  - Happy path: saldo desglosado + campo de cobro + historial.
 *  - Vacío: "Sin saldo pendiente" (mensaje explícito, nunca lista en blanco).
 *  - Cargando: skeleton mientras se deriva el saldo local.
 *  - Error de sync: banner tranquilizador + "Reintentar ahora".
 *  - Offline: ConnectivityStrip activo; el cobro se guarda igual.
 *
 * Ruta: /cobranza/:clienteId
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonToast,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useClientes } from '../../hooks/useClientes';
import { useCobros, useSaldoCliente } from '../../hooks/useCobros';
import { useSyncContext } from '../../context/SyncContext';
import { money } from '../../lib/money';
import { folioLocal } from '../../lib/folio';
import type { FormaPago } from '../../lib/cobros';
import { FormaPagoSelector } from './components/FormaPagoSelector';
import { MontoCobroBox } from './components/MontoCobroBox';
import { CobroSkeleton } from './components/CobroSkeleton';
import { ErrorSyncBanner } from './components/ErrorSyncBanner';

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

export function CobrarSaldoPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const history = useHistory();
  const { clientes } = useClientes();
  const { desglose, loading, refresh } = useSaldoCliente(clienteId);
  const { registrarCobroCliente, submitting } = useCobros();
  const { syncStatus, syncNow } = useSyncContext();

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const [montoStr, setMontoStr] = useState<number | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo');
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const saldoTotal = desglose?.saldoTotal ?? 0;
  // Monto por defecto: el saldo total (cobrar todo). El vendedor puede editarlo.
  const monto = montoStr ?? saldoTotal;
  const vacio = !loading && saldoTotal <= 0;

  const ultimoCobro = useMemo(() => desglose?.historial[0] ?? null, [desglose]);

  const registrar = async () => {
    if (monto <= 0) return;
    const creados = await registrarCobroCliente({ clienteId, monto, forma_pago: formaPago });
    const totalCobrado = creados.reduce((acc, c) => acc + c.monto, 0);
    await refresh();
    setMontoStr(null);
    setToast(`Cobro de ${money(totalCobrado)} guardado en el equipo (en cola).`);
  };

  const nombre = cliente?.nombre ?? 'Cliente';
  const tipo = cliente?.tipo ?? 'menudeo';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonButton onClick={() => history.goBack()} style={{ color: 'var(--color-cyan)', fontSize: '15px', fontWeight: 700 }}>
              ‹ Cobrar saldo
            </IonButton>
          </IonButtons>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading && <CobroSkeleton />}

        {!loading && (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {/* Error de sync */}
            {syncStatus === 'error' && <ErrorSyncBanner monto={monto > 0 ? monto : saldoTotal} onReintentar={syncNow} />}

            {/* Identidad del cliente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <ClienteAvatar nombre={nombre} size={38} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{nombre}</div>
                <div style={{ marginTop: '2px' }}>
                  <Chip tone={tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>{tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</Chip>
                </div>
              </div>
            </div>

            {/* ── Estado VACÍO: sin saldo pendiente ── */}
            {vacio ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', padding: '36px 14px 20px' }}>
                <div style={{ width: '78px', height: '78px', borderRadius: '24px', background: '#ECFCE0', border: '1.5px solid #B7EE92', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#3E6B22', fontSize: '38px', fontWeight: 800 }}>✓</span>
                </div>
                <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '8px' }}>Sin saldo pendiente</div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  Este cliente está al corriente. No tiene ventas por cobrar de visitas anteriores.
                </div>
                {ultimoCobro && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '10px', padding: '8px 13px' }}>
                    <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: '#8A94A6' }}>Último cobro</span>
                    <span className="numeric" style={{ fontSize: '13px', fontWeight: 800, color: '#3E6B22' }}>
                      {money(ultimoCobro.monto)} · {fechaCorta(ultimoCobro.fecha)} ✓
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* ── Saldo actual + desglose por venta ── */}
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '16px', padding: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A94A6' }}>Saldo actual</span>
                    <span className="numeric" style={{ fontSize: '30px', fontWeight: 800, color: '#7A3E06', letterSpacing: '-.6px' }}>{money(saldoTotal)}</span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--color-divider)', margin: '12px 0' }} />
                  {desglose?.ventasConSaldo.map(({ venta, saldo }) => (
                    <div key={venta.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
                      <div>
                        <span className="numeric" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-body)' }}>Venta {folioLocal(venta.id)}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6', marginLeft: '7px' }}>{fechaCorta(venta.fecha)}</span>
                      </div>
                      <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: '#7A3E06' }}>{money(saldo)}</span>
                    </div>
                  ))}
                </div>

                {/* ── Monto a cobrar (editable) ── */}
                <MontoCobroBox label="Monto a cobrar" monto={monto} montoSize={25} onChange={setMontoStr} />

                {/* ── Forma de pago ── */}
                <FormaPagoSelector value={formaPago} onChange={setFormaPago} />

                {/* ── Historial colapsable (P4: cada cobro con su forma) ── */}
                {desglose && desglose.historial.length > 0 && (
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '14px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setHistorialAbierto((v) => !v)}
                      aria-expanded={historialAbierto}
                      style={{ width: '100%', minHeight: '46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>
                        <span style={{ color: 'var(--color-primary)' }}>↻</span>
                        Cobros anteriores · {desglose.historial.length}
                      </span>
                      <span style={{ color: '#8A94A6', fontSize: '18px', fontWeight: 700 }}>{historialAbierto ? '⌃' : '⌄'}</span>
                    </button>
                    {historialAbierto && (
                      <div style={{ padding: '0 15px 6px' }}>
                        {desglose.historial.map((c) => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 0', borderTop: '1px solid var(--color-divider)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: c.forma_pago === 'efectivo' ? '50%' : '2px', background: 'var(--color-primary)', display: 'inline-block' }} />
                              <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>{c.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                              <span className="numeric" style={{ fontSize: '12px', fontWeight: 600, color: '#8A94A6' }}>· {fechaCorta(c.fecha)}</span>
                            </span>
                            <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(c.monto)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div style={{ height: '8px' }} />
          </div>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            {vacio ? (
              <PrimaryCTA onClick={() => history.push(`/venta?cliente=${clienteId}`)}>
                + Registrar una venta
              </PrimaryCTA>
            ) : (
              <PrimaryCTA
                disabled={loading || monto <= 0 || submitting}
                loading={submitting}
                onClick={registrar}
                trailing={money(monto)}
              >
                {submitting ? 'Guardando…' : 'Registrar cobro'}
              </PrimaryCTA>
            )}
          </div>
        </IonToolbar>
      </IonFooter>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3000} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
