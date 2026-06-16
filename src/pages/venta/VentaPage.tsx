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
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonBadge,
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
import { useLocation } from 'react-router-dom';
import { useInventario } from '../../hooks/useInventario';
import { useClientes } from '../../hooks/useClientes';
import { useVenta } from '../../hooks/useVenta';
import { StepperCantidad } from '../../components/StepperCantidad';
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
import { precioUnitario, importeLinea, totalVenta } from '../../lib/precios';
import type { PedidoInput } from '../../lib/ventas';

const money = (n: number) => `$${n.toFixed(2)}`;

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
        <IonToolbar style={{ '--background': 'var(--color-navy)', '--color': '#fff' }}>
          <IonTitle>Nueva venta</IonTitle>
          <IonButtons slot="end">
            <SyncStatusBadge showLabel={false} />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && (
          <>
            {/* ── Cliente ── */}
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Cliente *</IonLabel>
                <IonSelect
                  value={clienteId}
                  placeholder="Selecciona un cliente"
                  onIonChange={(e) => setClienteId(e.detail.value)}
                >
                  {clientes.map((c) => (
                    <IonSelectOption key={c.id} value={c.id}>
                      {c.nombre}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </IonList>

            {cliente && (
              <div style={{ padding: '4px 16px 0' }}>
                <IonBadge
                  style={{
                    backgroundColor:
                      tipo === 'mayoreo' ? 'var(--color-navy)' : 'var(--color-primary)',
                  }}
                >
                  Lista: {tipo === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}
                </IonBadge>
              </div>
            )}

            {/* ── Del vehículo (H-04) ── */}
            <IonList>
              <IonListHeader>
                <IonLabel>Del vehículo</IonLabel>
              </IonListHeader>

              {!cliente && (
                <IonItem lines="none">
                  <IonNote>Selecciona un cliente para ver los precios.</IonNote>
                </IonItem>
              )}

              {cliente && enVehiculo.length === 0 && (
                <IonItem lines="none">
                  <IonNote>
                    Sin inventario cargado. Carga el vehículo o levanta un pedido.
                  </IonNote>
                </IonItem>
              )}

              {cliente &&
                tipo &&
                enVehiculo.map((r) => {
                  const precio = precioUnitario(r.presentacion, tipo);
                  const cantidad = qty[r.presentacion.id] ?? 0;
                  return (
                    <IonItem key={r.presentacion.id}>
                      <IonLabel>
                        <h3 style={{ color: 'var(--color-navy)' }}>
                          {r.presentacion.nombre}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#6B7280' }}>
                          {money(precio)} c/u · disponibles: {r.cantidad}
                          {cantidad > 0 && (
                            <> · subtotal {money(importeLinea(cantidad, precio))}</>
                          )}
                        </p>
                      </IonLabel>
                      <div slot="end">
                        <StepperCantidad
                          value={cantidad}
                          min={0}
                          max={r.cantidad}
                          onChange={(v) =>
                            setQty((prev) => ({ ...prev, [r.presentacion.id]: v }))
                          }
                        />
                      </div>
                    </IonItem>
                  );
                })}
            </IonList>

            {/* ── Pedido pendiente (H-05) ── */}
            <IonList>
              <IonListHeader>
                <IonLabel>Levantar pedido (preventa)</IonLabel>
              </IonListHeader>

              {pedidos.map((p, idx) => (
                <IonItem key={idx}>
                  <IonLabel>
                    <h3>{nombrePresentacion(p.presentacion_id)}</h3>
                    <p style={{ fontSize: '12px', color: '#6B7280' }}>
                      Cantidad: {p.cantidad}
                      {p.fecha_compromiso && <> · compromiso: {p.fecha_compromiso}</>}
                    </p>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    fill="clear"
                    color="danger"
                    onClick={() => quitarPedido(idx)}
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                </IonItem>
              ))}

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
              <div style={{ padding: '8px 16px' }}>
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
              <IonListHeader>
                <IonLabel>Cobro</IonLabel>
              </IonListHeader>
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

            <div style={{ height: '24px' }} />
          </>
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar style={{ '--background': 'var(--color-surface)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>Total</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-navy)' }}>
                {money(total)}
              </div>
            </div>
            <IonButton
              style={{ '--background': 'var(--color-primary)' }}
              disabled={!puedeGuardar}
              onClick={guardar}
            >
              {submitting ? <IonSpinner name="crescent" /> : 'Guardar venta'}
            </IonButton>
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
