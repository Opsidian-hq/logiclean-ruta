/**
 * Logiclean Ruta — Tests: entrega de pedido pendiente (H-05)
 *
 * Trazabilidad con el PRD v1.2, H-05 (segundo criterio):
 *  - Dado un pedido pendiente, cuando se entrega, entonces se convierte en venta
 *    y se cierra el pendiente.
 *    → PEDIDO-101 (conversión + cierre), PEDIDO-102 (precio por lista),
 *      PEDIDO-103 (descuento de inventario), PEDIDO-104 (cola de sync),
 *      PEDIDO-105/106 (guardas), PEDIDO-107 (pendientes del cliente).
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: {
    enqueueAndSync: vi.fn(async () => {}),
    refreshPendingCount: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {}),
  },
}));

import {
  entregarPedido,
  confirmarEntrega,
  pedidosParaEntrega,
  pedidosPendientesDeCliente,
  pedidosPendientesVista,
} from '../src/lib/pedidos';
import { db } from '../src/db/index';
import { toDexieRow } from '../src/db/normalize';
import type { Cliente, Presentacion, PedidoPendiente } from '../src/db/schema';

const VENDEDOR = 'vend-1';

const PRES: Presentacion = {
  id: 'pres-1',
  producto_base_id: 'prod-1',
  nombre: 'Multiusos 1 L',
  unidad_venta: 'litro',
  factor_conversion: 1,
  precio_mayoreo: 100,
  precio_menudeo: 130,
  activo: true,
};

async function sembrarCliente(tipo: 'mayoreo' | 'menudeo'): Promise<Cliente> {
  const cliente: Cliente = {
    id: 'cli-1',
    vendedor_id: VENDEDOR,
    nombre: 'Abarrotes La Esquina',
    tipo,
    estado: 'activo',
    ciclo_visita: 1,
    activo: true,
  };
  await db.cliente.put(toDexieRow(cliente));
  return cliente;
}

async function sembrarPedido(cantidad: number): Promise<PedidoPendiente> {
  const pedido: PedidoPendiente = {
    id: 'ped-1',
    cliente_id: 'cli-1',
    vendedor_id: VENDEDOR,
    presentacion_id: PRES.id,
    cantidad,
    fecha_compromiso: '2026-06-20',
    estado: 'pendiente',
  };
  await db.pedido_pendiente.put(pedido);
  return pedido;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.presentacion.put(toDexieRow(PRES));
});

describe('[H-05·2] entregar pedido pendiente: se convierte en venta y se cierra', () => {
  it('PEDIDO-101: crea la venta con su línea y marca el pendiente surtido', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(4);

    const res = await entregarPedido({ pedidoId: 'ped-1', fecha: '2026-06-20T10:00:00Z' });

    // Venta creada con la línea del pedido.
    const ventaDB = await db.venta.get(res.venta.id);
    expect(ventaDB).toBeTruthy();
    const lineas = await db.linea_venta.where('venta_id').equals(res.venta.id).toArray();
    expect(lineas).toHaveLength(1);
    expect(lineas[0].cantidad).toBe(4);

    // Pendiente cerrado.
    const pedidoDB = await db.pedido_pendiente.get('ped-1');
    expect(pedidoDB?.estado).toBe('surtido');
  });

  it('PEDIDO-102: congela el precio según la lista del cliente (mayoreo)', async () => {
    await sembrarCliente('mayoreo');
    await sembrarPedido(3);

    const res = await entregarPedido({ pedidoId: 'ped-1' });
    expect(res.linea.precio_unitario).toBe(100); // lista mayoreo
    expect(res.venta.total).toBe(300);
  });

  it('PEDIDO-103: la entrega descuenta inventario del vehículo', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(2);
    await db.inventario_vehiculo.put({
      id: 'inv-1',
      vendedor_id: VENDEDOR,
      presentacion_id: PRES.id,
      cantidad: 5,
    });

    await entregarPedido({ pedidoId: 'ped-1' });

    const inv = await db.inventario_vehiculo
      .where('vendedor_id')
      .equals(VENDEDOR)
      .first();
    expect(inv?.cantidad).toBe(3); // 5 − 2
  });

  it('PEDIDO-104: venta, línea y pedido entran a la cola como pending', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(1);

    await entregarPedido({ pedidoId: 'ped-1' });

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    const tablas = pendientes.map((p) => p.table_name).sort();
    expect(tablas).toContain('venta');
    expect(tablas).toContain('linea_venta');
    expect(tablas).toContain('pedido_pendiente');
  });

  it('PEDIDO-105: un pedido ya surtido no se entrega de nuevo', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(1);
    await entregarPedido({ pedidoId: 'ped-1' });

    await expect(entregarPedido({ pedidoId: 'ped-1' })).rejects.toThrow(/ya no está pendiente/);
  });

  it('PEDIDO-106: rechaza un pedido inexistente', async () => {
    await expect(entregarPedido({ pedidoId: 'nope' })).rejects.toThrow(/No existe el pedido/);
  });

  it('PEDIDO-107: pedidosPendientesDeCliente excluye los surtidos', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(1);
    expect(await pedidosPendientesDeCliente('cli-1')).toHaveLength(1);

    await entregarPedido({ pedidoId: 'ped-1' });
    expect(await pedidosPendientesDeCliente('cli-1')).toHaveLength(0);
  });

  it('PEDIDO-108: la vista resuelve el nombre de la presentación para la UI', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(3);

    const vista = await pedidosPendientesVista('cli-1');
    expect(vista).toHaveLength(1);
    expect(vista[0].nombre).toBe('Multiusos 1 L');
    expect(vista[0].cantidad).toBe(3);
    expect(vista[0].fecha_compromiso).toBe('2026-06-20');
  });
});

// ── Reagenda de la próxima visita tras entregar ───────────────
describe('entregarPedido · reagenda la próxima visita del cliente', () => {
  it('PEDIDO-109: si la visita la agendó esta entrega, queda en null al no quedar pedidos', async () => {
    // Cliente con próxima visita = la fecha de entrega del pedido (la puso la preventa).
    const cliente: Cliente = {
      id: 'cli-1', vendedor_id: VENDEDOR, nombre: 'X', tipo: 'menudeo',
      estado: 'activo', ciclo_visita: 1, fecha_proxima_visita: '2026-06-20', activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    await sembrarPedido(2); // ped-1, fecha_compromiso 2026-06-20

    await entregarPedido({ pedidoId: 'ped-1' });

    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita ?? null).toBeNull();
  });

  it('PEDIDO-110: reagenda a la siguiente entrega pendiente', async () => {
    const cliente: Cliente = {
      id: 'cli-1', vendedor_id: VENDEDOR, nombre: 'X', tipo: 'menudeo',
      estado: 'activo', ciclo_visita: 1, fecha_proxima_visita: '2026-06-20', activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    await sembrarPedido(2); // ped-1 entrega 2026-06-20
    await db.pedido_pendiente.put({
      id: 'ped-2', cliente_id: 'cli-1', vendedor_id: VENDEDOR,
      presentacion_id: PRES.id, cantidad: 1, fecha_compromiso: '2026-06-27', estado: 'pendiente',
    });

    await entregarPedido({ pedidoId: 'ped-1' });

    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-06-27');
  });

  it('PEDIDO-111: no toca una visita que no venía de esta entrega', async () => {
    // La próxima visita (de un ciclo de prospecto) no coincide con la entrega.
    const cliente: Cliente = {
      id: 'cli-1', vendedor_id: VENDEDOR, nombre: 'X', tipo: 'menudeo',
      estado: 'prospecto', ciclo_visita: 2, fecha_proxima_visita: '2026-06-15', activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    await sembrarPedido(2); // entrega 2026-06-20 ≠ 2026-06-15

    await entregarPedido({ pedidoId: 'ped-1' });

    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-06-15'); // intacta
  });
});

// ── Confirmar entrega parcial (rediseño de Visitas) ───────────
describe('confirmarEntrega · entrega parcial (entregar / reprogramar / cancelar)', () => {
  const PRES2: Presentacion = {
    id: 'pres-2', producto_base_id: 'prod-2', nombre: 'Jabón 950 ml',
    unidad_venta: 'pieza', factor_conversion: 1, precio_mayoreo: 30, precio_menudeo: 43, activo: true,
  };

  async function sembrarDos(): Promise<void> {
    await db.presentacion.put(toDexieRow(PRES2));
    await sembrarPedido(1); // ped-1, pres-1, fecha 2026-06-20
    await db.pedido_pendiente.put({
      id: 'ped-2', cliente_id: 'cli-1', vendedor_id: VENDEDOR,
      presentacion_id: PRES2.id, cantidad: 1, fecha_compromiso: '2026-06-20', estado: 'pendiente',
    });
  }

  it('ENTREGA-201: todos entregados → una sola venta con N líneas y total sumado', async () => {
    await sembrarCliente('menudeo');
    await sembrarDos();

    const res = await confirmarEntrega({
      decisiones: [
        { pedidoId: 'ped-1', accion: 'entregar' },
        { pedidoId: 'ped-2', accion: 'entregar' },
      ],
    });

    expect(res.venta).toBeTruthy();
    const lineas = await db.linea_venta.where('venta_id').equals(res.venta!.id).toArray();
    expect(lineas).toHaveLength(2);
    expect(res.total).toBe(130 + 43); // menudeo: pres-1 130 + pres-2 43
    expect(res.venta!.total).toBe(173);
    expect((await db.pedido_pendiente.get('ped-1'))?.estado).toBe('surtido');
    expect((await db.pedido_pendiente.get('ped-2'))?.estado).toBe('surtido');
  });

  it('ENTREGA-202: parcial → entregado va a la venta; reprogramado actualiza fecha y sigue pendiente', async () => {
    await sembrarCliente('menudeo');
    await sembrarDos();

    const res = await confirmarEntrega({
      decisiones: [
        { pedidoId: 'ped-1', accion: 'entregar' },
        { pedidoId: 'ped-2', accion: 'reprogramar' },
      ],
      fechaReprogramacion: '2026-07-01',
    });

    // Solo el entregado entra a la venta.
    expect(res.total).toBe(130);
    const lineas = await db.linea_venta.where('venta_id').equals(res.venta!.id).toArray();
    expect(lineas).toHaveLength(1);
    // El reprogramado sigue pendiente con la nueva fecha.
    const ped2 = await db.pedido_pendiente.get('ped-2');
    expect(ped2?.estado).toBe('pendiente');
    expect(ped2?.fecha_compromiso).toBe('2026-07-01');
  });

  it('ENTREGA-203: cancelado pasa a cancelado, sin venta ni inventario', async () => {
    await sembrarCliente('menudeo');
    await sembrarDos();
    await db.inventario_vehiculo.put({ id: 'inv-2', vendedor_id: VENDEDOR, presentacion_id: PRES2.id, cantidad: 5 });

    const res = await confirmarEntrega({
      decisiones: [
        { pedidoId: 'ped-1', accion: 'entregar' },
        { pedidoId: 'ped-2', accion: 'cancelar' },
      ],
    });

    expect(res.cancelados).toHaveLength(1);
    expect((await db.pedido_pendiente.get('ped-2'))?.estado).toBe('cancelado');
    // Inventario de pres-2 intacto (no se entregó).
    const inv2 = await db.inventario_vehiculo.get('inv-2');
    expect(inv2?.cantidad).toBe(5);
  });

  it('ENTREGA-204: inventario baja solo por los productos entregados', async () => {
    await sembrarCliente('menudeo');
    await sembrarDos();
    await db.inventario_vehiculo.put({ id: 'inv-1', vendedor_id: VENDEDOR, presentacion_id: PRES.id, cantidad: 4 });

    await confirmarEntrega({
      decisiones: [
        { pedidoId: 'ped-1', accion: 'entregar' },
        { pedidoId: 'ped-2', accion: 'cancelar' },
      ],
    });

    const inv1 = await db.inventario_vehiculo.get('inv-1');
    expect(inv1?.cantidad).toBe(3); // 4 − 1
  });

  it('ENTREGA-205: si la visita la agendó esta entrega, se reapunta al reprogramado', async () => {
    const cliente: Cliente = {
      id: 'cli-1', vendedor_id: VENDEDOR, nombre: 'X', tipo: 'menudeo',
      estado: 'activo', ciclo_visita: 1, fecha_proxima_visita: '2026-06-20', activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    await sembrarDos();

    await confirmarEntrega({
      decisiones: [
        { pedidoId: 'ped-1', accion: 'entregar' },
        { pedidoId: 'ped-2', accion: 'reprogramar' },
      ],
      fechaReprogramacion: '2026-07-01',
    });

    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-07-01');
  });

  it('ENTREGA-206: sin reprogramados ni pendientes, la visita agendada por la entrega queda en null', async () => {
    const cliente: Cliente = {
      id: 'cli-1', vendedor_id: VENDEDOR, nombre: 'X', tipo: 'menudeo',
      estado: 'activo', ciclo_visita: 1, fecha_proxima_visita: '2026-06-20', activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    await sembrarPedido(1);

    await confirmarEntrega({ decisiones: [{ pedidoId: 'ped-1', accion: 'entregar' }] });

    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita ?? null).toBeNull();
  });

  it('ENTREGA-207: reprogramar sin fecha lanza error', async () => {
    await sembrarCliente('menudeo');
    await sembrarPedido(1);
    await expect(
      confirmarEntrega({ decisiones: [{ pedidoId: 'ped-1', accion: 'reprogramar' }] })
    ).rejects.toThrow(/fecha de reprogramación/);
  });

  it('ENTREGA-208: pedidosParaEntrega calcula precio congelado e importe', async () => {
    await sembrarCliente('mayoreo');
    await sembrarPedido(3); // pres-1 mayoreo 100

    const vista = await pedidosParaEntrega('cli-1');
    expect(vista).toHaveLength(1);
    expect(vista[0].precio_unitario).toBe(100);
    expect(vista[0].importe).toBe(300);
  });
});
