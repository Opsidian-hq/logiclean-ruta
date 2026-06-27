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
import { precioUnitario, importeLinea, redondear } from './precios';
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

/** Pedido pendiente con precio congelado e importe, para la pantalla de entrega. */
export interface PedidoEntregaVista extends PedidoPendienteVista {
  /** Precio unitario congelado según la lista del cliente (H-04). */
  precio_unitario: number;
  /** Importe de la línea: cantidad × precio_unitario. */
  importe: number;
}

/**
 * Pedidos pendientes de un cliente listos para confirmar entrega: además del
 * nombre, calculan el precio congelado por la lista del cliente (H-04) y el
 * importe por renglón, que la pantalla de entrega usa para el total y el cobro.
 */
export async function pedidosParaEntrega(
  clienteId: string
): Promise<PedidoEntregaVista[]> {
  const cliente = await db.cliente.get(clienteId);
  const tipo = cliente?.tipo ?? 'menudeo';
  const pendientes = await pedidosPendientesDeCliente(clienteId);
  return Promise.all(
    pendientes.map(async (p) => {
      const pres = await db.presentacion.get(p.presentacion_id);
      const precio = pres ? precioUnitario(pres, tipo) : 0;
      return {
        id: p.id,
        presentacion_id: p.presentacion_id,
        nombre: pres?.nombre ?? p.presentacion_id,
        cantidad: p.cantidad,
        fecha_compromiso: p.fecha_compromiso ?? undefined,
        precio_unitario: precio,
        importe: importeLinea(p.cantidad, precio),
      };
    })
  );
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

// ── Confirmar entrega (entrega parcial: entregar / reprogramar / cancelar) ──
//
// Cierra el flujo rediseñado de Visitas: el vendedor marca por producto qué se
// entregó, qué se reprograma (nueva fecha de compromiso) y qué cancela el
// cliente. Los entregados forman **una sola venta con una línea por producto**
// (para que el cobro posterior quede aislado a esa entrega); los reprogramados
// actualizan su `fecha_compromiso` y siguen pendientes; los cancelados pasan a
// `cancelado` (no generan venta ni cobro). Todo local + cola; un solo sync.

export type AccionEntrega = 'entregar' | 'reprogramar' | 'cancelar';

export interface DecisionEntrega {
  pedidoId: string;
  accion: AccionEntrega;
}

export interface ConfirmarEntregaInput {
  decisiones: DecisionEntrega[];
  /** Nueva fecha de compromiso (ISO date) para los productos reprogramados. */
  fechaReprogramacion?: string;
  /** Fecha de la venta resultante; por defecto ahora (parametrizable). */
  fecha?: string;
  /** Si la venta de los entregados descuenta inventario. Por defecto sí. */
  descontarInventario?: boolean;
}

export interface ConfirmarEntregaResult {
  /** Venta de los entregados (null si no se entregó ningún producto). */
  venta: Venta | null;
  lineas: LineaVenta[];
  /** Total de la entrega = Σ importes de los entregados. */
  total: number;
  entregados: PedidoPendiente[];
  reprogramados: PedidoPendiente[];
  cancelados: PedidoPendiente[];
}

export async function confirmarEntrega(
  input: ConfirmarEntregaInput
): Promise<ConfirmarEntregaResult> {
  const {
    decisiones,
    fechaReprogramacion,
    fecha = new Date().toISOString(),
    descontarInventario = true,
  } = input;

  if (decisiones.length === 0) {
    throw new Error('No hay productos en la entrega.');
  }

  // Cargar y validar todos los pedidos involucrados.
  const items = await Promise.all(
    decisiones.map(async (d) => {
      const pedido = await db.pedido_pendiente.get(d.pedidoId);
      if (!pedido) throw new Error(`No existe el pedido ${d.pedidoId}.`);
      if (pedido.estado !== 'pendiente') {
        throw new Error('El pedido ya no está pendiente.');
      }
      return { accion: d.accion, pedido };
    })
  );

  const clienteId = items[0].pedido.cliente_id;
  const cliente = await db.cliente.get(clienteId);
  if (!cliente) throw new Error('No existe el cliente del pedido.');

  const aEntregar = items.filter((x) => x.accion === 'entregar').map((x) => x.pedido);
  const aReprogramar = items.filter((x) => x.accion === 'reprogramar').map((x) => x.pedido);
  const aCancelar = items.filter((x) => x.accion === 'cancelar').map((x) => x.pedido);

  if (aReprogramar.length > 0 && !fechaReprogramacion) {
    throw new Error('Falta la fecha de reprogramación.');
  }

  // 1) Una sola VENTA con una LÍNEA por producto entregado (precio congelado).
  let venta: Venta | null = null;
  const lineas: LineaVenta[] = [];
  let total = 0;

  if (aEntregar.length > 0) {
    const ventaId = generateUUID();
    for (const pedido of aEntregar) {
      const presentacion = await db.presentacion.get(pedido.presentacion_id);
      if (!presentacion) throw new Error('No existe la presentación del pedido.');
      const precio = precioUnitario(presentacion, cliente.tipo);
      lineas.push({
        id: generateUUID(),
        venta_id: ventaId,
        presentacion_id: pedido.presentacion_id,
        cantidad: pedido.cantidad,
        precio_unitario: precio,
      });
      total = redondear(total + importeLinea(pedido.cantidad, precio));
      if (descontarInventario) {
        await decrementar(pedido.vendedor_id, pedido.presentacion_id, pedido.cantidad, false);
      }
    }

    venta = {
      id: ventaId,
      vendedor_id: cliente.vendedor_id,
      cliente_id: clienteId,
      fecha,
      requiere_factura: false,
      total,
    };
    await persist('venta', venta);
    for (const linea of lineas) await persist('linea_venta', linea);
    for (const pedido of aEntregar) {
      await persist('pedido_pendiente', { ...pedido, estado: 'surtido' });
    }
  }

  // 2) Reprogramados: nueva fecha de compromiso, siguen pendientes.
  const reprogramados: PedidoPendiente[] = [];
  for (const pedido of aReprogramar) {
    const actualizado: PedidoPendiente = { ...pedido, fecha_compromiso: fechaReprogramacion };
    await persist('pedido_pendiente', actualizado);
    reprogramados.push(actualizado);
  }

  // 3) Cancelados: salen del pedido pendiente, no generan venta ni cobro.
  const cancelados: PedidoPendiente[] = [];
  for (const pedido of aCancelar) {
    const actualizado: PedidoPendiente = { ...pedido, estado: 'cancelado' };
    await persist('pedido_pendiente', actualizado);
    cancelados.push(actualizado);
  }

  // 4) Reagendar la próxima visita del cliente a su siguiente entrega pendiente.
  await reagendarTrasEntregaLote(cliente, items.map((x) => x.pedido));

  // 5) Un único disparo de sync para todo el lote.
  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return {
    venta,
    lineas,
    total,
    entregados: aEntregar.map((p) => ({ ...p, estado: 'surtido' })),
    reprogramados,
    cancelados,
  };
}

/**
 * Versión por lote de `reagendarTrasEntrega`: si la próxima visita del cliente
 * la había agendado **alguna** de las entregas procesadas (coincide con su
 * `fecha_compromiso` original), la reapunta a la siguiente entrega pendiente
 * (incluyendo reprogramaciones recién aplicadas) o la deja en null.
 */
async function reagendarTrasEntregaLote(
  cliente: Cliente,
  procesados: PedidoPendiente[]
): Promise<void> {
  const actual = cliente.fecha_proxima_visita?.slice(0, 10) ?? null;
  if (!actual) return;

  const agendoEntrega = procesados.some(
    (p) => (p.fecha_compromiso?.slice(0, 10) ?? null) === actual
  );
  if (!agendoEntrega) return;

  // `restantes` ya refleja el estado persistido: surtidos/cancelados quedan
  // fuera; los reprogramados siguen pendientes con su nueva fecha.
  const restantes = await pedidosPendientesDeCliente(cliente.id);
  const siguiente =
    restantes
      .map((p) => p.fecha_compromiso)
      .filter((f): f is string => !!f)
      .map((f) => f.slice(0, 10))
      .sort()[0] ?? null;

  await persist('cliente', toDexieRow({ ...cliente, fecha_proxima_visita: siguiente }));
}

// ── Persistencia local + cola (sin disparar sync) ─────────────

async function persist(
  table: 'venta' | 'linea_venta' | 'pedido_pendiente' | 'cliente',
  row: object
): Promise<void> {
  await db.table(table).put(row);
  await enqueueOperation(table, 'upsert', row as Record<string, unknown>);
}
