/**
 * Logiclean Ruta — RecepcionModernaPage (Inc 6.2 H-16, Inc 6.5 M-1 —
 * extraída de RegistrosNegocioPage en el refactor de Inventario de bodega;
 * rehecha como carrito multi-producto para levantar varias líneas antes de
 * guardar, igual que el paso "Levantar pedido (preventa)" de VentaPage)
 *
 * Recepción de La Moderna hacia bodega (H-16) y devolución semanal de
 * bidones sellados sin abrir (M-1/ADR-0010). Desde ADR-0006 esta es la
 * fuente única del suministro — `suministro_la_moderna` se materializa por
 * trigger a partir de este evento (ver `lib/movimientoLaModerna.ts`). El
 * historial de recepciones/devoluciones recientes vive ahora en el Inicio
 * del gerente, acotado al periodo desde el último corte.
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
  IonButton,
  IonBackButton,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonItem,
  IonInput,
  IonText,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  IonFooter,
  IonModal,
  IonSearchbar,
  IonList,
  IonIcon,
} from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useRecepcionModerna } from '../../hooks/useRecepcionModerna';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useAuthContext } from '../../context/AuthContext';
import { generateUUID } from '../../lib/uuid';
import { presentacionesAUnidadCompra } from '../../lib/conversion';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { CuentaButton } from '../../components/CuentaButton';
import { StepperCantidad } from '../../components/StepperCantidad';
import { Card } from '../../components/ui/Card';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';

const hoy = () => new Date().toISOString().slice(0, 10);

/** "0.5 docena" / "1 docena" / "6 docenas" — sin ceros decimales de sobra. */
const docenasTexto = (docenas: number) => {
  const redondeado = Math.round(docenas * 100) / 100;
  return `${redondeado} docena${redondeado === 1 ? '' : 's'}`;
};

const sectionLabel: CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
  marginBottom: '8px',
};

interface ItemCarrito {
  id: string;
  productoBaseId: string;
  cantidad: number;
}

export function RecepcionModernaPage() {
  const { user } = useAuthContext();
  const {
    productos,
    factorPiezaPorProducto,
    nombreProducto,
    crearRecepcion,
    crearDevolucionLaModerna,
    refresh,
  } = useRecepcionModerna(user?.id ?? null);

  const { handleRefresh } = usePullToRefresh(
    useCallback(async () => { await refresh(); }, [refresh])
  );

  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tipoMovimiento, setTipoMovimiento] = useState<'recibido' | 'devuelto'>('recibido');
  const [fecha, setFecha] = useState(hoy());
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);

  // Borrador del producto que se está por agregar al carrito.
  const [draftProd, setDraftProd] = useState('');
  const [draftCant, setDraftCant] = useState(1);
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodBuscador, setProdBuscador] = useState('');

  const productosFiltrados = useMemo(
    () => productos.filter((p) => p.nombre.toLowerCase().includes(prodBuscador.toLowerCase())),
    [productos, prodBuscador]
  );

  // Productos unidad_compra='docena' (escobas/trapeadores/recogedores) se
  // capturan en piezas — lo que el gerente cuenta físicamente — y se
  // convierten a docenas (unidad de compra con La Moderna) antes de guardar.
  const draftProducto = productos.find((p) => p.id === draftProd);
  const draftFactorPieza =
    draftProducto?.unidad_compra === 'docena' ? factorPiezaPorProducto.get(draftProd) : undefined;
  const draftDocenas = draftFactorPieza ? presentacionesAUnidadCompra(draftCant, draftFactorPieza) : undefined;

  const draftCompleto = !!draftProd && draftCant > 0;

  const cambiarTipoMovimiento = (nuevo: 'recibido' | 'devuelto') => {
    if (nuevo === tipoMovimiento) return;
    setTipoMovimiento(nuevo);
    setCarrito([]);
  };

  const agregarACarrito = () => {
    if (!draftCompleto) return;
    setCarrito((prev) => [...prev, { id: generateUUID(), productoBaseId: draftProd, cantidad: draftCant }]);
    setDraftProd('');
    setDraftCant(1);
  };

  const quitarDeCarrito = (id: string) =>
    setCarrito((prev) => prev.filter((it) => it.id !== id));

  const registrarLote = async () => {
    if (carrito.length === 0) return;
    setSubmitting(true);
    try {
      let huboBidon = false;
      for (const item of carrito) {
        const producto = productos.find((p) => p.id === item.productoBaseId);
        const factorPieza = producto?.unidad_compra === 'docena' ? factorPiezaPorProducto.get(item.productoBaseId) : undefined;
        // item.cantidad viene en piezas para productos por docena; La Moderna
        // se factura en docenas, así que se convierte antes de guardar.
        const cantidad = factorPieza ? presentacionesAUnidadCompra(item.cantidad, factorPieza) : item.cantidad;
        const input = { productoBaseId: item.productoBaseId, cantidad, fecha };
        if (tipoMovimiento === 'recibido') {
          await crearRecepcion(input);
          if (producto?.unidad_compra === 'bidon') huboBidon = true;
        } else {
          await crearDevolucionLaModerna(input);
        }
      }
      const n = carrito.length;
      const base =
        tipoMovimiento === 'recibido'
          ? `Recepción registrada (${n} producto${n !== 1 ? 's' : ''}, en cola).`
          : `Devolución registrada (${n} producto${n !== 1 ? 's' : ''}, en cola).`;
      setToast(
        tipoMovimiento === 'recibido' && huboBidon
          ? `${base} Registra en Envasado los bidones para que aparezcan como presentación vendible.`
          : base
      );
      setCarrito([]);
      setFecha(hoy());
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo registrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const carritoValido = carrito.length > 0 && !submitting;

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
          {/* ── Tipo de movimiento (aplica a todo el lote, primero) ── */}
          <div>
            <Card padding="4px 14px">
              <div style={{ padding: '10px 14px 0' }}>
                <IonSegment
                  value={tipoMovimiento}
                  onIonChange={(e) => cambiarTipoMovimiento((e.detail.value as 'recibido' | 'devuelto') ?? 'recibido')}
                >
                  <IonSegmentButton value="recibido"><IonLabel>Recepción</IonLabel></IonSegmentButton>
                  <IonSegmentButton value="devuelto"><IonLabel>Devolución</IonLabel></IonSegmentButton>
                </IonSegment>
              </div>
              {tipoMovimiento === 'devuelto' && (
                <div style={{ padding: '8px 14px 12px' }}>
                  <IonText color="medium">
                    <p style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
                      Bidones sellados sin abrir que regresan a La Moderna al cierre de semana (M-1).
                    </p>
                  </IonText>
                </div>
              )}
            </Card>
          </div>

          {/* ── Fecha ── */}
          <div>
            <span style={sectionLabel}>Fecha</span>
            <Card padding="4px 14px">
              <IonItem lines="none" style={{ '--background': 'transparent', '--padding-start': '0' }}>
                <IonLabel position="stacked">Fecha de recepción/devolución</IonLabel>
                <IonInput type="date" value={fecha} onIonInput={(e) => setFecha(e.detail.value ?? '')} />
              </IonItem>
            </Card>
          </div>

          {/* ── Carrito de productos agregados ── */}
          {carrito.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {carrito.map((it) => {
                const esDocenaItem =
                  productos.find((p) => p.id === it.productoBaseId)?.unidad_compra === 'docena' &&
                  factorPiezaPorProducto.has(it.productoBaseId);
                return (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      border: '1.5px solid var(--color-primary-line)',
                      background: 'var(--color-primary-bg)',
                      borderRadius: 'var(--radius-card)',
                      padding: '12px 13px',
                    }}
                  >
                    <span className="numeric" style={{ minWidth: '46px', fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {it.cantidad}{esDocenaItem ? ' pza' : '×'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>
                      {nombreProducto(it.productoBaseId)}
                    </div>
                    <IonButton fill="clear" color="danger" size="small" onClick={() => quitarDeCarrito(it.id)} aria-label="Quitar producto">
                      <IonIcon icon={trashOutline} slot="icon-only" />
                    </IonButton>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Agregar producto ── */}
          <div>
            <span style={sectionLabel}>Agregar producto</span>
            <Card padding="0">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setProdModalOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setProdModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '11px 14px',
                  borderBottom: '1px solid var(--color-divider)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...sectionLabel, marginBottom: '4px' }}>Producto base</div>
                  {draftProd ? (
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-body)' }}>
                      {nombreProducto(draftProd)}
                    </div>
                  ) : (
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-disabled)' }}>
                      Selecciona un producto
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '20px', color: 'var(--color-disabled)', marginLeft: '8px' }}>›</span>
              </div>

              <div style={{ padding: '11px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-body)' }}>
                    Cantidad {tipoMovimiento === 'recibido' ? 'recibida' : 'devuelta'}
                    {draftFactorPieza ? ' (piezas)' : ''}
                  </span>
                  <StepperCantidad value={draftCant} min={1} onChange={setDraftCant} />
                </div>
                {draftDocenas !== undefined && (
                  <IonText color="medium">
                    <p style={{ fontSize: 'var(--font-size-xs)', margin: '6px 0 0', textAlign: 'right' }}>
                      = {docenasTexto(draftDocenas)} con La Moderna
                    </p>
                  </IonText>
                )}
              </div>
            </Card>

            <div style={{ marginTop: '12px' }}>
              <PrimaryCTA disabled={!draftCompleto} onClick={agregarACarrito}>
                <IonIcon icon={addOutline} style={{ marginRight: '6px' }} />
                Agregar producto
              </PrimaryCTA>
            </div>
          </div>
        </div>
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  fontVariantNumeric: 'var(--numeric)',
                }}
              >
                {carrito.length} producto{carrito.length !== 1 ? 's' : ''}
              </span>
            </div>
            <PrimaryCTA disabled={!carritoValido} loading={submitting} onClick={registrarLote}>
              {tipoMovimiento === 'recibido' ? 'Registrar recepción' : 'Registrar devolución'}
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>

      {/* Modal: buscador de producto para el carrito */}
      <IonModal
        isOpen={prodModalOpen}
        onDidDismiss={() => {
          setProdModalOpen(false);
          setProdBuscador('');
        }}
        breakpoints={[0, 0.9]}
        initialBreakpoint={0.9}
      >
        <IonHeader>
          <IonToolbar>
            <IonTitle>Seleccionar producto</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setProdModalOpen(false)}>Cancelar</IonButton>
            </IonButtons>
          </IonToolbar>
          <IonToolbar>
            <IonSearchbar
              value={prodBuscador}
              onIonInput={(e) => setProdBuscador(e.detail.value ?? '')}
              placeholder="Buscar producto..."
              style={{ '--background': 'var(--color-surface)' }}
              debounce={0}
            />
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList>
            {productosFiltrados.length === 0 && (
              <IonItem>
                <IonLabel style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  Sin resultados
                </IonLabel>
              </IonItem>
            )}
            {productosFiltrados.map((p) => (
              <IonItem
                key={p.id}
                button
                detail={false}
                onClick={() => {
                  setDraftProd(p.id);
                  setProdModalOpen(false);
                  setProdBuscador('');
                }}
                style={draftProd === p.id ? { '--background': 'var(--color-primary-bg)' } : undefined}
              >
                <IonLabel>{p.nombre}</IonLabel>
                {draftProd === p.id && (
                  <span slot="end" style={{ color: 'var(--color-primary)', fontWeight: 800, fontSize: '18px' }}>✓</span>
                )}
              </IonItem>
            ))}
          </IonList>
        </IonContent>
      </IonModal>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={3500} onDidDismiss={() => setToast(null)} color="dark" />
    </IonPage>
  );
}
