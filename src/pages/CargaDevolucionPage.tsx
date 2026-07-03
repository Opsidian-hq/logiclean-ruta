/**
 * Logiclean Ruta — CargaDevolucionPage (Inc 6.4, H-18/H-19)
 *
 * Carga: bodega → vehículo (H-18). Devolución: vehículo → bodega (H-19).
 * Compartida entre gerente y vendedor (mismo patrón que ClienteDetallePage):
 *  - Gerente: selecciona el vendedor cuyo vehículo carga/recibe devolución.
 *  - Vendedor: solo su propio vehículo, sin selector (RLS ya lo exige así).
 * No reemplaza el ajuste manual existente de InventarioPage (decisión de PM,
 * 2026-07-03: ese flujo se deja intacto por ahora); esta pantalla es la nueva
 * fuente real, aditiva.
 *
 * Rutas: /admin/carga-devolucion (gerente) y /inventario/carga-devolucion (vendedor).
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
import { useCargaDevolucion } from '../hooks/useCargaDevolucion';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useAuthContext } from '../context/AuthContext';
import { SyncStatusBadge } from '../components/SyncStatusBadge';
import { CuentaButton } from '../components/CuentaButton';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { PrimaryCTA } from '../components/ui/PrimaryCTA';

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

export function CargaDevolucionPage() {
  const { user, rol } = useAuthContext();
  const esGerente = rol === 'gerente';
  const backUrl = esGerente ? '/admin/negocio' : '/inventario';

  const {
    vendedores,
    presentaciones,
    nombrePresentacion,
    disponibleBodega,
    disponibleVehiculo,
    cargasRecientes,
    devolucionesRecientes,
    lineasCargaDe,
    lineasDevolucionDe,
    loading,
    crearCarga,
    crearDevolucion,
    refresh,
  } = useCargaDevolucion(user?.id ?? null);

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [seg, setSeg] = useState<'carga' | 'devolucion'>('carga');
  const [toast, setToast] = useState<string | null>(null);
  const [vendedorId, setVendedorId] = useState(esGerente ? '' : user?.id ?? '');
  const [fecha, setFecha] = useState(hoy());
  const [lineas, setLineas] = useState<LineaForm[]>([nuevaLinea()]);

  const actualizarLinea = (key: string, cambios: Partial<LineaForm>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...cambios } : l)));
  };
  const agregarLinea = () => setLineas((prev) => [...prev, nuevaLinea()]);
  const quitarLinea = (key: string) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  const lineasValidas = lineas.filter((l) => l.presentacionId && (parseFloat(l.cantidad) || 0) > 0);
  const excedeBodega =
    seg === 'carga' &&
    lineasValidas.some((l) => (parseFloat(l.cantidad) || 0) > disponibleBodega(l.presentacionId));
  const formularioValido = !!vendedorId && lineasValidas.length > 0 && !excedeBodega;

  const limpiarFormulario = () => {
    setLineas([nuevaLinea()]);
    if (esGerente) setVendedorId('');
  };

  const guardar = async () => {
    try {
      const lineasPayload = lineasValidas.map((l) => ({
        presentacionId: l.presentacionId,
        cantidad: parseFloat(l.cantidad) || 0,
      }));
      if (seg === 'carga') {
        await crearCarga(vendedorId, lineasPayload, fecha);
        setToast('Carga registrada (en cola).');
      } else {
        await crearDevolucion(vendedorId, lineasPayload, fecha);
        setToast('Devolución registrada (en cola).');
      }
      limpiarFormulario();
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    }
  };

  const recientes = seg === 'carga' ? cargasRecientes : devolucionesRecientes;
  const recientesDelVendedor = vendedorId
    ? recientes.filter((r) => r.vendedor_id === vendedorId)
    : [];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonButtons slot="start">
            <IonBackButton defaultHref={backUrl} style={{ '--color': 'var(--color-on-dark)' }} />
          </IonButtons>
          <IonTitle>Carga y devolución</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSegment className="segment-on-navy" value={seg} onIonChange={(e) => setSeg((e.detail.value as 'carga' | 'devolucion') ?? 'carga')}>
            <IonSegmentButton value="carga"><IonLabel>Carga</IonLabel></IonSegmentButton>
            <IonSegmentButton value="devolucion"><IonLabel>Devolución</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <span style={sectionLabel}>{seg === 'carga' ? 'Nueva carga desde bodega' : 'Nueva devolución a bodega'}</span>
            <Card padding="4px 14px">
              {esGerente && (
                <IonItem lines="full" style={itemStyle}>
                  <IonLabel position="stacked">Vendedor *</IonLabel>
                  <IonSelect value={vendedorId} placeholder="Selecciona un vendedor" onIonChange={(e) => setVendedorId(e.detail.value)}>
                    {vendedores.map((v) => (
                      <IonSelectOption key={v.id} value={v.id}>{v.nombre}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}
              <IonItem lines="none" style={itemStyle}>
                <IonLabel position="stacked">Fecha</IonLabel>
                <IonInput type="date" value={fecha} onIonInput={(e) => setFecha(e.detail.value ?? '')} />
              </IonItem>
            </Card>
          </div>

          <div>
            <span style={sectionLabel}>Presentaciones</span>
            <Card padding="4px 14px">
              {lineas.map((l, i) => {
                const cantidadNum = parseFloat(l.cantidad) || 0;
                const disponible = seg === 'carga'
                  ? disponibleBodega(l.presentacionId)
                  : (vendedorId ? disponibleVehiculo(vendedorId, l.presentacionId) : 0);
                const excede = seg === 'carga' && l.presentacionId && cantidadNum > disponible;
                return (
                  <div key={l.key} style={{ padding: '10px 0', borderBottom: i < lineas.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                      <IonItem lines="none" style={{ ...itemStyle, flex: 2 }}>
                        <IonLabel position="stacked">Presentación</IonLabel>
                        <IonSelect
                          value={l.presentacionId}
                          placeholder="Selecciona"
                          onIonChange={(e) => actualizarLinea(l.key, { presentacionId: e.detail.value })}
                        >
                          {presentaciones.map((p) => (
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
                    {l.presentacionId && (
                      <IonText color={excede ? 'danger' : 'medium'}>
                        <p style={{ fontSize: 'var(--font-size-xs)', margin: '2px 0 0' }}>
                          {seg === 'carga' ? `Disponible en bodega: ${disponible}` : `En el vehículo: ${disponible}`}
                          {excede ? ' — no hay suficiente en bodega' : ''}
                        </p>
                      </IonText>
                    )}
                  </div>
                );
              })}
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

          <PrimaryCTA disabled={!formularioValido} onClick={guardar}>
            {seg === 'carga' ? 'Registrar carga' : 'Registrar devolución'}
          </PrimaryCTA>

          <div>
            <span style={sectionLabel}>{seg === 'carga' ? 'Cargas recientes' : 'Devoluciones recientes'}</span>
            {!loading && vendedorId && recientesDelVendedor.length === 0 && (
              <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Aún no hay registros para este vendedor.</p></IonText>
            )}
            {!vendedorId && (
              <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Selecciona un vendedor para ver su historial.</p></IonText>
            )}
            {recientesDelVendedor.map((r) => {
              const lineasDeR = seg === 'carga' ? lineasCargaDe(r.id) : lineasDevolucionDe(r.id);
              const resumen = lineasDeR
                .map((l) => `${l.cantidad} × ${nombrePresentacion(l.presentacion_id)}`)
                .join(' · ');
              return (
                <div key={r.id} style={lineRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="numeric" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-navy)' }}>{r.fecha}</div>
                    {resumen && (
                      <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{resumen}</div>
                    )}
                  </div>
                  <Chip tone="primarySoft">{lineasDeR.length} línea{lineasDeR.length === 1 ? '' : 's'}</Chip>
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
