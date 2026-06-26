/**
 * Logiclean Ruta — ClienteDetallePage
 *
 * Perfil completo de un cliente: datos base + récords (visitas, ventas,
 * pedidos pendientes, saldo/cobros). Read-only; muestra los últimos 2
 * registros de cada sección con "Ver más" / "Ocultar" para expandir.
 *
 * Rutas:
 *   /clientes/:clienteId       (vendedor)
 *   /admin/clientes/:clienteId (gerente)
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { cartOutline, cashOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';
import { useClienteDetalle } from '../../hooks/useClienteDetalle';
import { useAuthContext } from '../../context/AuthContext';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { Chip } from '../../components/ui/Chip';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { money } from '../../lib/money';
import type { ReactNode } from 'react';

// ── Helpers ───────────────────────────────────────────────────

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

// ── Sección expandible ────────────────────────────────────────

const PREVIEW = 2;

interface SeccionProps {
  titulo: string;
  badge?: number;
  children: ReactNode[];
  emptyText?: string;
}

function Seccion({ titulo, badge, children, emptyText }: SeccionProps) {
  const [expandida, setExpandida] = useState(false);
  const total = children.length;
  const visibles = expandida ? children : children.slice(0, PREVIEW);
  const restantes = total - PREVIEW;

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Encabezado de sección */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '0 var(--space-md)',
          marginBottom: '8px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            color: 'var(--color-text-secondary)',
          }}
        >
          {titulo}
        </span>
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              fontSize: '11px',
              fontWeight: 800,
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              borderRadius: '10px',
              padding: '1px 7px',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Registros */}
      {total === 0 && emptyText && (
        <div style={{ padding: '10px var(--space-md)' }}>
          <IonText color="medium">
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>{emptyText}</p>
          </IonText>
        </div>
      )}

      {visibles}

      {/* Botón Ver más / Ocultar */}
      {total > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpandida(!expandida)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px var(--space-md)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-primary)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          {expandida ? 'Ocultar' : `Ver más · ${restantes} registro${restantes !== 1 ? 's' : ''} más`}
        </button>
      )}
    </div>
  );
}

// ── Fila genérica de registro ─────────────────────────────────

function FilaRegistro({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-divider)',
        padding: '12px var(--space-md)',
      }}
    >
      {children}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export function ClienteDetallePage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const history = useHistory();
  const { rol } = useAuthContext();
  const { cliente, vendedorNombre, visitas, ventas, pedidosPendientes, desglose, loading, error } =
    useClienteDetalle(clienteId);

  const backUrl = rol === 'gerente' ? '/admin/clientes' : '/mis-clientes';

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
            <IonButtons slot="start">
              <IonBackButton defaultHref={backUrl} style={{ '--color': 'var(--color-on-dark)' }} />
            </IonButtons>
            <IonTitle>Cliente</IonTitle>
          </IonToolbar>
          <ConnectivityStrip />
        </IonHeader>
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
        <IonHeader>
          <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
            <IonButtons slot="start">
              <IonBackButton defaultHref={backUrl} style={{ '--color': 'var(--color-on-dark)' }} />
            </IonButtons>
            <IonTitle>Cliente</IonTitle>
          </IonToolbar>
          <ConnectivityStrip />
        </IonHeader>
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref={backUrl} style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>{cliente.nombre}</IonTitle>
        </IonToolbar>
        <ConnectivityStrip />
      </IonHeader>

      <IonContent>
        {/* ── Cabecera del cliente ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '20px var(--space-md) 16px',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <ClienteAvatar nombre={cliente.nombre} size={52} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: 'var(--color-navy)',
                lineHeight: 1.1,
                marginBottom: '6px',
              }}
            >
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

        {/* ── Info básica ── */}
        <div
          style={{
            padding: '14px var(--space-md)',
            borderBottom: '1px solid var(--color-divider)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {vendedorNombre && (
            <InfoFila etiqueta="Vendedor" valor={vendedorNombre} />
          )}
          {cliente.dia_ruta && (
            <InfoFila etiqueta="Día de ruta" valor={cliente.dia_ruta} />
          )}
          {cliente.fecha_proxima_visita && (
            <InfoFila etiqueta="Próxima visita" valor={fechaCorta(cliente.fecha_proxima_visita)} />
          )}
          <InfoFila etiqueta="Ciclo de visita" valor={`${cliente.ciclo_visita}`} />
        </div>

        {/* ── Acciones rápidas (sólo vendedor) ── */}
        {rol === 'vendedor' && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              padding: '14px var(--space-md)',
              borderBottom: '1px solid var(--color-divider)',
            }}
          >
            <ActionButton
              icon={cartOutline}
              label="Vender"
              onClick={() => history.push(`/venta?cliente=${clienteId}`)}
              primary
            />
            <ActionButton
              icon={cashOutline}
              label="Cobrar"
              onClick={() => history.push(`/cobranza/${clienteId}`)}
            />
          </div>
        )}

        {/* ── Saldo ── */}
        <div style={{ paddingTop: 'var(--space-md)' }}>
          {/* Resumen de saldo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 var(--space-md)',
              marginBottom: '8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: 'var(--color-text-secondary)',
              }}
            >
              Saldo pendiente
            </span>
            <span
              className="numeric"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: desglose && desglose.saldoTotal > 0 ? 'var(--color-error-text)' : 'var(--color-navy)',
              }}
            >
              {desglose ? money(desglose.saldoTotal) : '—'}
            </span>
          </div>

          {/* Historial de cobros */}
          <Seccion
            titulo="Cobros registrados"
            badge={desglose?.historial.length}
            emptyText="Sin cobros registrados."
          >
            {(desglose?.historial ?? []).map((cobro) => (
              <FilaRegistro key={cobro.id}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>
                      {fechaHora(cobro.fecha)}
                    </span>
                    <span
                      style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        color: 'var(--color-text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {cobro.forma_pago}
                    </span>
                  </div>
                  <span className="numeric" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)' }}>
                    {money(cobro.monto)}
                  </span>
                </div>
              </FilaRegistro>
            ))}
          </Seccion>
        </div>

        {/* ── Ventas recientes ── */}
        <Seccion
          titulo="Ventas recientes"
          badge={ventas.length}
          emptyText="Sin ventas registradas."
        >
          {ventas.map(({ venta, lineas }) => (
            <FilaRegistro key={venta.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)', marginBottom: '4px' }}>
                    {fechaHora(venta.fecha)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {lineas.map((l) => (
                      <span
                        key={l.id}
                        style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}
                      >
                        {l.cantidad}× {l.nombrePresentacion}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="numeric" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-navy)', whiteSpace: 'nowrap' }}>
                  {money(venta.total)}
                </span>
              </div>
            </FilaRegistro>
          ))}
        </Seccion>

        {/* ── Pedidos pendientes ── */}
        <Seccion
          titulo="Pedidos pendientes"
          badge={pedidosPendientes.length}
          emptyText="Sin pedidos pendientes."
        >
          {pedidosPendientes.map((p) => (
            <FilaRegistro key={p.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>
                    {p.nombre}
                  </div>
                  {p.fecha_compromiso && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Entrega: {fechaCorta(p.fecha_compromiso)}
                    </div>
                  )}
                </div>
                <span className="numeric" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)', whiteSpace: 'nowrap' }}>
                  ×{p.cantidad}
                </span>
              </div>
            </FilaRegistro>
          ))}
        </Seccion>

        {/* ── Historial de visitas ── */}
        <Seccion
          titulo="Historial de visitas"
          badge={visitas.length}
          emptyText="Sin visitas registradas."
        >
          {visitas.map((v) => (
            <FilaRegistro key={v.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: v.nota ? '4px' : 0 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-navy)' }}>
                      {fechaCorta(v.fecha)}
                    </span>
                    <span
                      className="numeric"
                      style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}
                    >
                      Visita {v.numero_ciclo}
                    </span>
                  </div>
                  {v.nota && (
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {v.nota}
                    </p>
                  )}
                  {v.siguiente_paso && (
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                      Siguiente: {v.siguiente_paso}
                    </p>
                  )}
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

function InfoFila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', minWidth: '110px' }}>
        {etiqueta}
      </span>
      <span style={{ fontSize: '14px', color: 'var(--color-navy)' }}>{valor}</span>
    </div>
  );
}

interface ActionButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
}

function ActionButton({ icon, label, onClick, primary = false }: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        minHeight: '44px',
        border: primary ? 'none' : '1.5px solid var(--color-divider)',
        borderRadius: '12px',
        background: primary ? 'var(--color-primary)' : 'transparent',
        color: primary ? '#fff' : 'var(--color-navy)',
        fontSize: '15px',
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      <IonIcon icon={icon} style={{ fontSize: '18px' }} />
      {label}
    </button>
  );
}
