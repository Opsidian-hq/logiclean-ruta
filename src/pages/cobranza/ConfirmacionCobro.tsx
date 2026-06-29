/**
 * Logiclean Ruta — ConfirmacionCobro (P2)
 *
 * Confirmación inmediatamente después de guardar el cobro en P1. Muestra:
 *  - Folio local (UUID) con "guardando…"; el folio oficial llega al sincronizar.
 *  - Resumen: cliente, total de la venta, forma de pago, monto cobrado.
 *  - Saldo pendiente (si lo hay) en **ámbar informativo, no rojo** — es info.
 *  - SyncStatusBadge: pendiente → sincronizado al recuperar señal.
 *  - CTA de regreso a la ruta del día.
 *
 * Cinco estados del gate, dirigidos por el estado real de sync (offline,
 * guardando/pendiente, sincronizado, error). El error tranquiliza: el dato está
 * guardado localmente.
 */

import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButtons,
  IonFooter,
} from '@ionic/react';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { useSyncContext } from '../../context/SyncContext';
import { money } from '../../lib/money';
import { folioLocal } from '../../lib/folio';
import type { FormaPago } from '../../lib/cobros';
import { SaldoInfo } from './components/SaldoInfo';
import { ErrorSyncBanner } from './components/ErrorSyncBanner';
import type { PedidoConfirmado } from '../venta/components/ConfirmacionPreventa';
import { StepsBar } from '../../components/ui/StepsBar';

interface ConfirmacionCobroProps {
  ventaId: string;
  clienteNombre: string;
  tipo: 'mayoreo' | 'menudeo';
  total: number;
  /** Subtotal de lista (sin IVA). Si se omite, no se muestra desglose. */
  subtotal?: number;
  /** IVA aplicado (venta facturable, H-06). 0 = sin desglose de IVA. */
  iva?: number;
  /** Monto cobrado; 0 si la venta quedó a crédito. */
  montoCobrado: number;
  /** Forma de pago del cobro; null si fue a crédito (sin cobro). */
  formaPago: FormaPago | null;
  saldo: number;
  /** Título del header. Por defecto "Venta cobrada"; "Entrega cobrada" para entregas. */
  titulo?: string;
  /** Etiqueta de la fila de total. Por defecto "Total de la venta". */
  totalLabel?: string;
  /** Faltantes reprogramados de una entrega (caja azul informativa). */
  reprogramacion?: { productos: string[]; fecha: string };
  /** Pedidos pendientes levantados en la misma venta (preventa), si los hay. */
  pedidos?: PedidoConfirmado[];
  onVolverRuta: () => void;
  onVerFicha?: () => void;
  stepsBar?: { pasos: string[]; activo: number };
}

const filaResumen = (label: string, value: React.ReactNode, last = false) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '11px 0',
      borderBottom: last ? 'none' : '1px solid var(--color-divider)',
    }}
  >
    <span style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>{label}</span>
    {value}
  </div>
);

export function ConfirmacionCobro({
  ventaId,
  clienteNombre,
  tipo,
  total,
  subtotal,
  iva = 0,
  montoCobrado,
  formaPago,
  saldo,
  titulo = 'Venta cobrada',
  totalLabel,
  reprogramacion,
  pedidos = [],
  onVolverRuta,
  onVerFicha,
  stepsBar,
}: ConfirmacionCobroProps) {
  const { isOnline, syncStatus, pendingCount, syncNow } = useSyncContext();

  const sincronizado = isOnline && syncStatus !== 'error' && pendingCount === 0;
  const conError = syncStatus === 'error';
  // El CTA solo muestra spinner mientras hay sync activo; offline/pendiente
  // deja "Volver a la ruta" accionable (el cobro ya está guardado en el equipo).
  const ctaCargando = syncStatus === 'syncing';

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', paddingLeft: 'var(--space-md)' }}>
            {titulo}
          </span>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip
          text={
            isOnline
              ? 'En línea · sincronizado hace un momento'
              : 'Sin conexión · subirá sola al volver la señal'
          }
        />
      </IonHeader>

      {stepsBar && <StepsBar pasos={stepsBar.pasos} activo={stepsBar.activo} />}

      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Banner de estado de guardado */}
          {conError ? (
            <ErrorSyncBanner monto={montoCobrado > 0 ? montoCobrado : total} onReintentar={syncNow} />
          ) : sincronizado ? (
            <div style={{ background: '#ECFCE0', border: '1.5px solid #B7EE92', borderRadius: '16px', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: '13px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--color-navy)', fontSize: '20px', fontWeight: 800 }}>
                ✓
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#1C4310' }}>Cobro sincronizado</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#3E6B22', marginTop: '2px' }}>Guardado ✓ · Sincronizado ✓</div>
              </div>
            </div>
          ) : (
            <div style={{ background: '#FEF3E2', border: '1.5px solid #F6C97C', borderRadius: '16px', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: '13px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <div style={{ width: '17px', height: '17px', borderRadius: '50%', border: '3px solid rgba(35,26,5,.30)', borderTopColor: '#231A05', animation: 'lc-spin .8s linear infinite' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#7A3E06' }}>
                  {montoCobrado > 0 ? 'Guardando cobro…' : 'Venta a crédito guardada'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-pending-text)', marginTop: '2px' }}>
                  <span style={{ color: '#3E6B22' }}>Guardado en el equipo ✓</span> · en cola
                </div>
              </div>
            </div>
          )}

          {/* Folio local */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', border: '1px dashed #CBD3E0', borderRadius: '12px', padding: '11px 14px' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A94A6' }}>Folio local</div>
              <div className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '1px' }}>{folioLocal(ventaId)}</div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-pending-text)' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-amber)', display: 'inline-block' }} />
              folio oficial al sincronizar
            </span>
          </div>

          {/* Cliente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <ClienteAvatar nombre={clienteNombre} size={38} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{clienteNombre}</div>
              <div style={{ marginTop: '2px' }}>
                <Chip tone={tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>{tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</Chip>
              </div>
            </div>
          </div>

          {/* Resumen de la operación */}
          <Card padding="6px 14px">
            {iva > 0 && subtotal != null &&
              filaResumen('Subtotal (lista)', <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>{money(subtotal)}</span>)}
            {iva > 0 &&
              filaResumen('IVA (16%)', <span className="numeric" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--color-body)' }}>{money(iva)}</span>)}
            {filaResumen(iva > 0 ? 'Total con factura' : (totalLabel ?? 'Total de la venta'), <span className="numeric" style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(total)}</span>)}
            {filaResumen(
              'Forma de pago',
              formaPago ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', fontWeight: 800, color: 'var(--color-navy)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                  {formaPago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                </span>
              ) : (
                <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--color-pending-text)' }}>A crédito</span>
              )
            )}
            {filaResumen('Monto cobrado', <span className="numeric" style={{ fontSize: '15.5px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(montoCobrado)}</span>, true)}
          </Card>

          {/* Saldo: liquidada (verde) o pendiente (ámbar informativo) */}
          {saldo > 0 ? (
            <SaldoInfo
              label="Saldo pendiente"
              monto={saldo}
              dot
              montoSize={22}
              nota="Es información, no error. Se cobra en una próxima visita."
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ECFCE0', border: '1.5px solid #B7EE92', borderRadius: '14px', padding: '13px 15px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15.5px', fontWeight: 800, color: '#1C4310' }}>
                <span style={{ color: '#3E6B22' }}>✓</span>Venta liquidada
              </span>
              <span className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: '#3E6B22' }}>Saldo {money(0)}</span>
            </div>
          )}

          {/* Entrega reprogramada: faltantes que se entregarán en otra fecha */}
          {reprogramacion && reprogramacion.productos.length > 0 && (
            <div style={{ background: 'var(--color-primary-bg)', border: '1px solid var(--color-primary-line)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>↻</span>Entrega reprogramada
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#3B82F6', marginTop: '4px' }}>
                {reprogramacion.productos.join(', ')} · {reprogramacion.fecha}
              </div>
            </div>
          )}

          {/* Pedidos pendientes (preventa) levantados en la misma venta */}
          {pedidos.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6', margin: '4px 0 8px' }}>
                Pedidos programados (preventa) · {pedidos.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pedidos.map((p, idx) => (
                  <div key={idx} style={{ border: '1.5px solid var(--color-primary-line)', background: 'var(--color-primary-bg)', borderRadius: '14px', padding: '12px 13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="numeric" style={{ minWidth: '28px', fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {p.cantidad}×
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>{p.nombre}</div>
                    {p.fecha_compromiso && (
                      <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        entrega {p.fecha_compromiso}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)', display: 'flex', gap: '11px' }}>
            {onVerFicha && saldo > 0 && (
              <button
                type="button"
                onClick={onVerFicha}
                style={{ flex: 'none', width: '130px', minHeight: 'var(--cta-height)', border: '1.5px solid #CFD6E2', borderRadius: '16px', background: 'var(--color-surface)', color: 'var(--color-navy)', fontSize: '16px', fontWeight: 800, cursor: 'pointer' }}
              >
                Ver ficha
              </button>
            )}
            <div style={{ flex: 1 }}>
              <PrimaryCTA loading={ctaCargando} disabled={ctaCargando} onClick={onVolverRuta}>
                {ctaCargando ? 'Guardando…' : 'Volver a la ruta'}
              </PrimaryCTA>
            </div>
          </div>
        </IonToolbar>
      </IonFooter>
    </>
  );
}
