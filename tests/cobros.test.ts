/**
 * Logiclean Ruta — Tests: cobranza en ruta (H-07, Flujo C)
 *
 * Trazabilidad directa con los criterios de aceptación del PRD v1.2 (Fase 5):
 *
 *  [H-07·1] Dado una venta, cuando registro un cobro, entonces capturo el monto
 *           y la forma de pago (efectivo o transferencia).
 *           → COBRO-101, COBRO-102
 *
 *  [H-07·2] Dado una venta, cuando registro cobro total, parcial o a crédito,
 *           entonces el saldo del cliente refleja lo pendiente.
 *           → COBRO-201 (total), COBRO-202 (parcial), COBRO-203 (crédito)
 *
 *  [H-07·3] Dada una venta liquidada en varios momentos, cuando registro cada
 *           cobro, entonces cada uno conserva su propia forma de pago.
 *           → COBRO-301, COBRO-302
 *
 * Además: derivación de saldo siempre calculada (nunca almacenada), offline-first
 * (todo cobro entra a la cola como 'pending'), y asignación FIFO por cliente.
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

import {
  registrarCobro,
  registrarCobroCliente,
  cobrosDeVenta,
  saldoDeVenta,
  desgloseCliente,
  saldoDerivado,
  sumaCobros,
  tipoCobro,
  clientesConSaldo,
} from '../src/lib/cobros';
import { registrarVenta } from '../src/lib/ventas';
import { db } from '../src/db/index';
import type { Venta } from '../src/db/schema';

const VENDEDOR = 'vend-1';
const CLIENTE = 'cli-1';

/** Inserta una venta directa en la BD local (sin pasar por el flujo de venta). */
async function sembrarVenta(id: string, total: number, fecha: string): Promise<Venta> {
  const venta: Venta = {
    id,
    vendedor_id: VENDEDOR,
    cliente_id: CLIENTE,
    fecha,
    requiere_factura: false,
    total,
  };
  await db.venta.put(venta);
  return venta;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

// ── Helpers puros ─────────────────────────────────────────────

describe('derivación de saldo (helpers puros)', () => {
  it('sumaCobros y saldoDerivado calculan ventas − cobros, nunca negativo', () => {
    const cobros = [{ monto: 100 }, { monto: 86 }];
    expect(sumaCobros(cobros)).toBe(186);
    expect(saldoDerivado(386, cobros)).toBe(200);
    // Sobrepago no produce saldo negativo.
    expect(saldoDerivado(150, cobros)).toBe(0);
  });

  it('tipoCobro: total cuando cubre el total de la venta, parcial si abona', () => {
    expect(tipoCobro(386, 386)).toBe('total');
    expect(tipoCobro(200, 386)).toBe('parcial');
  });
});

// ── [H-07·1] capturo monto y forma de pago ────────────────────

describe('[H-07·1] registrar cobro captura monto y forma de pago', () => {
  it('COBRO-101: registra un cobro en efectivo con su monto', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');

    const cobro = await registrarCobro({
      ventaId: 'v1',
      monto: 386,
      forma_pago: 'efectivo',
    });

    expect(cobro.monto).toBe(386);
    expect(cobro.forma_pago).toBe('efectivo');

    const enDB = await db.cobro.get(cobro.id);
    expect(enDB?.monto).toBe(386);
    expect(enDB?.forma_pago).toBe('efectivo');
  });

  it('COBRO-102: registra un cobro por transferencia (única otra forma válida)', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');

    const cobro = await registrarCobro({
      ventaId: 'v1',
      monto: 386,
      forma_pago: 'transferencia',
    });

    expect(cobro.forma_pago).toBe('transferencia');
  });

  it('COBRO-103: rechaza monto cero o negativo y venta inexistente', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');
    await expect(
      registrarCobro({ ventaId: 'v1', monto: 0, forma_pago: 'efectivo' })
    ).rejects.toThrow(/mayor a cero/);
    await expect(
      registrarCobro({ ventaId: 'nope', monto: 10, forma_pago: 'efectivo' })
    ).rejects.toThrow(/No existe la venta/);
  });

  it('COBRO-104: el cobro entra a la cola de sync como pending (offline-first)', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'v1', monto: 386, forma_pago: 'efectivo' });

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    expect(pendientes.map((p) => p.table_name)).toContain('cobro');
    expect(pendientes.every((p) => p.status === 'pending')).toBe(true);
  });
});

// ── [H-07·2] el saldo del cliente refleja lo pendiente ────────

describe('[H-07·2] cobro total / parcial / crédito y saldo derivado', () => {
  it('COBRO-201: cobro total deja el saldo del cliente en cero', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'v1', monto: 386, forma_pago: 'efectivo' });

    expect(await saldoDeVenta('v1')).toBe(0);
    const d = await desgloseCliente(CLIENTE);
    expect(d.saldoTotal).toBe(0);
    expect(d.ventasConSaldo).toHaveLength(0);
  });

  it('COBRO-202: cobro parcial deja saldo pendiente = total − abonado', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'v1', monto: 200, forma_pago: 'efectivo' });

    expect(await saldoDeVenta('v1')).toBe(186);
    const d = await desgloseCliente(CLIENTE);
    expect(d.saldoTotal).toBe(186);
    expect(d.ventasConSaldo).toHaveLength(1);
    expect(d.ventasConSaldo[0].cobrado).toBe(200);
  });

  it('COBRO-203: venta a crédito = sin fila en COBRO; saldo = total completo', async () => {
    // Modela el crédito por AUSENCIA de cobro (regla del handoff).
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');

    expect(await cobrosDeVenta('v1')).toHaveLength(0);
    expect(await saldoDeVenta('v1')).toBe(386);
    const d = await desgloseCliente(CLIENTE);
    expect(d.saldoTotal).toBe(386);
  });

  it('COBRO-204: el saldo se deriva (no se almacena) y agrega varias ventas', async () => {
    await sembrarVenta('v1', 186, '2026-05-28T10:00:00Z');
    await sembrarVenta('v2', 454, '2026-06-02T10:00:00Z');

    const d = await desgloseCliente(CLIENTE);
    expect(d.saldoTotal).toBe(640); // 186 + 454, sin cobros
    expect(d.ventas).toHaveLength(2);
    // Desglosado por venta, de la más antigua a la más reciente.
    expect(d.ventas[0].venta.id).toBe('v1');
    expect(d.ventas[1].venta.id).toBe('v2');
  });

  it('COBRO-205: integra con registrarVenta (Flujo A) — venta sin cobro queda a crédito', async () => {
    await db.inventario_vehiculo.put({
      id: 'inv-1',
      vendedor_id: VENDEDOR,
      presentacion_id: 'pres-1',
      cantidad: 10,
    });
    const res = await registrarVenta({
      vendedorId: VENDEDOR,
      cliente: { id: CLIENTE, tipo: 'menudeo' },
      lineasVehiculo: [
        {
          presentacion: {
            id: 'pres-1',
            precio_mayoreo: 100,
            precio_menudeo: 130,
          },
          cantidad: 2,
        },
      ],
      // sin cobro → a crédito
    });
    expect(res.cobro).toBeNull();
    expect(await saldoDeVenta(res.venta.id)).toBe(260);
  });
});

// ── [H-07·3] cada cobro conserva su propia forma de pago ──────

describe('[H-07·3] liquidación en varios momentos: cada cobro su forma de pago', () => {
  it('COBRO-301: tres cobros con tres formas distintas; el saldo llega a cero', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');

    await registrarCobro({ ventaId: 'v1', monto: 100, forma_pago: 'efectivo', fecha: '2026-06-02T10:00:00Z' });
    await registrarCobro({ ventaId: 'v1', monto: 100, forma_pago: 'transferencia', fecha: '2026-06-09T10:00:00Z' });
    await registrarCobro({ ventaId: 'v1', monto: 186, forma_pago: 'efectivo', fecha: '2026-06-16T10:00:00Z' });

    const cobros = await cobrosDeVenta('v1');
    expect(cobros).toHaveLength(3);
    // Cada cobro conserva su propia forma de pago, en orden cronológico.
    expect(cobros.map((c) => c.forma_pago)).toEqual([
      'efectivo',
      'transferencia',
      'efectivo',
    ]);
    expect(cobros.map((c) => c.monto)).toEqual([100, 100, 186]);

    // Saldo derivado liquidado.
    expect(await saldoDeVenta('v1')).toBe(0);
  });

  it('COBRO-302: el desglose conserva el historial con cada forma de pago', async () => {
    await sembrarVenta('v1', 386, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'v1', monto: 100, forma_pago: 'efectivo', fecha: '2026-06-02T10:00:00Z' });
    await registrarCobro({ ventaId: 'v1', monto: 100, forma_pago: 'transferencia', fecha: '2026-06-09T10:00:00Z' });

    const d = await desgloseCliente(CLIENTE);
    expect(d.historial).toHaveLength(2);
    // Historial del más reciente al más antiguo.
    expect(d.historial[0].forma_pago).toBe('transferencia');
    expect(d.historial[1].forma_pago).toBe('efectivo');
    expect(d.saldoTotal).toBe(186);
  });
});

// ── Cobro a nivel cliente (FIFO) — soporte de P3 ──────────────

describe('registrarCobroCliente: asignación FIFO sobre ventas con saldo', () => {
  it('COBRO-401: un cobro que abarca dos ventas genera un cobro por venta', async () => {
    await sembrarVenta('v1', 186, '2026-05-28T10:00:00Z');
    await sembrarVenta('v2', 454, '2026-06-02T10:00:00Z');

    const creados = await registrarCobroCliente({
      clienteId: CLIENTE,
      monto: 640,
      forma_pago: 'efectivo',
    });

    expect(creados).toHaveLength(2);
    // FIFO: primero liquida la venta más antigua.
    expect(creados[0].venta_id).toBe('v1');
    expect(creados[0].monto).toBe(186);
    expect(creados[1].venta_id).toBe('v2');
    expect(creados[1].monto).toBe(454);

    expect((await desgloseCliente(CLIENTE)).saldoTotal).toBe(0);
  });

  it('COBRO-402: un abono parcial se aplica a la venta más antigua primero', async () => {
    await sembrarVenta('v1', 186, '2026-05-28T10:00:00Z');
    await sembrarVenta('v2', 454, '2026-06-02T10:00:00Z');

    const creados = await registrarCobroCliente({
      clienteId: CLIENTE,
      monto: 200,
      forma_pago: 'transferencia',
    });

    // 186 liquidan v1; 14 abonan v2.
    expect(creados).toHaveLength(2);
    expect(creados[0].monto).toBe(186);
    expect(creados[1].monto).toBe(14);

    const d = await desgloseCliente(CLIENTE);
    expect(d.saldoTotal).toBe(440);
    expect(d.ventasConSaldo).toHaveLength(1);
    expect(d.ventasConSaldo[0].venta.id).toBe('v2');
  });

  it('COBRO-403: rechaza cobrar si el cliente no tiene saldo pendiente', async () => {
    await sembrarVenta('v1', 100, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'v1', monto: 100, forma_pago: 'efectivo' });

    await expect(
      registrarCobroCliente({ clienteId: CLIENTE, monto: 50, forma_pago: 'efectivo' })
    ).rejects.toThrow(/no tiene saldo pendiente/);
  });
});

// ── [D-002] cobros pendientes: clientes con saldo fuera de la ruta ────

describe('[D-002] clientesConSaldo lista clientes con deuda (sin importar visita)', () => {
  /** Inserta una venta para un cliente arbitrario (distinto del CLIENTE base). */
  async function sembrarVentaCliente(
    id: string,
    clienteId: string,
    total: number,
    fecha: string
  ): Promise<void> {
    await db.venta.put({
      id,
      vendedor_id: VENDEDOR,
      cliente_id: clienteId,
      fecha,
      requiere_factura: false,
      total,
    });
  }

  it('COBRO-501: devuelve solo clientes con saldo > 0, de mayor a menor', async () => {
    // Cliente A: debe 500. Cliente B: liquidado (saldo 0). Cliente C: debe 200.
    await sembrarVentaCliente('va', 'cli-A', 500, '2026-06-01T10:00:00Z');
    await sembrarVentaCliente('vb', 'cli-B', 300, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'vb', monto: 300, forma_pago: 'efectivo' });
    await sembrarVentaCliente('vc', 'cli-C', 200, '2026-06-01T10:00:00Z');

    const clientes = [
      { id: 'cli-A', nombre: 'Abarrotes A', tipo: 'mayoreo' as const },
      { id: 'cli-B', nombre: 'Bodega B', tipo: 'menudeo' as const },
      { id: 'cli-C', nombre: 'Cafetería C', tipo: 'menudeo' as const },
    ];

    const pendientes = await clientesConSaldo(clientes);

    // B (liquidado) queda fuera; A y C presentes, ordenados por saldo desc.
    expect(pendientes.map((p) => p.clienteId)).toEqual(['cli-A', 'cli-C']);
    expect(pendientes[0].saldoTotal).toBe(500);
    expect(pendientes[0].ventasPendientes).toBe(1);
    expect(pendientes[1].saldoTotal).toBe(200);
  });

  it('COBRO-502: lista vacía cuando nadie debe', async () => {
    await sembrarVentaCliente('vx', 'cli-X', 100, '2026-06-01T10:00:00Z');
    await registrarCobro({ ventaId: 'vx', monto: 100, forma_pago: 'efectivo' });

    const pendientes = await clientesConSaldo([
      { id: 'cli-X', nombre: 'Cliente X', tipo: 'menudeo' as const },
    ]);
    expect(pendientes).toEqual([]);
  });
});
