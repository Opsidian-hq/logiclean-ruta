/**
 * Logiclean Ruta — Tests Inc 7.4: puente UI del corte por reparto (H-20)
 *
 * El motor de dominio (Inc 7.1, `tests/corte-reparto.test.ts`) ya cubre las
 * reglas de cálculo (V, T, posiciones, liquidación, tope, arrastre). Esta
 * suite cubre lo que agrega Inc 7.4 — la capa que deriva sus insumos desde
 * Dexie y persiste el resultado — trazado a los criterios de aceptación del
 * PRD delta v1.4 (§5):
 *
 * CR-001/002: Paso 1 — bolsa reconciliada y CxC nueva del periodo, por vendedor.
 * CR-003 (R9, no negociable): cobro de este periodo sobre una venta ANTERIOR
 *   al periodo es `cobro_cxc_vieja`, no `cxc_nueva` — no se cuenta dos veces.
 * CR-004: los cobros/gastos fuera del periodo (o de otro vendedor) no entran.
 * CR-005: Paso 6 — arrastre entrante = apertura del corte anterior (por
 *   vendedor y negocio↔La Moderna); primer corte tras cutover abre en cero.
 * CR-006: Paso 2 — adeudo a La Moderna e identidad de control (Inc 6),
 *   leídos del periodo, no recalculados.
 * CR-007: Paso 2 — inventario sellado disponible para acopio (solo
 *   productos en bidón, con stock > 0).
 * CR-008: confirmarCorte persiste corte + corte_vendedor + liquidacion en un
 *   solo lote offline-first, como evento de cierre confirmado (append-only).
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

import { db } from '../src/db/index';
import {
  cargarApertura,
  derivarVendedorEntrada,
  cargarNegocioEntrada,
  cargarSelladosDisponibles,
  confirmarCorte,
} from '../src/lib/corteReparto';
import type { CorteSalida, VendedorEntrada, NegocioEntrada } from '../src/domain/corte';
import type { Venta, Cobro, Gasto, Corte, CorteVendedor } from '../src/db/schema';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

// ── Paso 1: derivarVendedorEntrada (bolsa + CxC nueva vs. vieja) ────────

describe('derivarVendedorEntrada', () => {
  const periodoInicio = '2026-07-01';
  const periodoFin = '2026-07-07';

  async function seed() {
    const ventas: Venta[] = [
      { id: 'venta-vieja', vendedor_id: 'v1', cliente_id: 'c1', fecha: '2026-06-25', requiere_factura: false, total: 1000 },
      { id: 'venta-nueva', vendedor_id: 'v1', cliente_id: 'c1', fecha: '2026-07-02', requiere_factura: false, total: 2000 },
      { id: 'venta-frontera', vendedor_id: 'v1', cliente_id: 'c1', fecha: periodoInicio, requiere_factura: false, total: 500 },
      { id: 'venta-otro-vendedor', vendedor_id: 'v2', cliente_id: 'c1', fecha: '2026-07-03', requiere_factura: false, total: 999 },
    ];
    const cobros: Cobro[] = [
      // Cobro de este periodo sobre la venta VIEJA (R9): no es ingreso nuevo.
      { id: 'cobro-1', venta_id: 'venta-vieja', fecha: '2026-07-03', monto: 400, forma_pago: 'efectivo', tipo: 'parcial' },
      // Cobro de este periodo sobre la venta NUEVA: reduce cxc_nueva.
      { id: 'cobro-2', venta_id: 'venta-nueva', fecha: '2026-07-04', monto: 1200, forma_pago: 'transferencia', tipo: 'parcial' },
      // Fuera del periodo: no debe contarse en absoluto.
      { id: 'cobro-fuera', venta_id: 'venta-nueva', fecha: '2026-07-10', monto: 500, forma_pago: 'efectivo', tipo: 'parcial' },
      // Cobro de otro vendedor: no debe filtrarse hacia v1.
      { id: 'cobro-otro', venta_id: 'venta-otro-vendedor', fecha: '2026-07-03', monto: 999, forma_pago: 'efectivo', tipo: 'total' },
    ];
    const gastos: Gasto[] = [
      { id: 'gasto-ruta', vendedor_id: 'v1', tipo: 'ruta', categoria: 'Gasolina', fecha: '2026-07-05', monto: 100, forma_pago: 'efectivo' },
      // Gasto fuera del periodo: no debe netear la bolsa.
      { id: 'gasto-fuera', vendedor_id: 'v1', tipo: 'ruta', categoria: 'Gasolina', fecha: '2026-06-20', monto: 9999, forma_pago: 'efectivo' },
    ];
    await db.venta.bulkAdd(ventas);
    await db.cobro.bulkAdd(cobros);
    await db.gasto.bulkAdd(gastos);
  }

  it('CR-001/CR-002: bolsa neta de ruta y CxC nueva del periodo', async () => {
    await seed();
    const entrada = await derivarVendedorEntrada('v1', periodoInicio, periodoFin, 0);

    // efectivo: 400 (cobro-1, vieja) − 100 (gasto ruta) = 300.
    expect(entrada.efectivo_cobrado_neto).toBe(300);
    // transferencia: 1200 (cobro-2, nueva).
    expect(entrada.transfer_cobrado_neto).toBe(1200);
    // cxc_nueva = venta-nueva (2000) − cobrado sobre ventas nuevas (1200) = 800.
    // venta-frontera (fecha == periodoInicio) NO entra al periodo (exclusivo).
    expect(entrada.cxc_nueva).toBe(800);
  });

  it('CR-003 (R9, no negociable): cobro sobre venta anterior es cobro_cxc_vieja, no ingreso', async () => {
    await seed();
    const entrada = await derivarVendedorEntrada('v1', periodoInicio, periodoFin, -400);

    expect(entrada.cobro_cxc_vieja).toBe(400);
    // El arrastre de apertura (-400) queda saldado por el cobro_cxc_vieja
    // exactamente igual — el motor de dominio (Inc 7.1) es quien lo salda;
    // aquí solo verificamos que la derivación entrega el valor separado.
    expect(entrada.saldo_vendedor_apertura).toBe(-400);
  });

  it('CR-004: cobros/gastos fuera del periodo o de otro vendedor no entran', async () => {
    await seed();
    const entrada = await derivarVendedorEntrada('v1', periodoInicio, periodoFin, 0);
    // Si "cobro-fuera" (500) o "cobro-otro" (999, de v2) se filtraran, el
    // efectivo o la CxC de v1 cambiarían de los valores esperados arriba.
    expect(entrada.efectivo_cobrado_neto).toBe(300);
    expect(entrada.cxc_nueva).toBe(800);
  });

  it('venta en la fecha exacta de periodoInicio no cuenta (ventana exclusiva por el inicio)', async () => {
    await seed();
    const entrada = await derivarVendedorEntrada('v1', periodoInicio, periodoFin, 0);
    // Si venta-frontera (500, fecha == periodoInicio) contara, cxc_nueva subiría a 1300.
    expect(entrada.cxc_nueva).toBe(800);
  });
});

// ── Paso 6 / arrastre entrante: cargarApertura ──────────────────────────

describe('cargarApertura', () => {
  it('CR-005: primer corte tras el cutover abre en cero (sin corte previo)', async () => {
    const apertura = await cargarApertura();
    expect(apertura.corte).toBeNull();
    expect(apertura.porVendedor.size).toBe(0);
    expect(apertura.moderna).toBe(0);
  });

  it('CR-005: lee apertura = cierre del corte confirmado más reciente', async () => {
    const corteViejo: Corte = {
      id: 'corte-1', periodo_inicio: '', periodo_fin: '2026-06-28', fecha_generado: '2026-06-28T12:00:00Z',
      estado: 'confirmado', n_vendedores: 2, ventas_periodo: 0, adeudo_la_moderna: 0, backoffice_pendiente: 0,
      obligaciones_total: 0, pool_liquido: 0, v_remanente: 0, t_por_vendedor: 0,
      saldo_moderna_apertura: 0, saldo_moderna_cierre: 600, snapshot: {},
    };
    const corteReciente: Corte = { ...corteViejo, id: 'corte-2', periodo_fin: '2026-07-05', saldo_moderna_cierre: 1110 };
    await db.corte.bulkAdd([corteViejo, corteReciente]);

    const lineaVieja: CorteVendedor = {
      id: 'cv-1', corte_id: 'corte-1', vendedor_id: 'v-iv', efectivo_cobrado_neto: 0, transfer_cobrado_neto: 0,
      cxc_nueva: 0, cobro_cxc_vieja: 0, posicion_objetivo: 0, efectivo_entregado: 0,
      saldo_vendedor_apertura: 0, saldo_vendedor_cierre: -250,
    };
    const lineaReciente: CorteVendedor = { ...lineaVieja, id: 'cv-2', corte_id: 'corte-2', saldo_vendedor_cierre: -760 };
    await db.corte_vendedor.bulkAdd([lineaVieja, lineaReciente]);

    const apertura = await cargarApertura();
    expect(apertura.corte?.id).toBe('corte-2');
    expect(apertura.porVendedor.get('v-iv')).toBe(-760);
    expect(apertura.moderna).toBe(1110);
  });
});

// ── Paso 2: cargarNegocioEntrada (adeudo + identidad de control) ───────

describe('cargarNegocioEntrada', () => {
  it('CR-006: deriva adeudo a La Moderna, identidad de control y backoffice del periodo', async () => {
    await db.producto_base.add({ id: 'pb-cloro', nombre: 'Cloro', unidad_compra: 'bidon', categoria: 'quimicos', precio_preferencial: 45, activo: true });
    await db.suministro_la_moderna.add({ id: 's1', producto_base_id: 'pb-cloro', fecha: '2026-07-03', cantidad_recibida: 96, cantidad_devuelta: 44 });
    await db.envasado.add({ id: 'e1', producto_base_id: 'pb-cloro', fecha: '2026-07-04', litros_envasados: 0, bidones_abiertos: 52, responsable_id: 'g1' });
    await db.gasto.add({ id: 'g1', vendedor_id: null, tipo: 'backoffice', categoria: 'Renta', fecha: '2026-07-02', monto: 380, forma_pago: 'efectivo' });

    const insumos = await cargarNegocioEntrada('2026-07-01', '2026-07-07', 0);

    expect(insumos.negocio.adeudo_la_moderna).toBe((96 - 44) * 45);
    expect(insumos.backofficeTotal).toBe(380);
    expect(insumos.identidadControl).toEqual([
      { producto_base_id: 'pb-cloro', nombre: 'Cloro', recibido: 96, devuelto: 44, bidonesAbiertos: 52, diferencia: 0, cuadra: true },
    ]);
  });

  it('CR-006: alerta de descuadre cuando recibido − devuelto ≠ bidones abiertos', async () => {
    await db.producto_base.add({ id: 'pb-cloro', nombre: 'Cloro', unidad_compra: 'bidon', categoria: 'quimicos', precio_preferencial: 45, activo: true });
    await db.suministro_la_moderna.add({ id: 's1', producto_base_id: 'pb-cloro', fecha: '2026-07-03', cantidad_recibida: 96, cantidad_devuelta: 44 });
    await db.envasado.add({ id: 'e1', producto_base_id: 'pb-cloro', fecha: '2026-07-04', litros_envasados: 0, bidones_abiertos: 48, responsable_id: 'g1' });

    const insumos = await cargarNegocioEntrada('2026-07-01', '2026-07-07', 0);
    expect(insumos.identidadControl[0].cuadra).toBe(false);
    expect(insumos.identidadControl[0].diferencia).toBe(4);
  });
});

// ── Paso 2: cargarSelladosDisponibles (acopio hacia La Moderna) ────────

describe('cargarSelladosDisponibles', () => {
  it('CR-007: productos en bidón con stock > 0', async () => {
    await db.producto_base.bulkAdd([
      { id: 'pb-cloro', nombre: 'Cloro', unidad_compra: 'bidon', categoria: 'quimicos', activo: true },
      { id: 'pb-jabon', nombre: 'Jabón', unidad_compra: 'bidon', categoria: 'quimicos', activo: true },
    ]);
    await db.inventario_bodega_base.bulkAdd([
      { id: 'ib-1', producto_base_id: 'pb-cloro', bidones_disponibles: 30, litros_granel_estimado: 0 },
      { id: 'ib-3', producto_base_id: 'pb-jabon', bidones_disponibles: 0, litros_granel_estimado: 0 },
    ]);

    const sellados = await cargarSelladosDisponibles();
    expect(sellados).toEqual([{ productoBaseId: 'pb-cloro', nombre: 'Cloro', disponibles: 30 }]);
  });

  it('CR-007: productos en docena (escobas/trapeadores) vía su presentación "pieza"', async () => {
    await db.producto_base.bulkAdd([
      { id: 'pb-escoba', nombre: 'Escoba', unidad_compra: 'docena', categoria: 'escobas', activo: true },
      { id: 'pb-trapeador', nombre: 'Trapeador', unidad_compra: 'docena', categoria: 'trapeadores', activo: true },
      { id: 'pb-papel', nombre: 'Papel institucional', unidad_compra: 'docena', categoria: 'papel_institucional', activo: true },
    ]);
    await db.presentacion.bulkAdd([
      { id: 'pres-escoba-pieza', producto_base_id: 'pb-escoba', nombre: 'Pieza', unidad_venta: 'pieza', factor_conversion: 12, precio_mayoreo: 0, precio_menudeo: 0, activo: true },
      { id: 'pres-trapeador-pieza', producto_base_id: 'pb-trapeador', nombre: 'Pieza', unidad_venta: 'pieza', factor_conversion: 12, precio_mayoreo: 0, precio_menudeo: 0, activo: true },
      // papel_institucional no tiene presentación 'pieza' (usa 'paquete'): fuera de la cadena de bodega.
      { id: 'pres-papel-paquete', producto_base_id: 'pb-papel', nombre: 'Paquete', unidad_venta: 'paquete', factor_conversion: 1, precio_mayoreo: 0, precio_menudeo: 0, activo: true },
    ]);
    await db.inventario_bodega_presentacion.bulkAdd([
      { id: 'ibp-escoba', presentacion_id: 'pres-escoba-pieza', cantidad: 30 },
      { id: 'ibp-trapeador', presentacion_id: 'pres-trapeador-pieza', cantidad: 0 },
      { id: 'ibp-papel', presentacion_id: 'pres-papel-paquete', cantidad: 50 },
    ]);

    const sellados = await cargarSelladosDisponibles();
    // 30 piezas / 12 (factor_conversion) = 2.5 docenas disponibles.
    expect(sellados).toEqual([{ productoBaseId: 'pb-escoba', nombre: 'Escoba', disponibles: 2.5 }]);
  });
});

// ── Paso 6: confirmarCorte (persistencia offline-first, append-only) ──

describe('confirmarCorte', () => {
  it('CR-008: escribe corte + corte_vendedor + liquidacion_movimiento en un solo lote, confirmado', async () => {
    const vendedoresEntrada: VendedorEntrada[] = [
      { vendedor_id: 'v1', efectivo_cobrado_neto: 5000, transfer_cobrado_neto: 3000, cxc_nueva: 2000, cobro_cxc_vieja: 0, saldo_vendedor_apertura: 0 },
    ];
    const negocio: NegocioEntrada = { adeudo_la_moderna: 3000, backoffice_pendiente: 500, saldo_moderna_apertura: 0 };
    const salida: CorteSalida = {
      ventas_periodo: 10000, obligaciones_total: 3500, pool_liquido: 8000, v_remanente: 6500, t_por_vendedor: 6500,
      disponible_obligaciones: 8000,
      por_vendedor: [{ vendedor_id: 'v1', posicion_objetivo: 4500, efectivo_entregado: 4500, saldo_vendedor_cierre: 0 }],
      saldo_moderna_cierre: 0,
      liquidacion: [{ origen_tipo: 'vendedor', origen_vendedor_id: 'v1', destino_tipo: 'la_moderna', destino_vendedor_id: null, monto: 3000, forma_pago: 'efectivo' }],
      alertas: [],
    };

    const { corte, corteVendedor, liquidacion } = await confirmarCorte({
      periodoInicio: '2026-07-01', periodoFin: '2026-07-07', nVendedores: 1, vendedoresEntrada, negocio, salida,
    });

    expect(corte.estado).toBe('confirmado');
    expect(corte.n_vendedores).toBe(1);
    expect(corte.v_remanente).toBe(6500);
    expect(corteVendedor).toHaveLength(1);
    expect(corteVendedor[0].posicion_objetivo).toBe(4500);
    expect(liquidacion).toHaveLength(1);

    expect(await db.corte.get(corte.id)).toBeTruthy();
    expect(await db.corte_vendedor.get(corteVendedor[0].id)).toBeTruthy();
    expect(await db.liquidacion_movimiento.get(liquidacion[0].id)).toBeTruthy();

    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(3);
    expect(cola.map((c) => c.table_name).sort()).toEqual(['corte', 'corte_vendedor', 'liquidacion_movimiento']);
    expect(cola.every((c) => c.status === 'pending')).toBe(true);
  });
});
