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
  IonInput,
  IonToggle,
  IonIcon,
  IonSpinner,
  IonToast,
  IonFooter,
  IonModal,
} from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { useInventario } from '../../hooks/useInventario';
import { useClientes } from '../../hooks/useClientes';
import { useVenta } from '../../hooks/useVenta';
import { useAuthContext } from '../../context/AuthContext';
import { NuevoClienteForm, type NuevoClienteArgs } from './components/NuevoClienteForm';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { ConnectivityStrip } from '../../components/ui/ConnectivityStrip';
import { Card } from '../../components/ui/Card';
import { Chip } from '../../components/ui/Chip';
import { ClienteAvatar } from '../../components/ui/ClienteAvatar';
import { PrimaryCTA } from '../../components/ui/PrimaryCTA';
import { precioUnitario, importeLinea, totalVenta, calcularIVA, totalConFactura } from '../../lib/precios';
import type { PedidoInput } from '../../lib/ventas';
import type { RegistrarVentaResult } from '../../lib/ventas';
import { money } from '../../lib/money';
import { CobroVentaStep, type DecisionCobro } from '../cobranza/CobroVentaStep';
import { ConfirmacionCobro } from '../cobranza/ConfirmacionCobro';
import type { FormaPago } from '../../lib/cobros';

/** Fases del flujo de venta: carrito (Flujo A) → cobro (P1) → confirmación (P2). */
type Fase = 'carrito' | 'cobro' | 'confirmacion';

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
  const { clientes, saveCliente } = useClientes();
  const { registrarVenta, submitting } = useVenta();
  const { user } = useAuthContext();
  const location = useLocation();
  const history = useHistory();

  const [clienteId, setClienteId] = useState<string>('');
  const [nuevoClienteOpen, setNuevoClienteOpen] = useState(false);

  // Alta de cliente activo sin salir de la venta: queda auto-seleccionado.
  const crearClienteVenta = async ({ nombre, tipo, diaRuta }: NuevoClienteArgs) => {
    if (!user) return;
    const nuevo = await saveCliente({
      vendedor_id: user.id,
      nombre,
      tipo,
      estado: 'activo',
      ciclo_visita: 1,
      dia_ruta: diaRuta,
      fecha_proxima_visita: null,
      activo: true,
    });
    setClienteId(nuevo.id);
  };

  // Preselección del cliente vía ?cliente=<id> (entrada desde la ruta del día).
  useEffect(() => {
    const pre = new URLSearchParams(location.search).get('cliente');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pre) setClienteId(pre);
  }, [location.search]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [pedidos, setPedidos] = useState<PedidoInput[]>([]);
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Flujo C: fase del paso de cobro y resultado de la operación guardada.
  const [fase, setFase] = useState<Fase>('carrito');
  const [resultado, setResultado] = useState<RegistrarVentaResult | null>(null);
  const [decision, setDecision] = useState<DecisionCobro | null>(null);

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

  const subtotal = useMemo(
    () =>
      totalVenta(
        lineasVehiculo.map((l) => ({
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
        }))
      ),
    [lineasVehiculo]
  );

  // Si la venta requiere factura, el monto es precio de lista + IVA (H-06).
  const iva = requiereFactura ? calcularIVA(subtotal) : 0;
  const total = totalConFactura(subtotal, requiereFactura);

  // Conteos para el resumen del footer (solo display).
  const piezas = lineasVehiculo.reduce((acc, l) => acc + l.cantidad, 0);

  const productosResumen = useMemo(() => {
    const ps = lineasVehiculo.length;
    const pd = pedidos.length;
    const partes = [`${ps} producto${ps !== 1 ? 's' : ''}`];
    if (pd > 0) partes.push(`${pd} pedido${pd !== 1 ? 's' : ''}`);
    return partes.join(' · ');
  }, [lineasVehiculo.length, pedidos.length]);

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
    setRequiereFactura(false);
    setPedPres('');
    setPedCant(1);
    setPedFecha('');
    setFase('carrito');
    setResultado(null);
    setDecision(null);
  };

  // P1: el vendedor eligió cómo cobrar → se guarda venta + cobro y pasa a P2.
  const confirmarCobro = async (d: DecisionCobro) => {
    if (!cliente || !tipo) return;
    const res = await registrarVenta({
      cliente: { id: cliente.id, tipo },
      lineasVehiculo: lineasVehiculo.map((l) => ({
        presentacion: l.presentacion,
        cantidad: l.cantidad,
      })),
      pedidos,
      cobro: d.modo === 'credito' ? null : { monto: d.monto, forma_pago: d.forma_pago },
      requiereFactura,
    });
    setResultado(res);
    setDecision(d);
    setFase('confirmacion');
  };

  // P2: regreso a la ruta del día; se descarta el estado en memoria.
  const volverARuta = () => {
    reset();
    history.push('/visitas');
  };

  // ── P1 · "¿Cómo cobramos?" (paso de cobro tras confirmar el carrito) ──
  if (fase === 'cobro' && cliente && tipo) {
    return (
      <IonPage>
        <CobroVentaStep
          clienteNombre={cliente.nombre}
          tipo={tipo}
          productosResumen={productosResumen}
          total={total}
          iva={iva}
          submitting={submitting}
          onConfirm={confirmarCobro}
          onBack={() => setFase('carrito')}
        />
      </IonPage>
    );
  }

  // ── P2 · Confirmación de venta con cobro registrado ──
  if (fase === 'confirmacion' && resultado && cliente && tipo) {
    const formaPago: FormaPago | null =
      decision && decision.modo !== 'credito' ? decision.forma_pago : null;
    return (
      <IonPage>
        <ConfirmacionCobro
          ventaId={resultado.venta.id}
          clienteNombre={cliente.nombre}
          tipo={tipo}
          total={resultado.venta.total}
          subtotal={resultado.subtotal}
          iva={resultado.iva}
          montoCobrado={resultado.cobro?.monto ?? 0}
          formaPago={formaPago}
          saldo={resultado.saldo}
          onVolverRuta={volverARuta}
          onVerFicha={
            resultado.saldo > 0
              ? () => {
                  const id = cliente.id;
                  reset();
                  history.push(`/cobranza/${id}`);
                }
              : undefined
          }
        />
      </IonPage>
    );
  }

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
                    {/* Alta de cliente nuevo en la propia venta (vendedor). */}
                    <button
                      type="button"
                      onClick={() => setNuevoClienteOpen(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '6px',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <IonIcon icon={addOutline} style={{ fontSize: '16px' }} />
                      Nuevo cliente
                    </button>
                  </div>
                  {/* Acceso a cobrar saldo previo desde la ficha del cliente (P3). */}
                  {cliente && (
                    <button
                      type="button"
                      onClick={() => history.push(`/cobranza/${cliente.id}`)}
                      style={{
                        flex: 'none',
                        minHeight: '44px',
                        padding: '0 12px',
                        border: '1.5px solid var(--color-primary)',
                        borderRadius: '12px',
                        background: 'var(--color-surface)',
                        color: 'var(--color-primary)',
                        fontSize: '13.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Cobrar saldo
                    </button>
                  )}
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

            {/* El cobro (H-07) ocurre en el paso siguiente: "¿Cómo cobramos?". */}

            {/* ── Requiere factura (H-06) ── */}
            <div style={{ padding: '0 var(--space-md)' }}>
              <Card padding="11px 13px">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-body)' }}>Requiere factura</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#8A94A6' }}>Precio de lista + IVA</div>
                  </div>
                  <IonToggle
                    checked={requiereFactura}
                    onIonChange={(e) => setRequiereFactura(e.detail.checked)}
                  />
                </div>
              </Card>
            </div>

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

            {/* CTA ancho completo: avanza al paso de cobro (P1). */}
            <PrimaryCTA
              disabled={!puedeGuardar}
              onClick={() => setFase('cobro')}
              trailing={money(total)}
            >
              Continuar al cobro
            </PrimaryCTA>
          </div>
        </IonToolbar>
      </IonFooter>

      {/* Modal: alta rápida de cliente activo desde la venta */}
      <IonModal isOpen={nuevoClienteOpen} onDidDismiss={() => setNuevoClienteOpen(false)}>
        <NuevoClienteForm
          onCrear={crearClienteVenta}
          onClose={() => setNuevoClienteOpen(false)}
        />
      </IonModal>

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
