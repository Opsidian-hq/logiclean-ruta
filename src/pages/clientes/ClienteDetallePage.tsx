/**
 * Logiclean Ruta — ClienteDetallePage
 *
 * Perfil del cliente. Dos vistas según el rol:
 *
 *  - **Vendedor** (`/clientes/:clienteId`): perfil unificado / dashboard de
 *    decisión del rediseño de Visitas. Muestra los pendientes como secciones que
 *    aparecen sólo si existen (cobros, entrega, seguimiento), cada una con su
 *    acción, más el historial y un FAB "VENDER" siempre disponible.
 *  - **Gerente** (`/admin/clientes/:clienteId`): vista read-only con récords en
 *    secciones expandibles (sin acciones).
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonFooter,
  IonModal,
  IonSpinner,
  IonText,
  IonIcon,
} from '@ionic/react';
import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  cartOutline,
  cashOutline,
  cubeOutline,
  navigateOutline,
  clipboardOutline,
  happyOutline,
} from 'ionicons/icons';
import { useClienteDetalle } from '../../hooks/useClienteDetalle';
import { useAuthContext } from '../../context/AuthContext';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { Chip } from '../../components/ui/Chip';
import { Card } from '../../components/ui/Card';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { GestionRutaModal } from '../visitas/components/GestionRutaModal';
import { actualizarRutaCliente } from '../../lib/visitas';
import { CICLO_OBJETIVO } from '../../lib/prospectos';
import { money } from '../../lib/money';
import { folioLocal } from '../../lib/folio';
import type { ReactNode } from 'react';
import type { Cliente } from '../../db/schema';

// ── Helpers ───────────────────────────────────────────────────

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Componente principal ──────────────────────────────────────

export function ClienteDetallePage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const { rol } = useAuthContext();
  const detalle = useClienteDetalle(clienteId);
  const { cliente, loading, error } = detalle;

  const backUrl = rol === 'gerente' ? '/admin/clientes' : '/visitas';

  const Encabezado = (
    <IonHeader>
      <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
        <IonButtons slot="start">
          <IonBackButton defaultHref={backUrl} style={{ '--color': 'var(--color-on-dark)' }} />
        </IonButtons>
        <IonTitle>{cliente?.nombre ?? 'Cliente'}</IonTitle>
      </IonToolbar>
      <ConnectivityStrip />
    </IonHeader>
  );

  if (loading) {
    return (
      <IonPage>
        {Encabezado}
        <IonContent>
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !cliente) {
    return (
      <IonPage>
        {Encabezado}
        <IonContent>
          <div style={{ padding: 'var(--space-lg)' }}>
            <IonText color="danger">
              <p>{error ?? 'Cliente no encontrado.'}</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return rol === 'vendedor' ? (
    <PerfilVendedor cliente={cliente} detalle={detalle} clienteId={clienteId} />
  ) : (
    <PerfilGerente cliente={cliente} detalle={detalle} />
  );
}

// ── Vista vendedor: dashboard de decisión ─────────────────────

interface PerfilProps {
  cliente: Cliente;
  detalle: ReturnType<typeof useClienteDetalle>;
}

function PerfilVendedor({
  cliente,
  detalle,
  clienteId,
}: PerfilProps & { clienteId: string }) {
  const history = useHistory();
  const { vendedorNombre, visitas, ventas, pedidosPendientes, desglose, refresh } = detalle;
  const [gestionOpen, setGestionOpen] = useState(false);

  const saldoTotal = desglose?.saldoTotal ?? 0;
  const etapa = Math.min(cliente.ciclo_visita, CICLO_OBJETIVO);
  const pctCiclo = Math.round((etapa / CICLO_OBJETIVO) * 100);

  // Nota / siguiente paso vigentes (visitas vienen ordenadas de más reciente).
  const notaAnterior = visitas.find((v) => v.nota)?.nota;
  const sigPaso = visitas.find((v) => v.siguiente_paso)?.siguiente_paso;

  const hayHistorial = (desglose?.historial.length ?? 0) > 0 || ventas.length > 0;
  const sinNada =
    saldoTotal <= 0 && pedidosPendientes.length === 0 && cliente.estado !== 'prospecto' && !hayHistorial;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/visitas" style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>{cliente.nombre}</IonTitle>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Hero */}
          <Card padding="16px">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <ClienteAvatar nombre={cliente.nombre} size={52} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '6px' }}>
                  {cliente.nombre}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <Chip tone={cliente.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                    {cliente.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                  </Chip>
                  <Chip tone={cliente.estado === 'activo' ? 'primarySoft' : 'amber'}>
                    {cliente.estado === 'activo' ? 'Activo' : 'Prospecto'}
                  </Chip>
                </div>
              </div>
            </div>
          </Card>

          {/* Ficha de datos */}
          <Card padding="6px 16px">
            <InfoFila etiqueta="Vendedor" valor={vendedorNombre ?? '—'} />
            <InfoFila etiqueta="Día de ruta" valor={cliente.dia_ruta ?? 'Sin asignar'} />
            <InfoFila
              etiqueta="Próxima visita"
              valor={cliente.fecha_proxima_visita ? fechaCorta(cliente.fecha_proxima_visita) : 'Sin agendar'}
            />
            <InfoFila etiqueta="Ciclo de visita" valor={`${cliente.ciclo_visita}`} last />
          </Card>

          {/* Gestionar día/visita (preserva la gestión de ruta del cliente) */}
          <button type="button" onClick={() => setGestionOpen(true)} style={linkBtn}>
            <IonIcon icon={navigateOutline} style={{ fontSize: '16px' }} />
            Gestionar día de visita
          </button>

          {/* a) Cobros pendientes (rojo) */}
          {saldoTotal > 0 && (
            <SeccionPendiente
              color="var(--color-error)"
              icon={cashOutline}
              titulo="Cobros pendientes"
              badge={desglose?.ventasConSaldo.length ?? 0}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-body)', marginBottom: '3px' }}>
                Total a cobrar · {money(saldoTotal)}
              </div>
              {desglose?.ventasConSaldo.map(({ venta, saldo }) => (
                <div key={venta.id} style={subLinea}>
                  · Venta {folioLocal(venta.id)} · {money(saldo)}
                </div>
              ))}
              <BotonAccion
                color="var(--color-error)"
                icon={cashOutline}
                onClick={() =>
                  history.push({
                    pathname: `/cobro/${clienteId}`,
                    state: { origen: 'cobro-pendiente', total: saldoTotal },
                  })
                }
              >
                Cobrar
              </BotonAccion>
            </SeccionPendiente>
          )}

          {/* b) Entrega pendiente (ámbar) */}
          {pedidosPendientes.length > 0 && (
            <SeccionPendiente
              color="#B45309"
              icon={cubeOutline}
              titulo="Entrega pendiente"
              badge={pedidosPendientes.length}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-body)', marginBottom: '3px' }}>
                Compromiso · {pedidosPendientes[0].fecha_compromiso ? fechaCorta(pedidosPendientes[0].fecha_compromiso) : 'sin fecha'}
              </div>
              {pedidosPendientes.map((p) => (
                <div key={p.id} style={subLinea}>
                  · {p.cantidad}× {p.nombre}
                </div>
              ))}
              <BotonAccion
                color="#B45309"
                icon={cubeOutline}
                onClick={() => history.push(`/entrega/${clienteId}`)}
              >
                Confirmar entrega
              </BotonAccion>
            </SeccionPendiente>
          )}

          {/* c) Seguimiento prospecto (navy) */}
          {cliente.estado === 'prospecto' && (
            <SeccionPendiente
              color="var(--color-navy)"
              icon={navigateOutline}
              titulo="Seguimiento prospecto"
              badge={`V${etapa}`}
            >
              <div style={{ background: 'var(--color-primary-bg)', borderRadius: '11px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#1E40AF', marginBottom: '7px' }}>
                  Visita {etapa} de {CICLO_OBJETIVO}
                </div>
                <div style={{ background: 'var(--color-primary-line)', borderRadius: '4px', height: '7px', marginBottom: '6px' }}>
                  <div style={{ background: 'var(--color-primary)', borderRadius: '4px', height: '7px', width: `${pctCiclo}%` }} />
                </div>
                <div style={{ fontSize: '12px', color: '#3B82F6' }}>{pctCiclo}% del ciclo completado</div>
              </div>
              {notaAnterior && (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-body)', marginBottom: '3px' }}>Nota anterior</div>
                  <div style={subLinea}>{notaAnterior}</div>
                </>
              )}
              {sigPaso && (
                <>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-body)', marginBottom: '3px' }}>Siguiente paso</div>
                  <div style={subLinea}>{sigPaso}</div>
                </>
              )}
              <BotonAccion
                outline
                icon={clipboardOutline}
                onClick={() => history.push(`/seguimiento/${clienteId}`)}
              >
                Registrar visita
              </BotonAccion>
            </SeccionPendiente>
          )}

          {/* Historial: cobros registrados */}
          {(desglose?.historial.length ?? 0) > 0 && (
            <HistorialCard titulo="Cobros registrados" badge={desglose!.historial.length}>
              {desglose!.historial.map((cobro) => (
                <FilaHistorial
                  key={cobro.id}
                  fecha={fechaHora(cobro.fecha)}
                  desc={cobro.forma_pago}
                  monto={money(cobro.monto)}
                />
              ))}
            </HistorialCard>
          )}

          {/* Historial: ventas recientes */}
          {ventas.length > 0 && (
            <HistorialCard titulo="Ventas recientes" badge={ventas.length}>
              {ventas.map(({ venta, lineas }) => (
                <FilaHistorial
                  key={venta.id}
                  fecha={fechaHora(venta.fecha)}
                  desc={lineas.map((l) => `${l.cantidad}× ${l.nombrePresentacion}`).join(', ')}
                  monto={money(venta.total)}
                />
              ))}
            </HistorialCard>
          )}

          {/* Estado vacío */}
          {sinNada && (
            <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--color-text-secondary)' }}>
              <IonIcon icon={happyOutline} style={{ fontSize: '30px', color: '#C8CAD0', display: 'block', margin: '0 auto 10px' }} />
              <span style={{ fontSize: '13px' }}>Sin actividad reciente</span>
            </div>
          )}

          <div style={{ height: '8px' }} />
        </div>
      </IonContent>

      {/* FAB "VENDER": acción universal, siempre disponible */}
      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            <button type="button" onClick={() => history.push(`/venta?cliente=${clienteId}`)} style={fabVender}>
              <IonIcon icon={cartOutline} style={{ fontSize: '20px' }} />
              VENDER
            </button>
          </div>
        </IonToolbar>
      </IonFooter>

      {/* Modal: gestionar día de visita / ruta del cliente */}
      <IonModal isOpen={gestionOpen} onDidDismiss={() => setGestionOpen(false)}>
        <GestionRutaModal
          cliente={cliente}
          onGuardar={async ({ diaRuta, fechaProxima }) => {
            await actualizarRutaCliente({ cliente, diaRuta, fechaProxima });
            await refresh();
          }}
          onClose={() => setGestionOpen(false)}
        />
      </IonModal>
    </IonPage>
  );
}

// ── Vista gerente: read-only con secciones expandibles ────────

function PerfilGerente({ cliente, detalle }: PerfilProps) {
  const { vendedorNombre, visitas, ventas, pedidosPendientes, desglose } = detalle;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin/clientes" style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>{cliente.nombre}</IonTitle>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '20px var(--space-md) 16px', borderBottom: '1px solid var(--color-divider)' }}>
          <ClienteAvatar nombre={cliente.nombre} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-navy)', lineHeight: 1.1, marginBottom: '6px' }}>
              {cliente.nombre}
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <Chip tone={cliente.tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                {cliente.tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
              </Chip>
              <Chip tone={cliente.estado === 'activo' ? 'primarySoft' : 'amber'}>
                {cliente.estado === 'activo' ? 'Activo' : 'Prospecto'}
              </Chip>
            </div>
          </div>
        </div>

        {/* Info básica */}
        <div style={{ padding: '14px var(--space-md)', borderBottom: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {vendedorNombre && <InfoFila etiqueta="Vendedor" valor={vendedorNombre} />}
          {cliente.dia_ruta && <InfoFila etiqueta="Día de ruta" valor={cliente.dia_ruta} />}
          {cliente.fecha_proxima_visita && (
            <InfoFila etiqueta="Próxima visita" valor={fechaCorta(cliente.fecha_proxima_visita)} />
          )}
          <InfoFila etiqueta="Ciclo de visita" valor={`${cliente.ciclo_visita}`} />
        </div>

        {/* Saldo */}
        <div style={{ paddingTop: 'var(--space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--space-md)', marginBottom: '8px' }}>
            <span style={tituloSeccion}>Saldo pendiente</span>
            <span className="numeric" style={{ fontSize: '18px', fontWeight: 800, color: desglose && desglose.saldoTotal > 0 ? 'var(--color-error-text)' : 'var(--color-navy)' }}>
              {desglose ? money(desglose.saldoTotal) : '—'}
            </span>
          </div>

          <Seccion titulo="Cobros registrados" badge={desglose?.historial.length} emptyText="Sin cobros registrados.">
            {(desglose?.historial ?? []).map((cobro) => (
              <FilaRegistro key={cobro.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>{fechaHora(cobro.fecha)}</span>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{cobro.forma_pago}</span>
                  </div>
                  <span className="numeric" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)' }}>{money(cobro.monto)}</span>
                </div>
              </FilaRegistro>
            ))}
          </Seccion>
        </div>

        <Seccion titulo="Ventas recientes" badge={ventas.length} emptyText="Sin ventas registradas.">
          {ventas.map(({ venta, lineas }) => (
            <FilaRegistro key={venta.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '4px' }}>{fechaHora(venta.fecha)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {lineas.map((l) => (
                      <span key={l.id} style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{l.cantidad}× {l.nombrePresentacion}</span>
                    ))}
                  </div>
                </div>
                <span className="numeric" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)', whiteSpace: 'nowrap' }}>{money(venta.total)}</span>
              </div>
            </FilaRegistro>
          ))}
        </Seccion>

        <Seccion titulo="Pedidos pendientes" badge={pedidosPendientes.length} emptyText="Sin pedidos pendientes.">
          {pedidosPendientes.map((p) => (
            <FilaRegistro key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>{p.nombre}</div>
                  {p.fecha_compromiso && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>Entrega: {fechaCorta(p.fecha_compromiso)}</div>
                  )}
                </div>
                <span className="numeric" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)', whiteSpace: 'nowrap' }}>×{p.cantidad}</span>
              </div>
            </FilaRegistro>
          ))}
        </Seccion>

        <Seccion titulo="Historial de visitas" badge={visitas.length} emptyText="Sin visitas registradas.">
          {visitas.map((v) => (
            <FilaRegistro key={v.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: v.nota ? '4px' : 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>{fechaCorta(v.fecha)}</span>
                    <span className="numeric" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>Visita {v.numero_ciclo}</span>
                  </div>
                  {v.nota && <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>{v.nota}</p>}
                  {v.siguiente_paso && <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>Siguiente: {v.siguiente_paso}</p>}
                </div>
              </div>
            </FilaRegistro>
          ))}
        </Seccion>

        <div style={{ height: 'var(--space-2xl)' }} />
      </IonContent>
    </IonPage>
  );
}

// ── Sub-componentes locales ────────────────────────────────────

const tituloSeccion = {
  fontSize: '11px',
  fontWeight: 800 as const,
  letterSpacing: '0.8px',
  textTransform: 'uppercase' as const,
  color: 'var(--color-text-secondary)',
};

const subLinea = {
  fontSize: '12.5px',
  color: 'var(--color-text-secondary)',
  marginBottom: '4px',
};

const linkBtn = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minHeight: '44px',
  width: '100%',
  border: '1.5px solid var(--color-divider)',
  borderRadius: '12px',
  background: 'var(--color-surface)',
  color: 'var(--color-navy)',
  fontSize: '14px',
  fontWeight: 700,
  cursor: 'pointer',
};

const fabVender = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  width: '100%',
  minHeight: 'var(--cta-height)',
  border: 'none',
  borderRadius: '16px',
  background: 'var(--color-primary)',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '0.3px',
  boxShadow: 'var(--shadow-cta)',
  cursor: 'pointer',
};

function InfoFila({ etiqueta, valor, last = false }: { etiqueta: string; valor: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '9px 0', borderBottom: last ? 'none' : '0.5px solid var(--color-border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{etiqueta}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-body)' }}>{valor}</span>
    </div>
  );
}

function SeccionPendiente({
  color,
  icon,
  titulo,
  badge,
  children,
}: {
  color: string;
  icon: string;
  titulo: string;
  badge: number | string;
  children: ReactNode;
}) {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', background: '#FAFBFF' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={icon} style={{ fontSize: '15px' }} />
          {titulo}
        </span>
        <span style={{ color: '#fff', background: color, fontSize: '10px', fontWeight: 800, minWidth: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
          {badge}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function BotonAccion({
  color,
  outline = false,
  icon,
  onClick,
  children,
}: {
  color?: string;
  outline?: boolean;
  icon: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        marginTop: '10px',
        padding: '13px 0',
        borderRadius: '11px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        border: outline ? '1.5px solid var(--color-primary)' : 'none',
        background: outline ? 'transparent' : (color ?? 'var(--color-primary)'),
        color: outline ? 'var(--color-primary)' : '#fff',
      }}
    >
      <IonIcon icon={icon} style={{ fontSize: '17px' }} />
      {children}
    </button>
  );
}

function HistorialCard({ titulo, badge, children }: { titulo: string; badge: number; children: ReactNode }) {
  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
      <div style={{ padding: '13px 16px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-text-secondary)', background: '#FAFBFF', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {titulo}
        <span style={{ color: '#fff', background: 'var(--color-primary)', fontSize: '10px', fontWeight: 800, minWidth: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
          {badge}
        </span>
      </div>
      {children}
    </div>
  );
}

function FilaHistorial({ fecha, desc, monto }: { fecha: string; desc: string; monto: string }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)' }}>{fecha}</div>
        <div style={{ fontSize: '13px', color: 'var(--color-body)', fontWeight: 500, textTransform: 'capitalize' }}>{desc}</div>
      </div>
      <span className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)', whiteSpace: 'nowrap' }}>{monto}</span>
    </div>
  );
}

// ── Sección expandible (sólo vista gerente) ────────────────────

const PREVIEW = 2;

function Seccion({ titulo, badge, children, emptyText }: { titulo: string; badge?: number; children: ReactNode[]; emptyText?: string }) {
  const [expandida, setExpandida] = useState(false);
  const total = children.length;
  const visibles = expandida ? children : children.slice(0, PREVIEW);
  const restantes = total - PREVIEW;

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 var(--space-md)', marginBottom: '8px' }}>
        <span style={tituloSeccion}>{titulo}</span>
        {badge !== undefined && badge > 0 && (
          <span style={{ fontSize: '11px', fontWeight: 800, background: 'var(--color-primary-soft)', color: 'var(--color-primary)', borderRadius: '10px', padding: '1px 7px' }}>
            {badge}
          </span>
        )}
      </div>

      {total === 0 && emptyText && (
        <div style={{ padding: '10px var(--space-md)' }}>
          <IonText color="medium">
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>{emptyText}</p>
          </IonText>
        </div>
      )}

      {visibles}

      {total > PREVIEW && (
        <button type="button" onClick={() => setExpandida(!expandida)} style={{ display: 'block', width: '100%', padding: '10px var(--space-md)', border: 'none', background: 'transparent', color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', fontWeight: 700, textAlign: 'left', cursor: 'pointer' }}>
          {expandida ? 'Ocultar' : `Ver más · ${restantes} registro${restantes !== 1 ? 's' : ''} más`}
        </button>
      )}
    </div>
  );
}

function FilaRegistro({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-divider)', padding: '12px var(--space-md)' }}>
      {children}
    </div>
  );
}
