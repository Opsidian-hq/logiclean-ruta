/**
 * Logiclean Ruta — RegistrosNegocioPage (Inc 3, Fase 4 — gerente)
 *
 * Registros del negocio que alimentan el corte:
 *  - La Moderna: suministro/devolución por producto base (venta-o-devolución).
 *  - Backoffice: gastos del negocio (no tocan las bolsas del vendedor).
 * Toda la escritura usa las libs offline-first existentes.
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
import { useRegistrosNegocio } from '../../hooks/useRegistrosNegocio';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { CATEGORIAS_BACKOFFICE } from '../../lib/gastos';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';

const money = (n: number) => `$${n.toFixed(2)}`;
const OTRO = '__otro__';
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

export function RegistrosNegocioPage() {
  const {
    productos,
    suministros,
    gastosBackoffice,
    nombreProducto,
    crearSuministro,
    crearGastoBackoffice,
    refresh,
  } = useRegistrosNegocio();

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [seg, setSeg] = useState<'moderna' | 'backoffice'>('moderna');
  const [toast, setToast] = useState<string | null>(null);

  // ── Estado suministro ──
  const [sProd, setSProd] = useState('');
  const [sRecibido, setSRecibido] = useState('');
  const [sDevuelto, setSDevuelto] = useState('');
  const [sFecha, setSFecha] = useState(hoy());

  const guardarSuministro = async () => {
    try {
      await crearSuministro({
        productoBaseId: sProd,
        cantidadRecibida: parseFloat(sRecibido) || 0,
        cantidadDevuelta: parseFloat(sDevuelto) || 0,
        fecha: sFecha,
      });
      setToast('Suministro registrado (en cola).');
      setSProd('');
      setSRecibido('');
      setSDevuelto('');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    }
  };

  // ── Estado backoffice ──
  const [bCat, setBCat] = useState('');
  const [bCatLibre, setBCatLibre] = useState('');
  const [bMonto, setBMonto] = useState('');
  const [bForma, setBForma] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [bFecha, setBFecha] = useState(hoy());
  const [bDesc, setBDesc] = useState('');

  const bCategoriaFinal = bCat === OTRO ? bCatLibre.trim() : bCat;
  const guardarBackoffice = async () => {
    try {
      await crearGastoBackoffice({
        categoria: bCategoriaFinal,
        monto: parseFloat(bMonto) || 0,
        forma_pago: bForma,
        fecha: bFecha,
        descripcion: bDesc || undefined,
      });
      setToast('Gasto de backoffice registrado (en cola).');
      setBCat('');
      setBCatLibre('');
      setBMonto('');
      setBDesc('');
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    }
  };

  const sumValido = !!sProd && (parseFloat(sRecibido) || 0) > 0;
  const backValido = !!bCategoriaFinal && (parseFloat(bMonto) || 0) > 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Registros del negocio</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
            <CuentaButton />
          </IonButtons>
        </IonToolbar>
        <ConnectivityStrip />
        <IonToolbar>
          {/* Segmento sobre navy: mismo patrón de contraste que Visitas (D-007). */}
          <IonSegment className="segment-on-navy" value={seg} onIonChange={(e) => setSeg((e.detail.value as 'moderna' | 'backoffice') ?? 'moderna')}>
            <IonSegmentButton value="moderna">
              <IonLabel>La Moderna</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="backoffice">
              <IonLabel>Backoffice</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ── Segmento La Moderna ── */}
          {seg === 'moderna' && (
            <>
              <div>
                <span style={sectionLabel}>Suministro / devolución</span>
                <Card padding="4px 14px">
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Producto base *</IonLabel>
                    <IonSelect value={sProd} placeholder="Selecciona un producto" onIonChange={(e) => setSProd(e.detail.value)}>
                      {productos.map((p) => (
                        <IonSelectOption key={p.id} value={p.id}>
                          {p.nombre}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Recibido (unidad de compra) *</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={sRecibido} placeholder="0" onIonInput={(e) => setSRecibido(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Devuelto</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={sDevuelto} placeholder="0" onIonInput={(e) => setSDevuelto(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Fecha</IonLabel>
                    <IonInput type="date" value={sFecha} onIonInput={(e) => setSFecha(e.detail.value ?? '')} />
                  </IonItem>
                  <div style={{ padding: '12px 0' }}>
                    <PrimaryCTA disabled={!sumValido} onClick={guardarSuministro}>
                      Registrar suministro
                    </PrimaryCTA>
                  </div>
                </Card>
              </div>

              <div>
                <span style={sectionLabel}>Suministros recientes</span>
                {suministros.length === 0 && (
                  <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Aún no hay suministros registrados.</p></IonText>
                )}
                {suministros.map((s) => (
                  <div key={s.id} style={lineRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-navy)' }}>{nombreProducto(s.producto_base_id)}</div>
                      <div className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}>
                        {s.fecha} · recibido {s.cantidad_recibida} · devuelto {s.cantidad_devuelta}
                      </div>
                    </div>
                    <Chip tone="primarySoft">neto {s.cantidad_recibida - s.cantidad_devuelta}</Chip>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Segmento Backoffice ── */}
          {seg === 'backoffice' && (
            <>
              <div>
                <span style={sectionLabel}>Gasto de backoffice</span>
                <Card padding="4px 14px">
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Categoría *</IonLabel>
                    <IonSelect value={bCat} placeholder="Selecciona una categoría" onIonChange={(e) => setBCat(e.detail.value)}>
                      {CATEGORIAS_BACKOFFICE.map((c) => (
                        <IonSelectOption key={c} value={c}>{c}</IonSelectOption>
                      ))}
                      <IonSelectOption value={OTRO}>Otro…</IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  {bCat === OTRO && (
                    <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                      <IonLabel position="stacked">Especifica la categoría *</IonLabel>
                      <IonInput value={bCatLibre} placeholder="Ej. Mantenimiento" onIonInput={(e) => setBCatLibre(e.detail.value ?? '')} />
                    </IonItem>
                  )}
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Monto *</IonLabel>
                    <IonInput type="number" inputmode="decimal" value={bMonto} placeholder="0.00" onIonInput={(e) => setBMonto(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonSegment value={bForma} onIonChange={(e) => setBForma((e.detail.value as 'efectivo' | 'transferencia') ?? 'efectivo')}>
                      <IonSegmentButton value="efectivo"><IonLabel>Efectivo</IonLabel></IonSegmentButton>
                      <IonSegmentButton value="transferencia"><IonLabel>Transferencia</IonLabel></IonSegmentButton>
                    </IonSegment>
                  </IonItem>
                  <IonItem lines="full" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Fecha</IonLabel>
                    <IonInput type="date" value={bFecha} onIonInput={(e) => setBFecha(e.detail.value ?? '')} />
                  </IonItem>
                  <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                    <IonLabel position="stacked">Descripción (opcional)</IonLabel>
                    <IonInput value={bDesc} placeholder="Detalle del gasto" onIonInput={(e) => setBDesc(e.detail.value ?? '')} />
                  </IonItem>
                  <div style={{ padding: '12px 0' }}>
                    <PrimaryCTA disabled={!backValido} onClick={guardarBackoffice}>
                      Registrar gasto
                    </PrimaryCTA>
                  </div>
                </Card>
              </div>

              <div>
                <span style={sectionLabel}>Backoffice reciente</span>
                {gastosBackoffice.length === 0 && (
                  <IonText color="medium"><p style={{ fontSize: 'var(--font-size-sm)' }}>Aún no hay gastos de backoffice.</p></IonText>
                )}
                {gastosBackoffice.map((g) => (
                  <div key={g.id} style={lineRow}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--color-navy)' }}>{g.categoria}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <Chip tone={g.forma_pago === 'efectivo' ? 'primarySoft' : 'neutral'}>
                          {g.forma_pago === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </Chip>
                        <span className="numeric" style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>{g.fecha}</span>
                      </div>
                    </div>
                    <span className="numeric" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-navy)' }}>{money(g.monto)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </IonContent>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
