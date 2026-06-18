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
} from '@ionic/react';
import { cartOutline, addOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useRutaDelDia } from '../../hooks/useRutaDelDia';
import { useSeguimiento } from '../../hooks/useSeguimiento';
import { clasificarVencimiento, CICLO_OBJETIVO } from '../../lib/prospectos';
import type { Vencimiento } from '../../lib/prospectos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { CicloBar } from '../../components/ui/CicloBar';
import { FichaProspecto } from './components/FichaProspecto';
import { NuevoProspectoForm } from './components/NuevoProspectoForm';
import { pedidosPendientesVista, entregarPedido } from '../../lib/pedidos';
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Visitas</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
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

            {!ruta.loading && !ruta.error && ruta.clientes.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>No hay clientes en la ruta de hoy.</p>
                </IonText>
              </div>
            )}

            {!ruta.loading && !ruta.error && ruta.clientes.length > 0 && (
              <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ruta.clientes.map((c) => (
                  <Card key={c.id} padding="13px 14px">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '11px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.1 }}>
                          {c.nombre}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '6px', flexWrap: 'wrap' }}>
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
                      </div>
                      <button
                        type="button"
                        onClick={() => history.push(`/venta?cliente=${c.id}`)}
                        style={{
                          flex: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          minHeight: '44px',
                          padding: '0 16px',
                          border: 'none',
                          borderRadius: '12px',
                          background: 'var(--color-primary)',
                          color: '#fff',
                          fontSize: '15px',
                          fontWeight: 800,
                          boxShadow: 'var(--shadow-cta)',
                          cursor: 'pointer',
                        }}
                      >
                        <IonIcon icon={cartOutline} style={{ fontSize: '18px' }} />
                        Vender
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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

            {!seg.loading && !seg.error && seg.prospectos.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <IonText color="medium">
                  <p>Sin prospectos por vencer esta semana.</p>
                </IonText>
              </div>
            )}

            {!seg.loading && !seg.error && seg.prospectos.length > 0 && (
              <>
                <div style={{ padding: '18px var(--space-md) 12px' }}>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.12, letterSpacing: '-0.2px' }}>
                    ¿A quién visitar esta semana?
                  </div>
                  <div className="numeric" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', marginTop: '6px' }}>
                    {seg.prospectos.length} prospecto{seg.prospectos.length !== 1 ? 's' : ''} en seguimiento
                  </div>
                </div>

                {GRUPOS.map(({ clave, titulo, color }) => {
                  const items = seg.prospectos.filter((c) => clasificarVencimiento(c) === clave);
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
                        return (
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setFichaCliente(c)}
                            onKeyDown={(e) => e.key === 'Enter' && setFichaCliente(c)}
                            style={{
                              display: 'flex',
                              alignItems: 'stretch',
                              background: 'var(--color-surface)',
                              borderBottom: '1px solid var(--color-divider)',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ width: '5px', flex: 'none', background: BARRA_URGENCIA[clave] }} />
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: '13px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '7px',
                              }}
                            >
                              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-navy)', lineHeight: 1.05 }}>
                                {c.nombre}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <CicloBar actual={etapa} objetivo={CICLO_OBJETIVO} />
                                <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-body)', whiteSpace: 'nowrap' }}>
                                  Visita {etapa} de {CICLO_OBJETIVO}
                                </span>
                                <span style={{ marginLeft: 'auto' }}>
                                  <Chip tone={chip.tone}>{chip.label}</Chip>
                                </span>
                              </div>
                            </div>
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
    </IonPage>
  );
}
