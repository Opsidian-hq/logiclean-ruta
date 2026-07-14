/**
 * Logiclean Ruta — SaldoNegocioPage (Inc 7.5)
 *
 * Dos saldos distintos del vendedor en sesión:
 *
 *  - Cartera pendiente de su reparto: crédito vivo de SUS clientes aún sin
 *    cobrar, sin acotar por periodo (misma fuente que `/cobros` —
 *    `useCobrosPendientes`/`lib/cobros.ts`, derivado de venta − cobros). El
 *    honorario del vendedor se calcula neto de esta cartera (`cxc_nueva` del
 *    corte) — cobrarla completa su pago. OJO: `useVendedorResumen`
 *    (`saldoCartera`) NO sirve aquí — está acotado a "ventas desde el último
 *    corte confirmado", así que una venta ya facturada ANTES de ese corte
 *    (pero aún sin cobrar) desaparece de ese cálculo aunque siga pendiente.
 *  - Saldo con el negocio (`saldo_vendedor_cierre`, neto de abonos — ver
 *    `useSaldoVendedor`): liquidación de efectivo entregado vs. lo que le
 *    tocaba entregar en el corte. El vendedor registra el abono aquí mismo
 *    cuando lo salda.
 *
 * Ruta: /saldo-negocio
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
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useAuthContext } from '../../context/AuthContext';
import { useSaldoVendedor } from '../../hooks/useSaldoVendedor';
import { useCobrosPendientes } from '../../hooks/useCobros';
import { money } from '../../lib/money';
import type { FormaPagoAbono } from '../../lib/abonoVendedor';
import { FormaPagoSelector } from '../cobranza/components/FormaPagoSelector';
import { MontoCobroBox } from '../cobranza/components/MontoCobroBox';
import { CobroSkeleton } from '../cobranza/components/CobroSkeleton';

export function SaldoNegocioPage() {
  const { user } = useAuthContext();
  const history = useHistory();
  const { saldo, loading: loadingSaldo, submitting, registrarAbono } = useSaldoVendedor(user?.id ?? null);
  const { pendientes, loading: loadingCartera } = useCobrosPendientes();

  const [montoStr, setMontoStr] = useState<number | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPagoAbono>('efectivo');
  const [toast, setToast] = useState<string | null>(null);

  const loading = loadingSaldo || loadingCartera;
  const cartera = pendientes.reduce((s, p) => s + p.saldoTotal, 0);
  const debe = saldo < 0;
  const pendiente = Math.abs(saldo);
  const monto = montoStr ?? pendiente;
  const hayPendientes = saldo !== 0 || cartera > 0;
  const alCorriente = !loading && !hayPendientes;

  const registrar = async () => {
    if (monto <= 0) return;
    await registrarAbono(monto, formaPago);
    setMontoStr(null);
    setToast(`Abono de ${money(monto)} guardado en el equipo (en cola).`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start" />
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-on-dark)', flex: 1, textAlign: 'center' }}>
            Mi saldo
          </div>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading && <CobroSkeleton />}

        {!loading && (
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {alCorriente ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '8px', padding: '36px 14px 20px' }}>
                <div style={{ width: '78px', height: '78px', borderRadius: '24px', background: '#ECFCE0', border: '1.5px solid #B7EE92', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#3E6B22', fontSize: '38px', fontWeight: 800 }}>✓</span>
                </div>
                <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '8px' }}>Estás al corriente</div>
                <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                  No tienes saldo pendiente, ni con el negocio ni por cobrar de clientes.
                </div>
              </div>
            ) : (
              <>
                {cartera > 0 && (
                  <div style={{ background: '#FEF3E2', border: '1.5px solid #F6C97C', borderRadius: '16px', padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7A3E06' }}>
                        Cartera pendiente de tu reparto
                      </span>
                      <span className="numeric" style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-.6px', color: '#7A3E06' }}>
                        {money(cartera)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#7A3E06', lineHeight: 1.4, marginTop: '6px' }}>
                      Crédito de tus clientes aún sin cobrar. Tu honorario del corte se calcula neto de esta cartera —
                      cóbrala para completar tu pago.
                    </div>
                    <IonButton
                      expand="block"
                      fill="clear"
                      size="small"
                      onClick={() => history.push('/cobros')}
                      style={{ '--background': '#fff', '--color': '#7A3E06', '--border-radius': '9px', height: '38px', fontWeight: 800, fontSize: '12.5px', marginTop: '10px' }}
                    >
                      Ir a cobrar →
                    </IonButton>
                  </div>
                )}

                {saldo !== 0 && (
                  <>
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '16px', padding: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A94A6' }}>
                          {debe ? 'Debes al negocio' : 'A tu favor'}
                        </span>
                        <span
                          className="numeric"
                          style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-.6px', color: debe ? 'var(--color-error)' : '#7A3E06' }}
                        >
                          {money(pendiente)}
                        </span>
                      </div>
                    </div>

                    <MontoCobroBox label={debe ? 'Monto a abonar' : 'Monto a recibir'} monto={monto} montoSize={25} onChange={setMontoStr} />

                    <FormaPagoSelector value={formaPago} onChange={setFormaPago} />
                  </>
                )}
              </>
            )}

            <div style={{ height: '8px' }} />
          </div>
        )}
      </IonContent>

      {!loading && saldo !== 0 && (
        <IonFooter>
          <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
            <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
              <PrimaryCTA
                disabled={monto <= 0 || submitting}
                loading={submitting}
                onClick={registrar}
                trailing={money(monto)}
              >
                {submitting ? 'Guardando…' : 'Registrar abono'}
              </PrimaryCTA>
            </div>
          </IonToolbar>
        </IonFooter>
      )}

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3000} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
