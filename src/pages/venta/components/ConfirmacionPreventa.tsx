/**
 * Logiclean Ruta — ConfirmacionPreventa
 *
 * Confirmación cuando el vendedor levanta un pedido pendiente SIN una venta del
 * vehículo (preventa). No hay cobro: el flujo termina aquí confirmando que el
 * pedido quedó programado y que el cliente reaparecerá en la ruta para
 * entregarlo (su próxima visita se agenda en la fecha de entrega).
 */

import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButtons,
  IonFooter,
} from '@ionic/react';
import { SyncStatusBadge } from '../../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../../components/ui/ConnectivityStrip';
import { Card } from '../../../components/ui/Card';
import { Chip } from '../../../components/ui/Chip';
import { ClienteAvatar } from '../../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../../components/ui/PrimaryCTA';
import { useSyncContext } from '../../../context/SyncContext';
import { folioLocal } from '../../../lib/folio';

export interface PedidoConfirmado {
  nombre: string;
  cantidad: number;
  fecha_compromiso?: string;
}

interface ConfirmacionPreventaProps {
  ventaId: string;
  clienteNombre: string;
  tipo: 'mayoreo' | 'menudeo';
  pedidos: PedidoConfirmado[];
  onVolverRuta: () => void;
}

export function ConfirmacionPreventa({
  ventaId,
  clienteNombre,
  tipo,
  pedidos,
  onVolverRuta,
}: ConfirmacionPreventaProps) {
  const { isOnline, syncStatus, pendingCount } = useSyncContext();

  const sincronizado = isOnline && syncStatus !== 'error' && pendingCount === 0;
  const ctaCargando = syncStatus === 'syncing';

  // La entrega más próxima define cuándo reaparece el cliente en la ruta.
  const proximaEntrega = pedidos
    .map((p) => p.fecha_compromiso)
    .filter((f): f is string => !!f)
    .sort()[0];

  return (
    <>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <span style={{ fontSize: '18px', fontWeight: 800, color: '#fff', paddingLeft: 'var(--space-md)' }}>
            Preventa programada
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

      <IonContent>
        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Banner de estado de guardado */}
          <div style={{ background: sincronizado ? '#ECFCE0' : '#FEF3E2', border: `1.5px solid ${sincronizado ? '#B7EE92' : '#F6C97C'}`, borderRadius: '16px', padding: '14px 15px', display: 'flex', alignItems: 'center', gap: '13px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: sincronizado ? 'var(--color-lime)' : 'var(--color-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: 'var(--color-navy)', fontSize: '20px', fontWeight: 800 }}>
              ✓
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: sincronizado ? '#1C4310' : '#7A3E06' }}>
                {sincronizado ? 'Pedido programado' : 'Pedido guardado en el equipo'}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: sincronizado ? '#3E6B22' : 'var(--color-pending-text)', marginTop: '2px' }}>
                {sincronizado ? 'Guardado ✓ · Sincronizado ✓' : 'Guardado ✓ · en cola'}
              </div>
            </div>
          </div>

          {/* Folio local */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface)', border: '1px dashed #CBD3E0', borderRadius: '12px', padding: '11px 14px' }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A94A6' }}>Folio local</div>
              <div className="numeric" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-navy)', marginTop: '1px' }}>{folioLocal(ventaId)}</div>
            </div>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>preventa · sin cobro</span>
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

          {/* Pedidos programados */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#8A94A6', marginBottom: '8px' }}>
              Pedidos programados · {pedidos.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pedidos.map((p, idx) => (
                <Card key={idx} padding="12px 13px">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="numeric" style={{ minWidth: '28px', fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {p.cantidad}×
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>
                      {p.nombre}
                    </div>
                    {p.fecha_compromiso && (
                      <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        entrega {p.fecha_compromiso}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Nota: reaparece en la ruta para entregar */}
          {proximaEntrega && (
            <div style={{ background: 'var(--color-primary-bg)', border: '1.5px solid var(--color-primary-line)', borderRadius: '14px', padding: '13px 15px', fontSize: '14px', fontWeight: 600, color: '#101B3D', lineHeight: 1.4 }}>
              Aparecerá en tu ruta el <strong>{proximaEntrega}</strong> para entregarlo. Al
              entregar, el pedido se convierte en venta y se cobra.
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            <PrimaryCTA loading={ctaCargando} disabled={ctaCargando} onClick={onVolverRuta}>
              {ctaCargando ? 'Guardando…' : 'Volver a la ruta'}
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>
    </>
  );
}
