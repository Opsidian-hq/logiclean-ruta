/**
 * Logiclean Ruta — Registro de venta offline (H-04, H-05, H-07)
 *
 * Compone, en una sola operación local e instantánea:
 *  - VENTA + LINEA_VENTA (precio congelado según la lista del cliente, H-04)
 *  - descuento de INVENTARIO_VEHICULO por las cantidades vendidas (H-04)
 *  - PEDIDO_PENDIENTE para lo que el cliente pide y no está en el vehículo,
 *    que NO descuenta inventario (H-05)
 *  - COBRO opcional con forma de pago; el saldo = total − cobrado (H-07)
 *
 * Todo se escribe en Dexie y se encola para sync idempotente. Se dispara un
 * único ciclo de sync al final del lote.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { toDexieRow } from '../db/normalize';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import { precioUnitario, totalVenta, calcularIVA, totalConFactura } from './precios';
import { decrementar } from './inventario';
import type {
  Presentacion,
  Venta,
  LineaVenta,
  Cobro,
  PedidoPendiente,
} from '../db/schema';
import type { TipoCliente } from './precios';

// ── Entradas ──────────────────────────────────────────────────

/** Una línea surtida desde el inventario del vehículo. */
export interface LineaVehiculoInput {
  presentacion: Pick<Presentacion, 'id' | 'precio_mayoreo' | 'precio_menudeo'>;
  cantidad: number;
}

/** Un pedido pendiente (preventa): no surte del vehículo. */
export interface PedidoInput {
  presentacion_id: string;
  cantidad: number;
  fecha_compromiso?: string | null;
}

/** Cobro asociado a la venta. */
export interface CobroInput {
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
}

export interface RegistrarVentaInput {
  vendedorId: string;
  cliente: { id: string; tipo: TipoCliente };
  /** Líneas surtidas del vehículo (descuentan inventario). */
  lineasVehiculo: LineaVehiculoInput[];
  /** Pedidos pendientes (no descuentan inventario). */
  pedidos?: PedidoInput[];
  /** Cobro opcional; si se omite o monto=0, la venta queda a crédito. */
  cobro?: CobroInput | null;
  requiereFactura?: boolean;
  /** Fecha ISO; por defecto ahora (parametrizable para pruebas). */
  fecha?: string;
}

// ── Salida ────────────────────────────────────────────────────

export interface RegistrarVentaResult {
  venta: Venta;
  lineas: LineaVenta[];
  pedidos: PedidoPendiente[];
  cobro: Cobro | null;
  /** Subtotal a precio de lista (suma de líneas, sin IVA). */
  subtotal: number;
  /** IVA aplicado (0 si la venta no requiere factura, H-06). */
  iva: number;
  /** total − cobrado; >0 = queda saldo (crédito). */
  saldo: number;
}

// ── Registro ──────────────────────────────────────────────────

export async function registrarVenta(
  input: RegistrarVentaInput
): Promise<RegistrarVentaResult> {
  const {
    vendedorId,
    cliente,
    lineasVehiculo,
    pedidos = [],
    cobro,
    requiereFactura = false,
    fecha = new Date().toISOString(),
  } = input;

  if (lineasVehiculo.length === 0 && pedidos.length === 0) {
    throw new Error('La venta no tiene líneas ni pedidos.');
  }

  const ventaId = generateUUID();

  // Líneas con precio CONGELADO según la lista del cliente (H-04).
  const lineas: LineaVenta[] = lineasVehiculo.map((l) => ({
    id: generateUUID(),
    venta_id: ventaId,
    presentacion_id: l.presentacion.id,
    cantidad: l.cantidad,
    precio_unitario: precioUnitario(l.presentacion, cliente.tipo),
  }));

  // Subtotal a precio de lista; si requiere factura, el monto es lista + IVA (H-06).
  const subtotal = totalVenta(lineas);
  const iva = requiereFactura ? calcularIVA(subtotal) : 0;
  const total = totalConFactura(subtotal, requiereFactura);

  const venta: Venta = {
    id: ventaId,
    vendedor_id: vendedorId,
    cliente_id: cliente.id,
    fecha,
    requiere_factura: requiereFactura,
    total,
  };

  // 1) VENTA
  await persist('venta', venta);

  // 2) LINEAS + descuento de inventario (no dispara sync por línea)
  for (let i = 0; i < lineas.length; i++) {
    await persist('linea_venta', lineas[i]);
    await decrementar(
      vendedorId,
      lineas[i].presentacion_id,
      lineasVehiculo[i].cantidad,
      false
    );
  }

  // 3) PEDIDOS PENDIENTES (no tocan inventario, H-05)
  const pedidosCreados: PedidoPendiente[] = [];
  for (const p of pedidos) {
    const pedido: PedidoPendiente = {
      id: generateUUID(),
      cliente_id: cliente.id,
      vendedor_id: vendedorId,
      presentacion_id: p.presentacion_id,
      cantidad: p.cantidad,
      fecha_compromiso: p.fecha_compromiso ?? undefined,
      estado: 'pendiente',
    };
    await persist('pedido_pendiente', pedido);
    pedidosCreados.push(pedido);
  }

  // 3b) Agendar la visita de entrega: la próxima visita del cliente se mueve a
  //     la fecha de entrega más próxima del pedido, para que reaparezca en la
  //     ruta (HOY/Esta semana) y el vendedor vaya a entregarlo (H-05).
  await agendarEntrega(cliente.id, pedidosCreados);

  // 4) COBRO opcional (H-07)
  let cobroCreado: Cobro | null = null;
  if (cobro && cobro.monto > 0) {
    cobroCreado = {
      id: generateUUID(),
      venta_id: ventaId,
      fecha,
      monto: cobro.monto,
      forma_pago: cobro.forma_pago,
      tipo: cobro.monto >= total ? 'total' : 'parcial',
    };
    await persist('cobro', cobroCreado);
  }

  // 5) Un único disparo de sync para todo el lote.
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  const saldo = Math.max(0, total - (cobroCreado?.monto ?? 0));

  return { venta, lineas, pedidos: pedidosCreados, cobro: cobroCreado, subtotal, iva, saldo };
}

/**
 * Mueve la próxima visita del cliente a la fecha de entrega más próxima de los
 * pedidos levantados, salvo que ya tuviera agendada una visita anterior (no la
 * retrasa). Persiste el cliente en el mismo lote (sin disparar sync aquí).
 */
async function agendarEntrega(
  clienteId: string,
  pedidos: PedidoPendiente[]
): Promise<void> {
  const fechas = pedidos
    .map((p) => p.fecha_compromiso)
    .filter((f): f is string => !!f)
    .map((f) => f.slice(0, 10));
  if (fechas.length === 0) return;

  const proximaEntrega = fechas.sort()[0];
  const cliente = await db.cliente.get(clienteId);
  if (!cliente) return;

  const actual = cliente.fecha_proxima_visita?.slice(0, 10) ?? null;
  if (actual && actual <= proximaEntrega) return; // ya hay una visita igual o antes

  // Patch parcial: solo fecha_proxima_visita. Un upsert completo podría
  // sobreescribir campos (dia_ruta, nombre…) con una snapshot antigua si el
  // ítem lleva tiempo en la cola de sync.
  await db.cliente
    .where('id')
    .equals(clienteId)
    .modify({ fecha_proxima_visita: proximaEntrega });
  await enqueueOperation('cliente', 'patch', {
    id: clienteId,
    fecha_proxima_visita: proximaEntrega,
  });
}

// ── Persistencia local + cola (sin disparar sync) ─────────────

async function persist(
  table: 'venta' | 'linea_venta' | 'pedido_pendiente' | 'cobro' | 'cliente',
  row: object
): Promise<void> {
  const raw = row as Record<string, unknown>;
  // Dexie necesita 1/0 para indexar booleanos; Supabase necesita true/false.
  await db.table(table).put(toDexieRow(raw));
  await enqueueOperation(table, 'upsert', raw);
}
