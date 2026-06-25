/**
 * Logiclean Ruta — Entrega de pedido pendiente (H-05)
 *
 * Cierra el ciclo de la preventa: cuando el cliente recibe lo que había pedido
 * y no se cargaba en el vehículo, el pedido pendiente **se convierte en venta y
 * se cierra**.
 *
 * Criterio de aceptación (PRD v1.2, H-05):
 *  - Dado un pedido pendiente, cuando se entrega, entonces se convierte en venta
 *    y se cierra el pendiente.
 *
 * La venta resultante congela el precio según la lista del cliente (H-04), baja
 * el inventario del vehículo por la cantidad entregada, y el pedido pasa a
 * estado `surtido`. Todo se escribe local al instante y entra a la cola de sync
 * idempotente (offline-first). La venta queda cobrable por el flujo de cobranza
 * (H-07) como cualquier otra.
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { toDexieRow } from '../db/normalize';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import { precioUnitario, importeLinea } from './precios';
import { decrementar } from './inventario';
import type { Venta, LineaVenta, PedidoPendiente, Cliente } from '../db/schema';

export interface EntregarPedidoInput {
  pedidoId: string;
  /** Fecha ISO de la entrega; por defecto ahora (parametrizable para pruebas). */
  fecha?: string;
  /** Si la venta resultante descuenta inventario del vehículo. Por defecto sí. */
  descontarInventario?: boolean;
}

export interface EntregarPedidoResult {
  venta: Venta;
  linea: LineaVenta;
  pedido: PedidoPendiente;
}

/** Pedidos aún pendientes de un cliente (no surtidos ni cancelados). */
export async function pedidosPendientesDeCliente(
  clienteId: string
): Promise<PedidoPendiente[]> {
  const pedidos = await db.pedido_pendiente
    .where('cliente_id')
    .equals(clienteId)
    .toArray();
  return pedidos.filter((p) => p.estado === 'pendiente');
}

/** Pedido pendiente con el nombre de su presentación resuelto (para la UI). */
export interface PedidoPendienteVista {
  id: string;
  presentacion_id: string;
  nombre: string;
  cantidad: number;
  fecha_compromiso?: string;
}

/**
 * Pedidos pendientes de un cliente con el nombre de la presentación resuelto
 * desde el catálogo local. Útil para listarlos en la ficha del cliente (H-05).
 */
export async function pedidosPendientesVista(
  clienteId: string
): Promise<PedidoPendienteVista[]> {
  const pendientes = await pedidosPendientesDeCliente(clienteId);
  const vista = await Promise.all(
    pendientes.map(async (p) => {
      const pres = await db.presentacion.get(p.presentacion_id);
      return {
        id: p.id,
        presentacion_id: p.presentacion_id,
        nombre: pres?.nombre ?? p.presentacion_id,
        cantidad: p.cantidad,
        fecha_compromiso: p.fecha_compromiso ?? undefined,
      };
    })
  );
  return vista;
}

/**
 * Entrega un pedido pendiente: lo convierte en venta (precio congelado por la
 * lista del cliente) y marca el pendiente como `surtido`.
 */
export async function entregarPedido(
  input: EntregarPedidoInput
): Promise<EntregarPedidoResult> {
  const {
    pedidoId,
    fecha = new Date().toISOString(),
    descontarInventario = true,
  } = input;

  const pedido = await db.pedido_pendiente.get(pedidoId);
  if (!pedido) {
    throw new Error(`No existe el pedido ${pedidoId}.`);
  }
  if (pedido.estado !== 'pendiente') {
    throw new Error('El pedido ya no está pendiente.');
  }

  const cliente = await db.cliente.get(pedido.cliente_id);
  if (!cliente) {
    throw new Error('No existe el cliente del pedido.');
  }
  const presentacion = await db.presentacion.get(pedido.presentacion_id);
  if (!presentacion) {
    throw new Error('No existe la presentación del pedido.');
  }

  // Precio CONGELADO según la lista del cliente al momento de la entrega (H-04).
  const precio = precioUnitario(presentacion, cliente.tipo);
  const ventaId = generateUUID();

  const linea: LineaVenta = {
    id: generateUUID(),
    venta_id: ventaId,
    presentacion_id: pedido.presentacion_id,
    cantidad: pedido.cantidad,
    precio_unitario: precio,
  };

  const venta: Venta = {
    id: ventaId,
    vendedor_id: pedido.vendedor_id,
    cliente_id: pedido.cliente_id,
    fecha,
    requiere_factura: false,
    total: importeLinea(pedido.cantidad, precio),
  };

  // 1) VENTA + LÍNEA
  await persist('venta', venta);
  await persist('linea_venta', linea);

  // 2) Descuento de inventario del vehículo (ahora sí se surte del vehículo).
  if (descontarInventario) {
    await decrementar(pedido.vendedor_id, pedido.presentacion_id, pedido.cantidad, false);
  }

  // 3) Cerrar el pendiente: estado → surtido.
  const pedidoSurtido: PedidoPendiente = { ...pedido, estado: 'surtido' };
  await persist('pedido_pendiente', pedidoSurtido);

  // 3b) Reagendar la próxima visita del cliente a la siguiente entrega pendiente
  //     (o quitarla si ya no quedan), para que salga de HOY/Esta semana una vez
  //     entregado todo lo que reaparecía por entregas.
  await reagendarTrasEntrega(cliente, pedido);

  // 4) Un único disparo de sync para todo el lote.
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { venta, linea, pedido: pedidoSurtido };
}

/**
 * Tras surtir un pedido, si la próxima visita del cliente había quedado agendada
 * **por esa entrega** (coincide con su `fecha_compromiso`), la reagenda a la
 * siguiente entrega pendiente o la deja en null. Si la visita venía de otra cosa
 * (p. ej. el ciclo de un prospecto), no la toca. Persiste en el lote.
 */
async function reagendarTrasEntrega(
  cliente: Cliente,
  pedidoSurtido: PedidoPendiente
): Promise<void> {
  const compromiso = pedidoSurtido.fecha_compromiso?.slice(0, 10) ?? null;
  const actual = cliente.fecha_proxima_visita?.slice(0, 10) ?? null;
  // Sólo limpiamos lo que esta entrega había agendado.
  if (!compromiso || actual !== compromiso) return;

  const restantes = (await pedidosPendientesDeCliente(cliente.id)).filter(
    (p) => p.id !== pedidoSurtido.id
  );
  const siguienteEntrega =
    restantes
      .map((p) => p.fecha_compromiso)
      .filter((f): f is string => !!f)
      .map((f) => f.slice(0, 10))
      .sort()[0] ?? null;

  const actualizado: Cliente = { ...cliente, fecha_proxima_visita: siguienteEntrega };
  await persist('cliente', toDexieRow(actualizado));
}

// ── Persistencia local + cola (sin disparar sync) ─────────────

async function persist(
  table: 'venta' | 'linea_venta' | 'pedido_pendiente' | 'cliente',
  row: object
): Promise<void> {
  await db.table(table).put(row);
  await enqueueOperation(table, 'upsert', row as Record<string, unknown>);
}
