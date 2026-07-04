/**
 * Logiclean Ruta — EnvasadoPage (Inc 6.3, H-17 — gerente)
 *
 * Registra el envasado de un bidón de 20 L (origen=bidon_nuevo) o de granel ya
 * abierto (origen=granel): qué presentaciones salieron y el residuo/consumo
 * estimado. Los contadores de bodega se materializan del lado servidor
 * (migración 007) — esta pantalla solo registra el evento.
 *
 * No es un tab del gerente; se llega desde el FAB de "Inventario" (bodega).
 * Ruta: /admin/envasado
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
  IonIcon,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';
import { useEnvasado } from '../../hooks/useEnvasado';
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

const itemStyle = { '--background': 'transparent', '--padding-start': '0' } as CSSProperties;

interface LineaForm {
  key: string;
  presentacionId: string;
  cantidad: string;
}

const nuevaLinea = (): LineaForm => ({
  key: crypto.randomUUID(),
  presentacionId: '',
  cantidad: '',
});

export function EnvasadoPage() {
  const { user } = useAuthContext();
  const {
    productos,
    envasadosRecientes,
    nombreProducto,
    nombrePresentacion,
    bodegaDe,
    presentacionesDe,
    lineasDe,
    loading,
    crearEnvasado,
    refresh,
  } = useEnvasado(user?.id ?? null);

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [toast, setToast] = useState<string | null>(null);

  const [productoId, setProductoId] = useState('');
  const [origen, setOrigen] = useState<'bidon_nuevo' | 'granel'>('bidon_nuevo');
  const [bidonesAbiertos, setBidonesAbiertos] = useState('1');
  const [residuo, setResiduo] = useState('');
  const [consumoGranel, setConsumoGranel] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [lineas, setLineas] = useState<LineaForm[]>([nuevaLinea()]);

  const bodegaActual = productoId ? bodegaDe(productoId) : undefined;
  const presentacionesDisponibles = productoId ? presentacionesDe(productoId) : [];

  const actualizarLinea = (key: string, cambios: Partial<LineaForm>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  };
  const agregarLinea = () => setLineas((prev) => [...prev, nuevaLinea()]);
  const quitarLinea = (key: string) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const lineasValidas = lineas.filter((l) => l.presentacionId && (parseFloat(l.cantidad) || 0) > 0);
  const campoOrigenValido =
    origen === 'bidon_nuevo'
      ? residuo !== '' && (parseFloat(residuo) || 0) >= 0 && (parseInt(bidonesAbiertos, 10) || 0) >= 1
      : (parseFloat(consumoGranel) || 0) > 0;
  const envasadoValido = !!productoId && campoOrigenValido && lineasValidas.length > 0;

  const guardarEnvasado = async () => {
    try {
      await crearEnvasado({
        productoBaseId: productoId,
        origen,
        bidonesAbiertos: origen === 'bidon_nuevo' ? parseInt(bidonesAbiertos, 10) || 1 : undefined,
        litrosResiduoEstimado: origen === 'bidon_nuevo' ? parseFloat(residuo) || 0 : undefined,
        litrosConsumidosGranel: origen === 'granel' ? parseFloat(consumoGranel) || 0 : undefined,
        fecha,
        lineas: lineasValidas.map((l) => ({
          presentacionId: l.presentacionId,
          cantidad: parseFloat(l.cantidad) || 0,
        })),
      });
      setToast('Envasado registrado (en cola).');
      setProductoId('');
      setBidonesAbiertos('1');
      setResiduo('');
      setConsumoGranel('');
      setLineas([nuevaLinea()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/admin/inventario" style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>Envasado</IonTitle>
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
            <span style={sectionLabel}>Nuevo envasado</span>
            <Card padding="4px 14px">
              <IonItem lines="full" style={itemStyle}>
                <IonLabel position="stacked">Producto base (bidón) *</IonLabel>
                <IonSelect value={productoId} placeholder="Selecciona un producto" onIonChange={(e) => setProductoId(e.detail.value)}>
                  {productos.map((p) => (
                    <IonSelectOption key={p.id} value={p.id}>{p.nombre}</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              {productoId && (
                <div style={{ padding: '8px 0 4px' }}>
                  <IonText color="medium">
                    <p style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
                      En bodega ahora mismo: {bodegaActual?.bidones_disponibles ?? 0} bidones disponibles ·{' '}
                      {bodegaActual?.litros_granel_estimado ?? 0} L a granel
                    </p>
                  </IonText>
                </div>
              )}

              <IonItem lines="full" style={itemStyle}>
                <IonLabel position="stacked">Origen *</IonLabel>
              </IonItem>
              <IonSegment value={origen} onIonChange={(e) => setOrigen((e.detail.value as 'bidon_nuevo' | 'granel') ?? 'bidon_nuevo')}>
                <IonSegmentButton value="bidon_nuevo"><IonLabel>Bidón nuevo</IonLabel></IonSegmentButton>
                <IonSegmentButton value="granel"><IonLabel>Granel ya abierto</IonLabel></IonSegmentButton>
              </IonSegment>

              {origen === 'bidon_nuevo' ? (
                <>
                  <IonItem lines="full" style={itemStyle}>
                    <IonLabel position="stacked">¿Cuántos bidones nuevos se abrieron? *</IonLabel>
                    <IonInput type="number" inputmode="numeric" min={1} value={bidonesAbiertos} placeholder="1" onIonInput={(e) => setBidonesAbiertos(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="full" style={itemStyle}>
                    <IonLabel position="stacked">Residuo estimado al terminar (L) *</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={residuo} placeholder="0" onIonInput={(e) => setResiduo(e.detail.value ?? '')} />
                  </IonItem>
                </>
              ) : (
                <IonItem lines="full" style={itemStyle}>
                  <IonLabel position="stacked">Litros consumidos del granel *</IonLabel>
                  <IonInput type="number" inputmode="decimal" value={consumoGranel} placeholder="0" onIonInput={(e) => setConsumoGranel(e.detail.value ?? '')} />
                </IonItem>
              )}

              <IonItem lines="none" style={itemStyle}>
                <IonLabel position="stacked">Fecha</IonLabel>
                <IonInput type="date" value={fecha} onIonInput={(e) => setFecha(e.detail.value ?? '')} />
              </IonItem>
            </Card>
          </div>

          <div>
            <span style={sectionLabel}>Presentaciones que salieron</span>
            <Card padding="4px 14px">
              {lineas.map((l, i) => (
                <div key={l.key} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 0', borderBottom: i < lineas.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <IonItem lines="none" style={{ ...itemStyle, flex: 2 }}>
                    <IonLabel position="stacked">Presentación</IonLabel>
                    <IonSelect
                      value={l.presentacionId}
                      placeholder={productoId ? 'Selecciona' : 'Elige un producto primero'}
                      disabled={!productoId}
                      onIonChange={(e) => actualizarLinea(l.key, { presentacionId: e.detail.value })}
                    >
                      {presentacionesDisponibles.map((p) => (
                        <IonSelectOption key={p.id} value={p.id}>{p.nombre}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" style={{ ...itemStyle, flex: 1 }}>
                    <IonLabel position="stacked">Cantidad</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={l.cantidad} placeholder="0" onIonInput={(e) => actualizarLinea(l.key, { cantidad: e.detail.value ?? '' })} />
                  </IonItem>
                  <IonIcon
                    icon={trashOutline}
                    style={{ fontSize: '20px', color: 'var(--color-text-secondary)', padding: '10px 4px', cursor: 'pointer' }}
                    onClick={() => quitarLinea(l.key)}
                  />
                </div>
              ))}
              <div style={{ padding: '10px 0' }}>
                <button
                  onClick={agregarLinea}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'none', border: 'none', padding: 0,
                    color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <IonIcon icon={addOutline} /> Agregar línea
                </button>
              </div>
            </Card>
          </div>

          <PrimaryCTA disabled={!envasadoValido} onClick={guardarEnvasado}>
            Registrar envasado
          </PrimaryCTA>

          <div>
            <span style={sectionLabel}>Envasados recientes</span>
            {!loading && envasadosRecientes.length === 0 && (
              <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Aún no hay envasados registrados.</p></IonText>
            )}
            {envasadosRecientes.map((e) => {
              const resumenLineas = lineasDe(e.id)
                .map((l) => `${l.cantidad} × ${nombrePresentacion(l.presentacion_id)}`)
                .join(' · ');
              return (
                <div key={e.id} style={lineRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-navy)' }}>{nombreProducto(e.producto_base_id)}</div>
                    <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
                      {e.fecha} ·{' '}
                      {e.origen === 'bidon_nuevo'
                        ? `${e.bidones_abiertos > 1 ? `${e.bidones_abiertos} bidones abiertos · ` : ''}residuo ${e.litros_residuo_estimado} L`
                        : `granel ${e.litros_consumidos_granel} L`}
                    </div>
                    {resumenLineas && (
                      <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{resumenLineas}</div>
                    )}
                  </div>
                  <Chip tone={e.origen === 'bidon_nuevo' ? 'primarySoft' : 'neutral'}>
                    {e.origen === 'bidon_nuevo' ? 'Bidón nuevo' : 'Granel'}
                  </Chip>
                </div>
              );
            })}
          </div>
        </div>
      </IonContent>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
