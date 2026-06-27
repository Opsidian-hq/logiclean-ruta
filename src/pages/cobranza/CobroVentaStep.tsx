/**
 * Logiclean Ruta — CobroVentaStep (P1 · "¿Cómo cobramos?")
 *
 * Paso de cobro que continúa al carrito de venta (Flujo A): aparece después de
 * confirmar los productos y antes de guardar. Muestra el total en grande y las
 * tres formas de cobrar (total / parcial / a crédito) más la forma de pago
 * (efectivo / transferencia). Al elegir transferencia se muestra la cuenta.
 *
 * Cinco estados del gate:
 *  - Happy path: cobro total en efectivo; CTA activo.
 *  - Vacío / sin selección: CTA deshabilitado hasta elegir una opción de cobro.
 *  - Cargando: skeleton breve mientras carga el saldo del cliente.
 *  - Error de sync: banner tranquilizador + "Reintentar ahora" (el dinero no se
 *    pierde, está guardado en el equipo).
 *  - Offline: ConnectivityStrip activo; el cobro se guarda igual, no bloquea.
 */

import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
} from '@ionic/react';
import { useState } from 'react';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Chip } from '../../components/ui/Chip';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useSyncContext } from '../../context/SyncContext';
import { money } from '../../lib/money';
import { redondear } from '../../lib/cobros';
import type { FormaPago } from '../../lib/cobros';
import { OpcionesCobro, type ModoCobro } from './components/OpcionesCobro';
import { FormaPagoSelector } from './components/FormaPagoSelector';
import { CuentaTransferencia } from './components/CuentaTransferencia';
import { MontoCobroBox } from './components/MontoCobroBox';
import { SaldoInfo } from './components/SaldoInfo';
import { CobroSkeleton } from './components/CobroSkeleton';
import { ErrorSyncBanner } from './components/ErrorSyncBanner';

export interface DecisionCobro {
  modo: ModoCobro;
  /** Monto a cobrar; 0 cuando es a crédito. */
  monto: number;
  forma_pago: FormaPago;
}

interface CobroVentaStepProps {
  clienteNombre: string;
  tipo: 'mayoreo' | 'menudeo';
  /** Resumen de productos (p. ej. "2 productos"); vacío para cobro de saldo. */
  productosResumen: string;
  total: number;
  /** IVA incluido en el total cuando la venta requiere factura (H-06). 0 si no. */
  iva?: number;
  /** Etiqueta sobre el total. Por defecto "Total de la venta". */
  tituloTotal?: string;
  /** Etiqueta del botón atrás. Por defecto "Carrito". */
  backLabel?: string;
  /** Modos de cobro a ofrecer; por defecto los tres (total/parcial/crédito). */
  modos?: ModoCobro[];
  /** Skeleton mientras carga el saldo del cliente (cálculo local breve). */
  loading?: boolean;
  submitting?: boolean;
  onConfirm: (decision: DecisionCobro) => void;
  onBack: () => void;
}

const sectionLabel = {
  fontSize: '12px',
  fontWeight: 800 as const,
  letterSpacing: '.6px',
  textTransform: 'uppercase' as const,
  color: '#8A94A6',
  marginBottom: '9px',
};

export function CobroVentaStep({
  clienteNombre,
  tipo,
  productosResumen,
  total,
  iva = 0,
  tituloTotal = 'Total de la venta',
  backLabel = 'Carrito',
  modos,
  loading = false,
  submitting = false,
  onConfirm,
  onBack,
}: CobroVentaStepProps) {
  const { syncStatus, syncNow } = useSyncContext();
  const [modo, setModo] = useState<ModoCobro | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPago>('efectivo');
  const [montoParcial, setMontoParcial] = useState<number>(redondear(total / 2));

  const esCredito = modo === 'credito';
  const monto = modo === 'total' ? total : modo === 'parcial' ? montoParcial : 0;
  const saldo = redondear(Math.max(0, total - monto));
  const puedeConfirmar = modo !== null && !submitting && (esCredito || monto > 0);

  const ctaLabel = esCredito
    ? submitting
      ? 'Guardando…'
      : 'Guardar venta a crédito'
    : submitting
      ? 'Guardando…'
      : 'Registrar cobro';

  const handleConfirm = () => {
    if (!modo) return;
    onConfirm({ modo, monto, forma_pago: formaPago });
  };

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonButton onClick={onBack} style={{ color: 'var(--color-cyan)', fontSize: '15px', fontWeight: 700 }}>
              ‹ {backLabel}
            </IonButton>
          </IonButtons>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip text="Venta y cobro se guardan en el equipo al instante" />
      </IonHeader>

      <IonContent>
        {loading ? (
          <CobroSkeleton />
        ) : (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Error de sync: el dinero no se pierde */}
            {syncStatus === 'error' && (
              <ErrorSyncBanner monto={monto > 0 ? monto : total} onReintentar={syncNow} />
            )}

            {/* Total grande */}
            <div style={{ textAlign: 'center', padding: '2px 0' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: '#8A94A6' }}>
                {tituloTotal}
              </div>
              <div className="numeric" style={{ fontSize: '46px', fontWeight: 800, color: 'var(--color-navy)', letterSpacing: '-1.4px', lineHeight: 1, marginTop: '6px' }}>
                {money(total)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', marginTop: '8px' }}>
                <Chip tone={tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>{tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</Chip>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  {clienteNombre}{productosResumen ? ` · ${productosResumen}` : ''}
                </span>
              </div>
              {iva > 0 && (
                <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                  Incluye IVA (16%) · {money(iva)}
                </div>
              )}
            </div>

            {/* 3 opciones de cobro */}
            <div>
              <div style={sectionLabel}>¿Cómo se cobra?</div>
              <OpcionesCobro value={modo} onChange={setModo} modos={modos} />
            </div>

            {/* Forma de pago (no aplica a crédito) */}
            {!esCredito && modo !== null && (
              <div>
                <div style={sectionLabel}>Forma de pago</div>
                <FormaPagoSelector value={formaPago} onChange={setFormaPago} height={52} />
              </div>
            )}

            {/* Cuenta para transferencia (solo lectura) */}
            {!esCredito && modo !== null && formaPago === 'transferencia' && <CuentaTransferencia />}

            {/* Monto: precargado (total) o editable (parcial) */}
            {modo === 'total' && (
              <MontoCobroBox label="Monto a cobrar" hint="Precargado con el total" monto={total} />
            )}
            {modo === 'parcial' && (
              <>
                <MontoCobroBox label="Monto a cobrar" monto={montoParcial} montoSize={28} onChange={setMontoParcial} />
                <SaldoInfo
                  label="Saldo después del cobro"
                  monto={saldo}
                  nota="Queda a cargo del cliente · se cobra en otra visita"
                />
              </>
            )}

            {/* Estado a crédito */}
            {esCredito && (
              <>
                <div
                  style={{
                    border: '1.5px dashed var(--color-primary-line)',
                    background: 'var(--color-primary-bg)',
                    borderRadius: '16px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: '46px', height: '46px', borderRadius: '13px', background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontSize: '22px', fontWeight: 800 }}>
                    ≈
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '2px' }}>
                    No se captura pago hoy
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#5B6678', lineHeight: 1.4 }}>
                    Sin monto ni forma de pago. La venta queda registrada como saldo del cliente.
                  </div>
                </div>
                <SaldoInfo label="Saldo tras esta venta ↑" monto={total} nota="Es información, no error. Se cobra en una próxima visita." />
              </>
            )}

            {/* Vacío / sin selección */}
            {modo === null && (
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '4px 8px' }}>
                Elige cómo se cobra para continuar.
              </div>
            )}

            <div style={{ height: '8px' }} />
          </div>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            <PrimaryCTA
              disabled={!puedeConfirmar}
              loading={submitting}
              onClick={handleConfirm}
              trailing={esCredito ? undefined : money(monto)}
            >
              {ctaLabel}
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>
    </>
  );
}
