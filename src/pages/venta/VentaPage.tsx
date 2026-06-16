/**
 * Logiclean Ruta — VentaPage (vendedor) · Flujo A: registro de venta offline
 *
 * Implementa H-04 (venta con lista de precios correcta + descuento de
 * inventario), H-05 (pedido pendiente dentro del mismo flujo) y H-07 (cobro
 * con forma de pago y saldo). Todo se guarda local al instante y entra a la
 * cola de sync; nunca se bloquea esperando al servidor.
 * Ruta: /venta
 */

import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonText,
  IonInput,
  IonSegment,
  IonSegmentButton,
  IonToggle,
  IonIcon,
  IonSpinner,
  IonToast,
  IonFooter,
} from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { useInventario } from '../../hooks/useInventario';
import { useClientes } from '../../hooks/useClientes';
import { useVenta } from '../../hooks/useVenta';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { precioUnitario, importeLinea, totalVenta } from '../../lib/precios';
import type { PedidoInput } from '../../lib/ventas';

const money = (n: number) => `$${n.toFixed(2)}`;

// Etiqueta de sección en mayúsculas (prototipo).
const sectionLabel: CSSProperties = {
  fontSize: 'var(--font-size-xs)',
  fontWeight: 800,
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  color: 'var(--color-text-secondary)',
};

// Chip de unidad de venta junto al nombre del producto.
const unidadChip: CSSProperties = {
  background: 'var(--color-surface-muted)',
  color: '#5B6678',
  fontSize: '11px',
  fontWeight: 800,
  padding: '2px 6px',
  borderRadius: '5px',
  marginLeft: '6px',
  whiteSpace: 'nowrap',
};

export function VentaPage() {
  const { rows, loading } = useInventario();
  const { clientes } = useClientes();
  const { registrarVenta, submitting } = useVenta();
  const location = useLocation();

  const [clienteId, setClienteId] = useState<string>('');

  // Preselección del cliente vía ?cliente=<id> (entrada desde la ruta del día).
  useEffect(() => {
    const pre = new URLSearchParams(location.search).get('cliente');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pre) setClienteId(pre);
  }, [location.search]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pedidos, setPedidos] = useState<PedidoInput[]>([]);
  const [cobroOn, setCobroOn] = useState(true);
  const [formaPago, setFormaPago] = useState<'efectivo' | 'transferencia'>('efectivo');
  const [montoStr, setMontoStr] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Borrador del pedido pendiente
  const [pedPres, setPedPres] = useState<string>('');
  const [pedCant, setPedCant] = useState<number>(1);
  const [pedFecha, setPedFecha] = useState<string>('');

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const tipo = cliente?.tipo ?? null;

  const enVehiculo = useMemo(() => rows.filter((r) => r.cantidad > 0), [rows]);

  // Líneas surtidas del vehículo (con cantidad capturada > 0)
  const lineasVehiculo = useMemo(() => {
    if (!tipo) return [];
    return enVehiculo
      .map((r) => ({ row: r, cantidad: qty[r.presentacion.id] ?? 0 }))
      .filter((x) => x.cantidad > 0)
      .map((x) => ({
        presentacion: x.row.presentacion,
        productoNombre: x.row.productoNombre,
        cantidad: x.cantidad,
        precio_unitario: precioUnitario(x.row.presentacion, tipo),
      }));
  }, [enVehiculo, qty, tipo]);

  const total = useMemo(
    () =>
      totalVenta(
        lineasVehiculo.map((l) => ({
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        }))
      ),
    [lineasVehiculo]
  );

  // Conteos para el resumen del footer (solo display).
  const piezas = lineasVehiculo.reduce((acc, l) => acc + l.cantidad, 0);

  const monto = cobroOn ? (montoStr === '' ? total : parseFloat(montoStr) || 0) : 0;
  const saldo = Math.max(0, total - monto);

  const nombrePresentacion = (id: string) =>
    rows.find((r) => r.presentacion.id === id)?.presentacion.nombre ?? id;

  const puedeGuardar =
    !!cliente && (lineasVehiculo.length > 0 || pedidos.length > 0) && !submitting;

  const agregarPedido = () => {
    if (!pedPres || pedCant <= 0) return;
    setPedidos((prev) => [
      ...prev,
      {
        presentacion_id: pedPres,
        cantidad: pedCant,
        fecha_compromiso: pedFecha || null,
      },
    ]);
    setPedPres('');
    setPedCant(1);
    setPedFecha('');
  };

  const quitarPedido = (idx: number) =>
    setPedidos((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setClienteId('');
    setQty({});
    setPedidos([]);
    setCobroOn(true);
    setFormaPago('efectivo');
    setMontoStr('');
    setPedPres('');
    setPedCant(1);
    setPedFecha('');
  };

  const guardar = async () => {
    if (!cliente || !tipo) return;
    const res = await registrarVenta({
      cliente: { id: cliente.id, tipo },
      lineasVehiculo: lineasVehiculo.map((l) => ({
        presentacion: l.presentacion,
        cantidad: l.cantidad,
      })),
      pedidos,
      cobro: cobroOn && monto > 0 ? { monto, forma_pago: formaPago } : null,
    });
    setToast(
      res.saldo > 0
        ? `Venta guardada (en cola). Saldo pendiente: ${money(res.saldo)}`
        : 'Venta y cobro guardados (en cola).'
    );
    reset();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': 'var(--color-on-dark)' }}>
          <IonTitle>Nueva venta</IonTitle>
          <IonButtons slot="end" style={{ marginRight: 'var(--space-sm)' }}>
            <SyncStatusBadge />
          </IonButtons>
        </IonToolbar>
        {/* Franja offline-first permanente (ADR-0001) */}
        <ConnectivityStrip text="La venta se guarda en el equipo al instante" />
      </IonHeader>

      <IonContent>
        {loading && (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && (
          <>
            <div style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* ── Cliente ── */}
              <Card padding="11px 13px">
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  {cliente ? (
                    <ClienteAvatar nombre={cliente.nombre} />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        flex: 'none',
                        borderRadius: '11px',
                        background: 'var(--color-surface-muted)',
                        color: 'var(--color-disabled)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 800,
                      }}
                    >
                      ?
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <IonSelect
                      aria-label="Cliente"
                      label={cliente ? undefined : 'Cliente *'}
                      labelPlacement="stacked"
                      value={clienteId}
                      placeholder="Selecciona un cliente"
                      onIonChange={(e) => setClienteId(e.detail.value)}
                      style={{
                        minHeight: 'auto',
                        fontSize: '16.5px',
                        fontWeight: 700,
                        color: 'var(--color-navy)',
                        '--padding-start': '0',
                        '--padding-top': '0',
                        '--padding-bottom': '0',
                      }}
                    >
                      {clientes.map((c) => (
                        <IonSelectOption key={c.id} value={c.id}>
                          {c.nombre}
                        </IonSelectOption>
                      ))}
                    </IonSelect>
                    {cliente && tipo && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '4px' }}>
                        <Chip tone={tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}>
                          {tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                        </Chip>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* ── Banner lista mayoreo ── */}
              {cliente && tipo === 'mayoreo' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'var(--color-navy)',
                    borderRadius: '12px',
                    padding: '11px 14px',
                  }}
                >
                  <span
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      background: 'var(--color-cyan)',
                      display: 'inline-block',
                      flex: 'none',
                    }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>
                    Aplicando Lista mayoreo
                  </span>
                  <span
                    className="numeric"
                    style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', fontWeight: 700, color: '#9FC9FF' }}
                  >
                    precios por cliente
                  </span>
                </div>
              )}

              {/* ── Del vehículo (H-04) ── */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '2px',
                  }}
                >
                  <span style={sectionLabel}>Del vehículo · se cobra hoy</span>
                  {cliente && tipo && (
                    <Chip tone={tipo === 'mayoreo' ? 'mayoreo' : 'primarySoft'}>
                      {tipo === 'mayoreo' ? 'Lista mayoreo' : 'Lista menudeo'}
                    </Chip>
                  )}
                </div>

                {!cliente && (
                  <IonNote style={{ display: 'block', padding: 'var(--space-sm) 0' }}>
                    Selecciona un cliente para ver los precios.
                  </IonNote>
                )}

                {cliente && enVehiculo.length === 0 && (
                  <IonNote style={{ display: 'block', padding: 'var(--space-sm) 0' }}>
                    Sin inventario cargado. Carga el vehículo o levanta un pedido.
                  </IonNote>
                )}

                {cliente &&
                  tipo &&
                  enVehiculo.map((r) => {
                    const precio = precioUnitario(r.presentacion, tipo);
                    const cantidad = qty[r.presentacion.id] ?? 0;
                    return (
                      <div
                        key={r.presentacion.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '11px',
                          padding: '11px 0',
                          borderBottom: '1px solid var(--color-divider)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-body)' }}>
                            {r.presentacion.nombre}
                            <span style={unidadChip}>{r.presentacion.unidad_venta}</span>
                          </div>
                          <div
                            className="numeric"
                            style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6', marginTop: '3px' }}
                          >
                            {money(precio)} c/u · disp. {r.cantidad}
                          </div>
                        </div>
                        <StepperCantidad
                          value={cantidad}
                          min={0}
                          max={r.cantidad}
                          onChange={(v) =>
                            setQty((prev) => ({ ...prev, [r.presentacion.id]: v }))
                          }
                        />
                        <div
                          className="numeric"
                          style={{
                            width: '70px',
                            textAlign: 'right',
                            fontSize: '16px',
                            fontWeight: 800,
                            color: 'var(--color-navy)',
                          }}
                        >
                          {cantidad > 0 ? money(importeLinea(cantidad, precio)) : '—'}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* ── Pedido pendiente (H-05) ── */}
            <IonList>
              <div style={{ padding: '14px var(--space-md) 6px' }}>
                <span style={sectionLabel}>Levantar pedido (preventa)</span>
              </div>

              {pedidos.length > 0 && (
                <div style={{ padding: '0 var(--space-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pedidos.map((p, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1.5px solid var(--color-primary-line)',
                        background: 'var(--color-primary-bg)',
                        borderRadius: 'var(--radius-card)',
                        padding: '12px 13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <Chip tone="mayoreo" style={{ letterSpacing: '0.4px', textTransform: 'uppercase', padding: '3px 8px' }}>
                          Pedido pendiente
                        </Chip>
                        {p.fecha_compromiso && (
                          <span className="numeric" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-primary)' }}>
                            entrega {p.fecha_compromiso}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '9px' }}>
                        <span className="numeric" style={{ minWidth: '28px', fontSize: '15px', fontWeight: 800, color: 'var(--color-primary)' }}>
                          {p.cantidad}×
                        </span>
                        <div style={{ flex: 1, minWidth: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>
                          {nombrePresentacion(p.presentacion_id)}
                        </div>
                        <IonButton fill="clear" color="danger" size="small" onClick={() => quitarPedido(idx)} aria-label="Quitar pedido">
                          <IonIcon icon={trashOutline} slot="icon-only" />
                        </IonButton>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '9px', paddingTop: '9px', borderTop: '1px dashed var(--color-primary-line)' }}>
                        <span style={{ color: '#3E6B22', fontSize: '12.5px', fontWeight: 800 }}>✓ No baja inventario</span>
                        <span style={{ color: '#C7965B', fontSize: '12px' }}>·</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '12.5px', fontWeight: 600 }}>se cobra al entregar</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <IonItem>
                <IonLabel position="stacked">Presentación</IonLabel>
                <IonSelect
                  value={pedPres}
                  placeholder="Producto a pedir"
                  onIonChange={(e) => setPedPres(e.detail.value)}
                >
                  {rows.map((r) => (
                    <IonSelectOption key={r.presentacion.id} value={r.presentacion.id}>
                      {r.presentacion.nombre}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem>
                <IonLabel>Cantidad</IonLabel>
                <div slot="end">
                  <StepperCantidad value={pedCant} min={1} onChange={setPedCant} />
                </div>
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Fecha compromiso</IonLabel>
                <IonInput
                  type="date"
                  value={pedFecha}
                  onIonInput={(e) => setPedFecha(e.detail.value ?? '')}
                />
              </IonItem>
              <div style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={!pedPres || pedCant <= 0}
                  onClick={agregarPedido}
                >
                  <IonIcon icon={addOutline} slot="start" />
                  Agregar pedido
                </IonButton>
              </div>
            </IonList>

            {/* ── Cobro (H-07) ── */}
            <IonList>
              <div style={{ padding: '14px var(--space-md) 6px' }}>
                <span style={sectionLabel}>Cobro</span>
              </div>
              <IonItem>
                <IonLabel>Registrar cobro ahora</IonLabel>
                <IonToggle
                  checked={cobroOn}
                  onIonChange={(e) => setCobroOn(e.detail.checked)}
                />
              </IonItem>

              {cobroOn && (
                <>
                  <IonItem>
                    <IonSegment
                      value={formaPago}
                      onIonChange={(e) =>
                        setFormaPago(
                          (e.detail.value as 'efectivo' | 'transferencia') ?? 'efectivo'
                        )
                      }
                    >
                      <IonSegmentButton value="efectivo">
                        <IonLabel>Efectivo</IonLabel>
                      </IonSegmentButton>
                      <IonSegmentButton value="transferencia">
                        <IonLabel>Transferencia</IonLabel>
                      </IonSegmentButton>
                    </IonSegment>
                  </IonItem>
                  <IonItem>
                    <IonLabel position="stacked">
                      Monto cobrado (total {money(total)})
                    </IonLabel>
                    <IonInput
                      type="number"
                      inputmode="decimal"
                      value={montoStr}
                      placeholder={total.toFixed(2)}
                      onIonInput={(e) => setMontoStr(e.detail.value ?? '')}
                      min="0"
                      step="0.01"
                    />
                  </IonItem>
                  <IonItem lines="none">
                    <IonNote slot="end">
                      {saldo > 0 ? (
                        <IonText color="warning">Saldo: {money(saldo)}</IonText>
                      ) : (
                        <IonText color="success">Sin saldo</IonText>
                      )}
                    </IonNote>
                  </IonItem>
                </>
              )}
            </IonList>

            <div style={{ height: 'var(--space-lg)' }} />
          </>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-bg)' }}>
          <div style={{ padding: 'var(--space-sm) var(--space-md) var(--space-md)' }}>
            {/* Resumen */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-sm)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  color: 'var(--color-text-secondary)',
                  fontVariantNumeric: 'var(--numeric)',
                }}
              >
                {lineasVehiculo.length} producto{lineasVehiculo.length !== 1 ? 's' : ''} · {piezas} pieza
                {piezas !== 1 ? 's' : ''}
              </span>
              {cliente && (
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 700,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Lista {tipo === 'mayoreo' ? 'mayoreo' : 'menudeo'}
                </span>
              )}
            </div>

            {/* CTA ancho completo con total integrado */}
            <PrimaryCTA
              disabled={!puedeGuardar}
              loading={submitting}
              onClick={guardar}
              trailing={money(total)}
            >
              {submitting ? 'Guardando…' : 'Guardar venta'}
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={3000}
        onDidDismiss={() => setToast(null)}
        color="dark"
      />
    </IonPage>
  );
}
