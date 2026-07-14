/**
 * Logiclean Ruta — SaldoNegocioPage (Inc 7.5)
 *
 * Tres piezas de información, todas de solo lectura, más un único punto de
 * acción (el FAB):
 *
 *  - Honorario retenido de tu corte (`useHonorarioRetenido`): cuánto quedó
 *    retenido en el último corte por cartera sin cobrar (`cxc_nueva`) y
 *    cuánto de eso ya se cobró en vivo — solo una sugerencia de monto, no
 *    un tope.
 *  - Cartera pendiente de tu reparto (`useCobrosPendientes`, sin acotar por
 *    periodo — no confundir con `useVendedorResumen.saldoCartera`, que sí
 *    se acota al último corte y por eso puede ocultar ventas previas).
 *  - Saldo con el negocio (`useSaldoVendedor`): liquidación de efectivo
 *    entregado vs. lo que le tocaba entregar en el corte.
 *
 * El vendedor decide cuándo y cuánto retira de la caja hacia su bolsa
 * personal (o cuánto devuelve): el FAB abre un formulario libre de registro
 * de abono — la app sugiere montos, no los impone.
 *
 * Ruta: /saldo-negocio
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonContent,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  IonButton,
} from '@ionic/react';
import { cashOutline, closeOutline } from 'ionicons/icons';
import { useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useAuthContext } from '../../context/AuthContext';
import { useSaldoVendedor } from '../../hooks/useSaldoVendedor';
import { useHonorarioRetenido } from '../../hooks/useHonorarioRetenido';
import { useCobrosPendientes } from '../../hooks/useCobros';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { money } from '../../lib/money';
import { registrarAbonoSaldoVendedor, type DireccionAbono, type FormaPagoAbono } from '../../lib/abonoVendedor';
import { FormaPagoSelector } from '../cobranza/components/FormaPagoSelector';
import { MontoCobroBox } from '../cobranza/components/MontoCobroBox';
import { CobroSkeleton } from '../cobranza/components/CobroSkeleton';

export function SaldoNegocioPage() {
  const { user } = useAuthContext();
  const history = useHistory();
  const vendedorId = user?.id ?? null;

  const { corteId: saldoCorteId, saldo, loading: loadingSaldo, refresh: refreshSaldo } = useSaldoVendedor(vendedorId);
  const { retenido, cobradoDesdeCorte, sugerido, loading: loadingHonorario, refresh: refreshHonorario } = useHonorarioRetenido(vendedorId);
  const { pendientes, loading: loadingCartera, refresh: refreshCartera } = useCobrosPendientes();

  const refrescarTodo = useCallback(
    async () => { await Promise.all([refreshSaldo(), refreshHonorario(), refreshCartera()]); },
    [refreshSaldo, refreshHonorario, refreshCartera]
  );
  const { handleRefresh } = usePullToRefresh(refrescarTodo);

  const [modalOpen, setModalOpen] = useState(false);
  const [direccion, setDireccion] = useState<DireccionAbono>('negocio_a_vendedor');
  const [montoStr, setMontoStr] = useState<number | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPagoAbono>('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loading = loadingSaldo || loadingHonorario || loadingCartera;
  const cartera = pendientes.reduce((s, p) => s + p.saldoTotal, 0);
  const debe = saldo < 0;
  const alCorriente = !loading && saldo === 0 && cartera === 0;

  const abrirModal = () => {
    if (sugerido > 0) {
      setDireccion('negocio_a_vendedor');
      setMontoStr(sugerido);
    } else if (saldo < 0) {
      setDireccion('vendedor_a_negocio');
      setMontoStr(Math.abs(saldo));
    } else {
      setDireccion('negocio_a_vendedor');
      setMontoStr(null);
    }
    setModalOpen(true);
  };

  const monto = montoStr ?? 0;
  const corteId = saldoCorteId;

  const registrar = async () => {
    if (monto <= 0 || !corteId || !vendedorId) return;
    setSubmitting(true);
    try {
      await registrarAbonoSaldoVendedor({
        corteId,
        vendedorId,
        direccion,
        monto,
        forma_pago: formaPago,
        nota: direccion === 'negocio_a_vendedor'
          ? 'Retiro de honorario registrado por el vendedor.'
          : 'Devolución de efectivo registrada por el vendedor.',
      });
      setModalOpen(false);
      setToast(`Abono de ${money(monto)} guardado en el equipo (en cola).`);
      await refrescarTodo();
    } finally {
      setSubmitting(false);
    }
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
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

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
                {retenido > 0 && (
                  <div style={{ background: '#FEF3E2', border: '1.5px solid #F6C97C', borderRadius: '16px', padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#7A3E06' }}>
                        Honorario retenido de tu corte
                      </span>
                      <span className="numeric" style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-.6px', color: '#7A3E06' }}>
                        {money(retenido)}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#7A3E06', lineHeight: 1.4, marginTop: '6px' }}>
                      {cobradoDesdeCorte > 0
                        ? `Ya cobraste ${money(Math.min(cobradoDesdeCorte, retenido))} de esto — usa el botón + para retirarlo cuando quieras.`
                        : 'Se retuvo de tu reparto por cartera aún sin cobrar. Cóbrala para poder retirarlo.'}
                    </div>
                  </div>
                )}

                {cartera > 0 && (
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '16px', padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A94A6' }}>
                        Cartera pendiente de tu reparto
                      </span>
                      <span className="numeric" style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.6px', color: 'var(--color-navy)' }}>
                        {money(cartera)}
                      </span>
                    </div>
                    <IonButton
                      expand="block"
                      fill="clear"
                      size="small"
                      onClick={() => history.push('/cobros')}
                      style={{ '--background': 'var(--color-primary-soft)', '--color': 'var(--color-primary)', '--border-radius': '9px', height: '36px', fontWeight: 800, fontSize: '12.5px', marginTop: '10px' }}
                    >
                      Ir a cobrar →
                    </IonButton>
                  </div>
                )}

                {saldo !== 0 && (
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)', borderRadius: '16px', padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: '#8A94A6' }}>
                        {debe ? 'Debes al negocio' : 'A tu favor'}
                      </span>
                      <span
                        className="numeric"
                        style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-.6px', color: debe ? 'var(--color-error)' : '#7A3E06' }}
                      >
                        {money(Math.abs(saldo))}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ height: '64px' }} />
          </div>
        )}

        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={abrirModal} style={{ '--background': 'var(--color-primary)' }} aria-label="Registrar abono">
            <IonIcon icon={cashOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>

      <IonModal isOpen={modalOpen} onDidDismiss={() => setModalOpen(false)}>
        <IonHeader>
          <IonToolbar>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)', flex: 1, textAlign: 'center' }}>
              Registrar abono
            </div>
            <IonButtons slot="end">
              <IonButton onClick={() => setModalOpen(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div role="radiogroup" aria-label="Dirección del abono" style={{ display: 'flex', gap: '9px' }}>
              {(
                [
                  { valor: 'negocio_a_vendedor' as const, label: 'Tomo dinero de la caja' },
                  { valor: 'vendedor_a_negocio' as const, label: 'Devuelvo dinero a la caja' },
                ]
              ).map((op) => {
                const seleccionado = direccion === op.valor;
                return (
                  <button
                    key={op.valor}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    onClick={() => setDireccion(op.valor)}
                    style={{
                      flex: 1,
                      minHeight: '58px',
                      borderRadius: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '8px',
                      cursor: 'pointer',
                      background: seleccionado ? 'var(--color-primary)' : 'var(--color-surface)',
                      border: seleccionado ? '1.5px solid var(--color-primary)' : '1.5px solid #CFD6E2',
                      color: seleccionado ? '#fff' : '#3A4150',
                      fontSize: '13px',
                      fontWeight: seleccionado ? 800 : 700,
                    }}
                  >
                    {op.label}
                  </button>
                );
              })}
            </div>

            <MontoCobroBox label="Monto" monto={monto} montoSize={25} onChange={setMontoStr} />

            <FormaPagoSelector value={formaPago} onChange={setFormaPago} />
          </div>
        </IonContent>
        <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
          <PrimaryCTA
            disabled={monto <= 0 || !corteId || submitting}
            loading={submitting}
            onClick={registrar}
            trailing={money(monto)}
          >
            {submitting ? 'Guardando…' : 'Registrar abono'}
          </PrimaryCTA>
        </div>
      </IonModal>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3000} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
