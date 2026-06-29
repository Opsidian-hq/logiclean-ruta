/**
 * Logiclean Ruta — VisitasPage (vendedor)
 *
 * Una sola pantalla con dos segmentos:
 *  - Hoy:    ruta del día (H-08) — clientes/prospectos a visitar hoy.
 *  - Semana: seguimiento de prospectos (H-02) — vencidos + por vencer, con
 *            ficha + registro de visita (H-01) y alta de prospecto.
 * Ruta: /visitas
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonText,
  IonSpinner,
  IonIcon,
  IonModal,
  IonFab,
  IonFabButton,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  addOutline,
  cartOutline,
  personAddOutline,
  personOutline,
  cashOutline,
  cubeOutline,
  timeOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { useState, useCallback, type ReactNode } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useRutaDelDia } from '../../hooks/useRutaDelDia';
import { useSeguimiento } from '../../hooks/useSeguimiento';
import { clasificarVencimiento, CICLO_OBJETIVO } from '../../lib/prospectos';
import type { Vencimiento } from '../../lib/prospectos';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { CicloBar } from '../../components/ui/CicloBar';
import { FichaProspecto } from './components/FichaProspecto';
import { NuevoProspectoForm } from './components/NuevoProspectoForm';
import { pedidosPendientesVista, entregarPedido } from '../../lib/pedidos';
import { money } from '../../lib/money';
import type { Cliente } from '../../db/schema';

const BARRA_URGENCIA: Record<Vencimiento, string> = {
  vencido: 'var(--color-error)',
  por_vencer: 'var(--color-amber)',
  al_dia: '#E3E7EE',
};

// Días entre hoy y la fecha (local). Negativo = vencida.
function diasHasta(fechaISO?: string | null): number | null {
  if (!fechaISO) return null;
  const [y, m, d] = fechaISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  const objetivo = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000);
}

// Texto + tono del chip de urgencia, a partir de la fecha de próxima visita.
function urgenciaChip(c: Cliente): { tone: 'error' | 'amber' | 'neutral'; label: string } {
  const dias = diasHasta(c.fecha_proxima_visita);
  if (dias == null) return { tone: 'neutral', label: 'Sin fecha' };
  if (dias < 0) return { tone: 'error', label: `Vencida · ${-dias} día${-dias !== 1 ? 's' : ''}` };
  if (dias === 0) return { tone: 'amber', label: 'Vence hoy' };
  if (dias === 1) return { tone: 'amber', label: 'Vence mañana' };
  if (clasificarVencimiento(c) === 'por_vencer') return { tone: 'amber', label: `Vence en ${dias} días` };
  return { tone: 'neutral', label: `En ${dias} días` };
}

const GRUPOS: { clave: Vencimiento; titulo: string; color: string }[] = [
  { clave: 'vencido', titulo: 'Vencidas', color: 'var(--color-error-text)' },
  { clave: 'por_vencer', titulo: 'Por vencer esta semana', color: 'var(--color-pending-text)' },
  { clave: 'al_dia', titulo: 'Al día', color: 'var(--color-text-secondary)' },
];

export function VisitasPage() {
  const [segmento, setSegmento] = useState<'hoy' | 'semana'>('hoy');
  const history = useHistory();

  const ruta = useRutaDelDia();
  const seg = useSeguimiento();

  const [fichaCliente, setFichaCliente] = useState<Cliente | null>(null);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const location = useLocation<{ toast?: string } | undefined>();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => {
      await ruta.refresh();
      await seg.refresh();
    }, [ruta.refresh, seg.refresh])
  );

  // Al volver de un flujo (cobro/entrega/seguimiento): refrescar la ruta para
  // que el pendiente resuelto desaparezca, y mostrar el toast de confirmación.
  useIonViewWillEnter(() => {
    void ruta.refresh();
    void seg.refresh();
    const msg = location.state?.toast;
    if (msg) {
      setToast(msg);
      history.replace({ pathname: '/visitas', state: undefined });
    }
  });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Visitas</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          {/* Contraste para luz solar (D-007): ambos tabs en blanco, el activo
              con subrayado de acento. Estilo compartido `.segment-on-navy`. */}
          <IonSegment
            className="segment-on-navy"
            value={segmento}
            onIonChange={(e) =>
              setSegmento((e.detail.value as 'hoy' | 'semana') ?? 'hoy')
            }
          >
            <IonSegmentButton value="hoy">
              <IonLabel>Hoy</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="semana">
              <IonLabel>Esta semana</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {/* ── Segmento HOY: ruta del día ── */}
        {segmento === 'hoy' && (
          <>
            {ruta.loading && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {!ruta.loading && ruta.error && (
              <div style={{ padding: 'var(--space-lg)' }}>
                <IonText color="danger">
                  <p>Error al cargar la ruta: {ruta.error}</p>
                </IonText>
              </div>
            )}

            {!ruta.loading && !ruta.error && ruta.items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>No hay clientes en la ruta de hoy.</p>
                </IonText>
              </div>
            )}

            {!ruta.loading && !ruta.error && ruta.items.length > 0 && (
              <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ruta.items.map(({ cliente: c, sumCobros, nEntregas, seguimiento }) => (
                  // La tarjeta completa es el punto de entrada al perfil del cliente.
                  <Card
                    key={c.id}
                    padding="16px"
                    role="button"
                    tabIndex={0}
                    onClick={() => history.push(`/clientes/${c.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && history.push(`/clientes/${c.id}`)}
                    style={{ position: 'relative', cursor: 'pointer' }}
                  >
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.1, paddingRight: '24px' }}>
                      {c.nombre}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <Chip tone={c.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                        {c.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                      </Chip>
                      <Chip tone={c.estado === 'prospecto' ? 'amber' : 'primarySoft'}>
                        {c.estado === 'prospecto' ? 'Prospecto' : 'Cliente'}
                      </Chip>
                      {c.dia_ruta && (
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>{c.dia_ruta}</span>
                      )}
                    </div>

                    {/* Alertas contextuales: sólo las que aplican, una por línea. */}
                    {(sumCobros > 0 || nEntregas > 0 || seguimiento) && (
                      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {sumCobros > 0 && (
                          <AlertaVisita color="var(--color-error)" icon={cashOutline}>
                            Cobro pendiente · {money(sumCobros)}
                          </AlertaVisita>
                        )}
                        {nEntregas > 0 && (
                          <AlertaVisita color="#B45309" icon={cubeOutline}>
                            Entrega pendiente · {nEntregas} producto{nEntregas !== 1 ? 's' : ''}
                          </AlertaVisita>
                        )}
                        {seguimiento && (
                          <AlertaVisita color="var(--color-primary)" icon={timeOutline}>
                            Seguimiento · Visita {seguimiento.visita} de {seguimiento.objetivo}
                          </AlertaVisita>
                        )}
                      </div>
                    )}

                    <IonIcon
                      icon={chevronForwardOutline}
                      style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#C8CAD0', fontSize: '20px' }}
                    />
                  </Card>
                ))}
              </div>
            )}

            {/* FAB: añadir prospecto */}
            <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: '76px' }}>
              <IonFabButton
                style={{ '--background': 'var(--color-primary)' }}
                onClick={() => setNuevoOpen(true)}
              >
                <IonIcon icon={personAddOutline} />
              </IonFabButton>
            </IonFab>

            {/* FAB: nueva venta directa */}
            <IonFab vertical="bottom" horizontal="end" slot="fixed">
              <IonFabButton
                style={{ '--background': 'var(--color-primary)' }}
                onClick={() => history.push('/venta')}
              >
                <IonIcon icon={cartOutline} />
              </IonFabButton>
            </IonFab>
          </>
        )}

        {/* ── Segmento SEMANA: seguimiento de prospectos ── */}
        {segmento === 'semana' && (
          <>
            {seg.loading && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonSpinner name="crescent" />
              </div>
            )}

            {!seg.loading && seg.error && (
              <div style={{ padding: 'var(--space-lg)' }}>
                <IonText color="danger">
                  <p>Error al cargar el seguimiento: {seg.error}</p>
                </IonText>
              </div>
            )}

            {!seg.loading && !seg.error && seg.seguimiento.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>Sin visitas ni entregas por atender esta semana.</p>
                </IonText>
              </div>
            )}

            {!seg.loading && !seg.error && seg.seguimiento.length > 0 && (
              <>
                <div style={{ padding: '18px var(--space-md) 12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.12, letterSpacing: '-0.2px' }}>
                    ¿A quién visitar esta semana?
                  </div>
                  <div className="numeric" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                    {seg.seguimiento.length} por atender esta semana
                  </div>
                </div>

                {GRUPOS.map(({ clave, titulo, color }) => {
                  const items = seg.seguimiento.filter((c) => clasificarVencimiento(c) === clave);
                  if (items.length === 0) return null;
                  return (
                    <div key={clave}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          letterSpacing: '0.8px',
                          textTransform: 'uppercase',
                          color,
                          padding: '14px var(--space-md) 6px',
                        }}
                      >
                        {titulo} · {items.length}
                      </div>
                      {items.map((c) => {
                        const chip = urgenciaChip(c);
                        const etapa = Math.min(c.ciclo_visita, CICLO_OBJETIVO);
                        // Prospecto → ciclo de visitas; cliente activo → entrega/visita.
                        const esEntrega = c.estado !== 'prospecto';
                        const nEntregas = seg.entregasPorCliente[c.id] ?? 0;
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              background: 'var(--color-surface)',
                              borderBottom: '1px solid var(--color-divider)',
                            }}
                          >
                            <div style={{ width: '5px', flex: 'none', background: BARRA_URGENCIA[clave] }} />
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => setFichaCliente(c)}
                              onKeyDown={(e) => e.key === 'Enter' && setFichaCliente(c)}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '13px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '7px',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.05 }}>
                                {c.nombre}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                {esEntrega ? (
                                  <Chip tone="primarySoft">
                                    {nEntregas > 0
                                      ? `Entrega pendiente${nEntregas > 1 ? ` · ${nEntregas}` : ''}`
                                      : 'Visita programada'}
                                  </Chip>
                                ) : (
                                  <>
                                    <CicloBar actual={etapa} objetivo={CICLO_OBJETIVO} />
                                    <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-body)', whiteSpace: 'nowrap' }}>
                                      Visita {etapa} de {CICLO_OBJETIVO}
                                    </span>
                                  </>
                                )}
                                <span style={{ marginLeft: 'auto' }}>
                                  <Chip tone={chip.tone}>{chip.label}</Chip>
                                </span>
                              </div>
                            </div>
                            {/* Botón "Perfil" → detalle del cliente */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                history.push(`/clientes/${c.id}`);
                              }}
                              style={{
                                flex: 'none',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px',
                                padding: '0 14px',
                                border: 'none',
                                borderLeft: '1px solid var(--color-divider)',
                                background: 'transparent',
                                color: 'var(--color-text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              <IonIcon icon={personOutline} style={{ fontSize: '20px' }} />
                              <span style={{ fontSize: '10px', fontWeight: 700 }}>Perfil</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}

            {/* FAB: nuevo prospecto */}
            <IonFab vertical="bottom" horizontal="end" slot="fixed">
              <IonFabButton
                style={{ '--background': 'var(--color-primary)' }}
                onClick={() => setNuevoOpen(true)}
              >
                <IonIcon icon={addOutline} />
              </IonFabButton>
            </IonFab>
          </>
        )}
      </IonContent>

      {/* Modal: ficha del prospecto */}
      <IonModal isOpen={!!fichaCliente} onDidDismiss={() => setFichaCliente(null)}>
        {fichaCliente && (
          <FichaProspecto
            cliente={fichaCliente}
            cargarVisitas={seg.visitasDeCliente}
            onRegistrar={seg.registrarVisita}
            onReprogramar={(fechaProxima) =>
              seg.reprogramarVisita({ cliente: fichaCliente, fechaProxima })
            }
            onCambiarDia={async (dia) => {
              await seg.actualizarRuta({ cliente: fichaCliente, diaRuta: dia });
              await ruta.refresh();
            }}
            onCobrarSaldo={() => {
              const id = fichaCliente.id;
              setFichaCliente(null);
              history.push(`/cobranza/${id}`);
            }}
            cargarPedidos={pedidosPendientesVista}
            onEntregarPedido={async (pedidoId) => {
              await entregarPedido({ pedidoId });
              // El pedido entregado es ahora una venta; refrescar ruta y semana.
              await Promise.all([ruta.refresh(), seg.refresh()]);
            }}
            onClose={() => setFichaCliente(null)}
          />
        )}
      </IonModal>

      {/* Modal: nuevo prospecto */}
      <IonModal isOpen={nuevoOpen} onDidDismiss={() => setNuevoOpen(false)}>
        <NuevoProspectoForm
          onCrear={seg.crearProspecto}
          onClose={() => setNuevoOpen(false)}
        />
      </IonModal>

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2200}
        onDidDismiss={() => setToast(null)}
        color="dark"
      />
    </IonPage>
  );
}

/** Línea de alerta contextual de una tarjeta de visita (icono + texto en color). */
function AlertaVisita({
  color,
  icon,
  children,
}: {
  color: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color }}>
      <IonIcon icon={icon} style={{ fontSize: '15px', flex: 'none' }} />
      {children}
    </div>
  );
}
