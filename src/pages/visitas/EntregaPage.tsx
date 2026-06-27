/**
 * Logiclean Ruta — EntregaPage (Confirmar entrega · Productos + Resumen)
 *
 * Cierra una entrega pendiente en dos pasos encadenados (rediseño de Visitas):
 *  1. Productos: el vendedor marca por producto qué se entregó (todos marcados
 *     por defecto). Lo desmarcado queda como faltante.
 *  2. Resumen: muestra el total de lo entregado y, si hubo faltantes, permite
 *     reprogramarlos (nueva fecha) o cancelarlos (sin perderlos de vista).
 *
 * Al "Cobrar" persiste la entrega (`confirmarEntrega`: una venta con N líneas +
 * reprogramaciones/cancelaciones) y avanza al cobro con origen `entrega`.
 *
 * Ruta: /entrega/:clienteId
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  IonSpinner,
  IonIcon,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { arrowBackOutline, checkmarkOutline, closeOutline, cubeOutline, alertCircleOutline } from 'ionicons/icons';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { StepsBar } from '../../components/ui/StepsBar';
import { useClientes } from '../../hooks/useClientes';
import { pedidosParaEntrega, confirmarEntrega } from '../../lib/pedidos';
import type { PedidoEntregaVista, ConfirmarEntregaResult } from '../../lib/pedidos';
import { money } from '../../lib/money';

interface Item extends PedidoEntregaVista {
  entregado: boolean;
  cancelado: boolean;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

/** ISO date (local) desplazada `n` días desde hoy. */
function fechaRelativa(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function EntregaPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const history = useHistory();
  const { clientes } = useClientes();
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const [paso, setPaso] = useState<'productos' | 'resumen'>('productos');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [fechaReprog, setFechaReprog] = useState(fechaRelativa(1));
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Se persiste una sola vez aunque el vendedor vuelva atrás desde el cobro.
  const [confirmado, setConfirmado] = useState<ConfirmarEntregaResult | null>(null);

  useEffect(() => {
    let activo = true;
    pedidosParaEntrega(clienteId)
      .then((peds) => {
        if (!activo) return;
        setItems(peds.map((p) => ({ ...p, entregado: true, cancelado: false })));
        setLoading(false);
      })
      .catch((err) => {
        if (!activo) return;
        setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los productos.');
        setLoading(false);
      });
    return () => {
      activo = false;
    };
  }, [clienteId, retryKey]);

  const togglEntregado = (id: string) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, entregado: !it.entregado, cancelado: it.entregado ? it.cancelado : false } : it
      )
    );

  const toggleCancelado = (id: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cancelado: !it.cancelado } : it)));

  const entregados = items.filter((it) => it.entregado && !it.cancelado);
  const faltantes = items.filter((it) => !it.entregado);
  const reprogramados = faltantes.filter((it) => !it.cancelado);
  const totalEntrega = entregados.reduce((acc, it) => acc + it.importe, 0);
  const hayParcial = items.some((it) => !it.entregado);

  // ── Paso 2 → cobro: persiste la entrega y avanza ──
  const irACobro = async () => {
    if (!cliente) return;
    setSaveError(null);
    setSubmitting(true);
    try {
      const res =
        confirmado ??
        (await confirmarEntrega({
          decisiones: items.map((it) => ({
            pedidoId: it.id,
            accion: it.entregado ? 'entregar' : it.cancelado ? 'cancelar' : 'reprogramar',
          })),
          fechaReprogramacion: reprogramados.length > 0 ? fechaReprog : undefined,
        }));
      setConfirmado(res);

      const reprogramacion =
        res.reprogramados.length > 0
          ? { productos: reprogramados.map((it) => it.nombre), fecha: fechaCorta(fechaReprog) }
          : undefined;

      if (res.venta) {
        history.push({
          pathname: `/cobro/${clienteId}`,
          state: {
            origen: 'entrega',
            ventaId: res.venta.id,
            total: res.venta.total,
            productosCount: entregados.length,
            reprogramacion,
          },
        });
      } else {
        // Nada se entregó (todo reprogramado/cancelado): no hay cobro.
        history.push({ pathname: '/visitas', state: { toast: 'Entrega registrada en la ruta' } });
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'No se pudo guardar la entrega. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Carga ──
  if (loading || !cliente) {
    return (
      <IonPage>
        <CabeceraEntrega titulo="Confirmar entrega" onBack={() => history.goBack()} />
        <IonContent>
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Error de carga ──
  if (loadError) {
    return (
      <IonPage>
        <CabeceraEntrega titulo="Confirmar entrega" onBack={() => history.push(`/clientes/${clienteId}`)} />
        <IonContent>
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', minHeight: '60%', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: '#FDECEA', border: '1.5px solid #F4B3AC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IonIcon icon={alertCircleOutline} style={{ fontSize: '32px', color: 'var(--color-error)' }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)' }}>No se pudieron cargar los pedidos</div>
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>{loadError}</div>
            <button
              type="button"
              onClick={() => { setLoading(true); setLoadError(null); setRetryKey((k) => k + 1); }}
              style={{ marginTop: '8px', padding: '14px 24px', border: 'none', borderRadius: '12px', background: 'var(--color-primary)', color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}
            >
              Reintentar
            </button>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── Vacío · sin pedidos pendientes ──
  if (items.length === 0) {
    return (
      <IonPage>
        <CabeceraEntrega titulo="Confirmar entrega" onBack={() => history.push(`/clientes/${clienteId}`)} />
        <IonContent>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '8px',
              padding: '56px 24px',
            }}
          >
            <div
              style={{
                width: '78px',
                height: '78px',
                borderRadius: '24px',
                background: '#ECFCE0',
                border: '1.5px solid #B7EE92',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#3E6B22', fontSize: '38px', fontWeight: 800 }}>✓</span>
            </div>
            <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '8px' }}>
              Sin entregas pendientes
            </div>
            <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
              {cliente.nombre} no tiene pedidos por entregar.
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <CabeceraEntrega
        titulo={paso === 'productos' ? 'Confirmar entrega' : 'Resumen'}
        onBack={() => (paso === 'resumen' ? setPaso('productos') : history.push(`/clientes/${clienteId}`))}
      />

      <StepsBar
        pasos={['Productos', 'Resumen', 'Cobro']}
        activo={paso === 'productos' ? 0 : 1}
      />

      <IonContent>
        {paso === 'productos' ? (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Cliente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClienteAvatar nombre={cliente.nombre} size={40} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)' }}>{cliente.nombre}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Pedido pendiente{items[0]?.fecha_compromiso ? ` · ${fechaCorta(items[0].fecha_compromiso)}` : ''}
                </div>
              </div>
            </div>

            {/* Productos a entregar */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-surface)' }}>
              <div style={{ padding: '12px 16px', background: '#FAFBFF', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IonIcon icon={cubeOutline} style={{ fontSize: '15px' }} />
                  Productos a entregar
                </span>
                <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {entregados.length} de {items.length}
                </span>
              </div>
              {items.map((it) => {
                const ok = it.entregado;
                return (
                  <div
                    key={it.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => togglEntregado(it.id)}
                    onKeyDown={(e) => e.key === 'Enter' && togglEntregado(it.id)}
                    style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', opacity: ok ? 1 : 0.4 }}
                  >
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', border: ok ? '2px solid var(--color-primary)' : '2px solid var(--color-error)', background: ok ? 'var(--color-primary)' : '#fff' }}>
                      <IonIcon icon={ok ? checkmarkOutline : closeOutline} style={{ fontSize: '16px', color: ok ? '#fff' : 'var(--color-error)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-body)' }}>{it.nombre}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>{it.cantidad} unidad{it.cantidad !== 1 ? 'es' : ''}</div>
                    </div>
                    <span className="numeric" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>{money(it.importe)}</span>
                  </div>
                );
              })}
            </div>

            {/* Alerta de entrega parcial */}
            {hayParcial && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#FEF9EC', border: '1px solid #FCD34D', borderRadius: '14px', padding: '13px 16px' }}>
                <IonIcon icon={alertCircleOutline} style={{ color: '#B45309', fontSize: '20px', flex: 'none', marginTop: '1px' }} />
                <div style={{ fontSize: '13px', color: '#92400E', lineHeight: 1.5 }}>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>Entrega parcial</strong>
                  En el siguiente paso podrás reprogramar o cancelar los productos faltantes.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Productos entregados */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-surface)' }}>
              <div style={{ padding: '12px 16px', background: '#FAFBFF', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                Productos entregados
              </div>
              {entregados.length === 0 ? (
                <div style={{ padding: '12px 16px', fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>Ningún producto entregado</div>
              ) : (
                entregados.map((it) => (
                  <div key={it.id} style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '0.5px solid var(--color-border)' }}>
                    <span style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)' }}>{it.nombre}</span>
                    <span className="numeric" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-body)' }}>{money(it.importe)}</span>
                  </div>
                ))
              )}
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-body)' }}>Total de la entrega</span>
                <span className="numeric" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(totalEntrega)}</span>
              </div>
            </div>

            {/* Faltantes: reprogramar / cancelar */}
            {faltantes.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: '16px', overflow: 'hidden', background: 'var(--color-surface)' }}>
                <div style={{ padding: '12px 16px', background: '#FAFBFF', borderBottom: '1px solid var(--color-border)', fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IonIcon icon={cubeOutline} style={{ fontSize: '15px' }} /> Productos no entregados
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {faltantes.map((it) =>
                    it.cancelado ? (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#F4F4F5', borderRadius: '12px', border: '1px solid var(--color-border)', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-secondary)', textDecoration: 'line-through' }}>{it.nombre}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--color-error)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={closeOutline} style={{ fontSize: '13px' }} /> Cancelado por el cliente
                          </div>
                        </div>
                        <button type="button" onClick={() => toggleCancelado(it.id)} style={{ padding: '8px 12px', background: '#fff', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          Deshacer
                        </button>
                      </div>
                    ) : (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#FEF9EC', borderRadius: '12px', border: '1px solid #FCD34D', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-body)' }}>{it.nombre}</div>
                          <div style={{ fontSize: '11.5px', color: '#92400E', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Se reprograma · {money(it.importe)}
                          </div>
                        </div>
                        <button type="button" onClick={() => toggleCancelado(it.id)} style={{ padding: '8px 12px', background: '#fff', color: 'var(--color-error)', border: '1.5px solid var(--color-error)', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    )
                  )}
                </div>
                {reprogramados.length > 0 && (
                  <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--color-border)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
                      ¿Cuándo entregará los productos que faltan?
                    </label>
                    <input
                      type="date"
                      value={fechaReprog}
                      onChange={(e) => setFechaReprog(e.target.value)}
                      style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--color-primary)', borderRadius: '10px', fontSize: '14px', color: 'var(--color-navy)', fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                      Los productos no cancelados se entregarán en esta fecha.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {paso === 'resumen' && saveError && (
              <div style={{ background: '#FDECEA', border: '1.5px solid #F4B3AC', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#911A11' }}>No se pudo guardar la entrega</div>
                  <div style={{ fontSize: '12px', color: '#7A1610', marginTop: '2px', lineHeight: 1.4 }}>{saveError}</div>
                </div>
                <button type="button" onClick={() => setSaveError(null)} style={{ padding: '6px 10px', border: 'none', background: 'var(--color-error)', color: '#fff', borderRadius: '8px', fontWeight: 700, fontSize: '11px', cursor: 'pointer', flex: 'none' }}>
                  OK
                </button>
              </div>
            )}
            {paso === 'productos' ? (
              <PrimaryCTA onClick={() => setPaso('resumen')}>Continuar al resumen</PrimaryCTA>
            ) : (
              <PrimaryCTA loading={submitting} disabled={submitting} onClick={irACobro} trailing={money(totalEntrega)}>
                {submitting ? 'Guardando…' : 'Cobrar'}
              </PrimaryCTA>
            )}
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
}

function CabeceraEntrega({ titulo, onBack }: { titulo: string; onBack: () => void }) {
  return (
    <IonHeader>
      <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
        <IonButtons slot="start">
          <IonButton onClick={onBack} style={{ color: 'var(--color-cyan)', fontSize: '15px', fontWeight: 700 }}>
            <IonIcon icon={arrowBackOutline} style={{ fontSize: '18px', marginRight: '4px' }} />
          </IonButton>
        </IonButtons>
        <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', fontSize: '17px', fontWeight: 700, color: '#fff', pointerEvents: 'none' }}>{titulo}</span>
        <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
          <SyncStatusBadge />
        </IonButtons>
      </IonToolbar>
      <ConnectivityStrip text="Venta y cobro se guardan en el equipo al instante" />
    </IonHeader>
  );
}
