/**
 * Logiclean Ruta — Tests: registro de venta offline (H-04, H-05, H-07)
 *
 * Ejercita la persistencia real en Dexie (fake-indexeddb) con el motor de sync
 * mockeado (en node no hay `window`, y aquí solo importa que se escriba local y
 * se encole, no el envío real).
 *
 * VENTA-001: la línea congela el precio de la lista del cliente (mayoreo)
 * VENTA-002: menudeo congela la otra lista
 * VENTA-003: confirmar la venta descuenta el inventario del vehículo
 * VENTA-004: el pedido pendiente NO toca inventario (H-05)
 * VENTA-005: cobro total → tipo 'total' y saldo 0; parcial → 'parcial' y saldo
 * VENTA-006: todo entra a la cola de sync como 'pending' (offline-first)
 * VENTA-007: una venta sin líneas ni pedidos es rechazada
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// El singleton real de SyncEngine registra listeners de `window` al construirse
// (no existe en node). Se mockea con métodos no-op.
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: {
    enqueueAndSync: vi.fn(async () => {}),
    refreshPendingCount: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {}),
  },
}));

import { registrarVenta } from '../src/lib/ventas';
import { db } from '../src/db/index';
import { toDexieRow } from '../src/db/normalize';
import type { Cliente } from '../src/db/schema';

const VENDEDOR = 'vend-1';
const PRES = {
  id: 'pres-1',
  producto_base_id: 'prod-1',
  nombre: 'Multiusos 1 L',
  unidad_venta: 'litro',
  factor_conversion: 1,
  precio_mayoreo: 100,
  precio_menudeo: 130,
  activo: true,
};

async function cargarInventario(cantidad: number) {
  await db.inventario_vehiculo.put({
    id: 'inv-1',
    vendedor_id: VENDEDOR,
    presentacion_id: PRES.id,
    cantidad,
  });
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('registrarVenta', () => {
  it('VENTA-001/003: mayoreo congela precio_mayoreo y descuenta inventario', async () => {
    await cargarInventario(10);

    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
    });

    expect(res.venta.total).toBe(300);
    expect(res.lineas[0].precio_unitario).toBe(100);

    const ventaDB = await db.venta.get(res.venta.id);
    expect(ventaDB?.total).toBe(300);

    // Inventario descontado: 10 − 3 = 7
    const inv = await db.inventario_vehiculo
      .where('vendedor_id')
      .equals(VENDEDOR)
      .first();
    expect(inv?.cantidad).toBe(7);
  });

  it('VENTA-002: menudeo congela precio_menudeo', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-2', tipo: 'menudeo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 2 }],
    });
    expect(res.lineas[0].precio_unitario).toBe(130);
    expect(res.venta.total).toBe(260);
  });

  it('VENTA-004: el pedido pendiente no toca inventario', async () => {
    await cargarInventario(5);

    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [],
      pedidos: [
        { presentacion_id: PRES.id, cantidad: 4, fecha_compromiso: '2026-06-20' },
      ],
    });

    expect(res.pedidos).toHaveLength(1);
    expect(res.pedidos[0].estado).toBe('pendiente');

    const pedidoDB = await db.pedido_pendiente.get(res.pedidos[0].id);
    expect(pedidoDB?.cantidad).toBe(4);

    // Inventario intacto.
    const inv = await db.inventario_vehiculo
      .where('vendedor_id')
      .equals(VENDEDOR)
      .first();
    expect(inv?.cantidad).toBe(5);
  });

  it('VENTA-005a: cobro total → tipo "total" y saldo 0', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
      cobro: { monto: 300, forma_pago: 'efectivo' },
    });
    expect(res.cobro?.tipo).toBe('total');
    expect(res.saldo).toBe(0);
  });

  it('VENTA-005b: cobro parcial → tipo "parcial" y saldo pendiente', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
      cobro: { monto: 100, forma_pago: 'transferencia' },
    });
    expect(res.cobro?.tipo).toBe('parcial');
    expect(res.cobro?.forma_pago).toBe('transferencia');
    expect(res.saldo).toBe(200);
  });

  it('VENTA-006: venta, línea, inventario y cobro entran a la cola como pending', async () => {
    await cargarInventario(10);
    await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
      cobro: { monto: 300, forma_pago: 'efectivo' },
    });

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    const tablas = pendientes.map((p) => p.table_name).sort();
    expect(tablas).toEqual(
      ['cobro', 'inventario_vehiculo', 'linea_venta', 'venta'].sort()
    );
  });

  it('VENTA-007: rechaza una venta sin líneas ni pedidos', async () => {
    await expect(
      registrarVenta({
        vendedorId: VENDEDOR,
        cliente: { id: 'cli-1', tipo: 'mayoreo' },
        lineasVehiculo: [],
      })
    ).rejects.toThrow(/no tiene líneas ni pedidos/);
  });

  it('VENTA-008: venta facturable → total = subtotal + IVA (H-06)', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }], // subtotal 300
      requiereFactura: true,
    });
    expect(res.subtotal).toBe(300);
    expect(res.iva).toBe(48); // 16% de 300
    expect(res.venta.total).toBe(348);

    const ventaDB = await db.venta.get(res.venta.id);
    expect(ventaDB?.requiere_factura).toBe(true);
    expect(ventaDB?.total).toBe(348);
  });

  it('VENTA-009: facturable con cobro total cubre el monto con IVA; saldo 0', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
      requiereFactura: true,
      cobro: { monto: 348, forma_pago: 'efectivo' },
    });
    expect(res.cobro?.tipo).toBe('total');
    expect(res.saldo).toBe(0);
  });

  it('VENTA-010: venta no facturable no aplica IVA', async () => {
    await cargarInventario(10);
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'mayoreo' },
      lineasVehiculo: [{ presentacion: PRES, cantidad: 3 }],
    });
    expect(res.iva).toBe(0);
    expect(res.venta.total).toBe(300);
  });
});

// ── Pedido pendiente agenda la visita de entrega ──────────────
describe('registrarVenta · agenda la entrega del pedido', () => {
  async function sembrarCliente(fechaProxima: string | null): Promise<Cliente> {
    const cliente: Cliente = {
      id: 'cli-1',
      vendedor_id: VENDEDOR,
      nombre: 'Abarrotes La Esquina',
      tipo: 'menudeo',
      estado: 'activo',
      ciclo_visita: 1,
      dia_ruta: null,
      fecha_proxima_visita: fechaProxima,
      activo: true,
    };
    await db.cliente.put(toDexieRow(cliente));
    return cliente;
  }

  it('VENTA-011: la próxima visita se agenda en la fecha de entrega', async () => {
    await sembrarCliente(null);
    await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'menudeo' },
      lineasVehiculo: [],
      pedidos: [{ presentacion_id: PRES.id, cantidad: 2, fecha_compromiso: '2026-06-20' }],
    });
    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-06-20');
  });

  it('VENTA-012: toma la entrega más próxima de varios pedidos', async () => {
    await sembrarCliente(null);
    await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'menudeo' },
      lineasVehiculo: [],
      pedidos: [
        { presentacion_id: PRES.id, cantidad: 2, fecha_compromiso: '2026-06-25' },
        { presentacion_id: PRES.id, cantidad: 1, fecha_compromiso: '2026-06-18' },
      ],
    });
    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-06-18');
  });

  it('VENTA-013: no retrasa una visita ya agendada antes de la entrega', async () => {
    await sembrarCliente('2026-06-10');
    await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: 'cli-1', tipo: 'menudeo' },
      lineasVehiculo: [],
      pedidos: [{ presentacion_id: PRES.id, cantidad: 2, fecha_compromiso: '2026-06-20' }],
    });
    const cli = await db.cliente.get('cli-1');
    expect(cli?.fecha_proxima_visita).toBe('2026-06-10'); // se respeta la más próxima
  });
});
