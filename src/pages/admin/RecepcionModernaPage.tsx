/**
 * Logiclean Ruta — RecepcionModernaPage (Inc 6.2 H-16, Inc 6.5 M-1 —
 * extraída de RegistrosNegocioPage en el refactor de Inventario de bodega)
 *
 * Recepción de La Moderna hacia bodega (H-16) y devolución semanal de
 * bidones sellados sin abrir (M-1/ADR-0010). Desde ADR-0006 esta es la
 * fuente única del suministro — `suministro_la_moderna` se materializa por
 * trigger a partir de este evento (ver `lib/movimientoLaModerna.ts`).
 *
 * Se llega desde el FAB de Inventario. Ruta: /admin/recepcion-moderna
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToast,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useRecepcionModerna } from '../../hooks/useRecepcionModerna';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useAuthContext } from '../../context/AuthContext';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';

const hoy = () => new Date().toISOString().slice(0, 10);

const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
};

const lineRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '11px',
  padding: '11px 0',
  borderBottom: '1px solid var(--color-divider)',
};

export function RecepcionModernaPage() {
  const { user } = useAuthContext();
  const {
    productos,
    recepciones,
    devolucionesLaModerna,
    nombreProducto,
    crearRecepcion,
    crearDevolucionLaModerna,
    refresh,
  } = useRecepcionModerna(user?.id ?? null);

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [toast, setToast] = useState<string | null>(null);

  const [tipoMovimiento, setTipoMovimiento] = useState<'recibido' | 'devuelto'>('recibido');
  const [rProd, setRProd] = useState('');
  const [rCantidad, setRCantidad] = useState('');
  const [rFecha, setRFecha] = useState(hoy());

  const guardarMovimiento = async () => {
    try {
      const input = {
        productoBaseId: rProd,
        cantidad: parseFloat(rCantidad) || 0,
        fecha: rFecha,
      };
      if (tipoMovimiento === 'recibido') {
        await crearRecepcion(input);
        const producto = productos.find((p) => p.id === rProd);
        setToast(
          producto?.unidad_compra === 'bidon'
            ? 'Recepción registrada (en cola). Regístrala en Envasado para que aparezca como presentación vendible.'
            : 'Recepción registrada (en cola).'
        );
      } else {
        await crearDevolucionLaModerna(input);
        setToast('Devolución registrada (en cola).');
      }
      setRProd('');
      setRCantidad('');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    }
  };

  const movimientoValido = !!rProd && (parseFloat(rCantidad) || 0) > 0;
  const listaRecientes = tipoMovimiento === 'recibido' ? recepciones : devolucionesLaModerna;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin/inventario" style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>Recepción La Moderna</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <span style={sectionLabel}>Recepción de La Moderna</span>
            <Card padding="4px 14px">
              <div style={{ padding: '10px 14px 0' }}>
                <IonSegment
                  value={tipoMovimiento}
                  onIonChange={(e) => setTipoMovimiento((e.detail.value as 'recibido' | 'devuelto') ?? 'recibido')}
                >
                  <IonSegmentButton value="recibido"><IonLabel>Recibido</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="devuelto"><IonLabel>Devuelto</IonLabel></IonSegmentButton>
                </IonSegment>
              </div>
              {tipoMovimiento === 'devuelto' && (
                <div style={{ padding: '8px 14px 0' }}>
                  <IonText color="medium">
                    <p style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
                      Bidones sellados sin abrir que regresan a La Moderna al cierre de semana (M-1).
                    </p>
                  </IonText>
                </div>
              )}
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Producto base *</IonLabel>
                <IonSelect value={rProd} placeholder="Selecciona un producto" onIonChange={(e) => setRProd(e.detail.value)}>
                  {productos.map((p) => (
                    <IonSelectOption key={p.id} value={p.id}>
                      {p.nombre}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">
                  Cantidad {tipoMovimiento === 'recibido' ? 'recibida' : 'devuelta'} (unidad de compra) *
                </IonLabel>
                <IonInput type="number" inputmode="decimal" value={rCantidad} placeholder="0" onIonInput={(e) => setRCantidad(e.detail.value ?? '')} />
              </IonItem>
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Fecha</IonLabel>
                <IonInput type="date" value={rFecha} onIonInput={(e) => setRFecha(e.detail.value ?? '')} />
              </IonItem>
              <div style={{ padding: '12px 0' }}>
                <PrimaryCTA disabled={!movimientoValido} onClick={guardarMovimiento}>
                  {tipoMovimiento === 'recibido' ? 'Registrar recepción' : 'Registrar devolución'}
                </PrimaryCTA>
              </div>
            </Card>
          </div>

          <div>
            <span style={sectionLabel}>{tipoMovimiento === 'recibido' ? 'Recepciones recientes' : 'Devoluciones recientes'}</span>
            {listaRecientes.length === 0 && (
              <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Aún no hay {tipoMovimiento === 'recibido' ? 'recepciones' : 'devoluciones'} registradas.</p></IonText>
            )}
            {listaRecientes.map((m) => (
              <div key={m.id} style={lineRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-navy)' }}>{nombreProducto(m.producto_base_id)}</div>
                  <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
                    {m.fecha}
                  </div>
                </div>
                <Chip tone="primarySoft">{tipoMovimiento === 'recibido' ? 'recibido' : 'devuelto'} {m.cantidad}</Chip>
              </div>
            ))}
          </div>
        </div>
      </IonContent>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3500} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
