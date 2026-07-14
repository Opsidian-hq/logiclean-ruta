/**
 * Logiclean Ruta — Corte por reparto: insumos y persistencia (H-20, Inc 7.4)
 *
 * Puente entre Dexie y el motor de dominio puro (`src/domain/corte/`): cada
 * función aquí *deriva* o *persiste* datos, nunca recalcula lo que el motor
 * ya resuelve (V, T, posiciones, liquidación, arrastre). El stepper (Inc 7.4)
 * es el único consumidor de este módulo.
 *
 * Desde la migración 011 el `CORTE` es de negocio, no por vendedor: hay un
 * solo periodo vigente para todos los vendedores activos. El corte se
 * escribe una sola vez, ya confirmado (`corte`/`corte_vendedor`/
 * `liquidacion_movimiento` son append-only — GRANT sin UPDATE/DELETE): no
 * existe una transición borrador→confirmado persistida.
 */

import { db } from '../db/index';
import { generateUUID } from './uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import { calcularCorte as calcularSnapshotVendedor } from './corte';
import type { IdentidadControlProducto } from './corte';
import { adeudoLaModerna } from './suministro';
import { abonosDelCorte } from './abonoVendedor';
import type { ReconciliacionModerna } from './suministro';
import { presentacionesAUnidadCompra } from './conversion';
import type {
  Corte,
  CorteVendedor,
  LiquidacionMovimiento as LiquidacionMovimientoRow,
  Vendedor,
} from '../db/schema';
import type {
  VendedorEntrada,
  NegocioEntrada,
  CorteSalida,
} from '../domain/corte';

const round2 = (n: number) => Math.round(n * 100) / 100;
const soloFecha = (iso?: string | null) => (iso ?? '').slice(0, 10);
// El límite inferior se acota por el INSTANTE exacto (`fecha_generado`) del
// corte anterior, no por su fecha calendario: si dos cortes se confirman el
// mismo día, comparar solo por día con `>` estricto dejaría fuera para
// siempre cualquier operación registrada ese día después del corte anterior
// (nunca sería "mayor" a una fecha calendario igual a la suya).
const enRango = (fecha: string | undefined, inicioInstante: string, fin: string) => {
  const t = fecha ? new Date(fecha).getTime() : NaN;
  return (!inicioInstante || t > new Date(inicioInstante).getTime()) && soloFecha(fecha) <= fin;
};

// ── Vendedores activos ─────────────────────────────────────────

export async function cargarVendedoresActivos(): Promise<Vendedor[]> {
  return db.vendedor.toArray();
}

// ── Arrastre entrante (apertura = cierre del corte anterior) ──

export interface AperturaCorte {
  /** El último corte confirmado, o null si es el primer corte (cutover). */
  corte: Corte | null;
  /** saldo_vendedor_cierre del corte anterior, por vendedor (0 si no aparece). */
  porVendedor: Map<string, number>;
  /** saldo_moderna_cierre del corte anterior (0 si es el primer corte). */
  moderna: number;
}

/** Arrastre entrante del corte vigente: apertura = cierre del corte anterior. */
export async function cargarApertura(): Promise<AperturaCorte> {
  const todos = await db.corte.toArray();
  const confirmados = todos.filter((c) => c.estado === 'confirmado');
  // Se ordena por `fecha_generado` (instante único), no por `periodo_fin`
  // (fecha calendario): dos cortes confirmados el mismo día compartirían
  // `periodo_fin` y darían un orden ambiguo.
  const ultimo = confirmados.sort((a, b) => a.fecha_generado.localeCompare(b.fecha_generado)).at(-1) ?? null;

  if (!ultimo) {
    return { corte: null, porVendedor: new Map(), moderna: 0 };
  }

  const lineas = await db.corte_vendedor.where('corte_id').equals(ultimo.id).toArray();
  const porVendedor = new Map(lineas.map((l) => [l.vendedor_id, l.saldo_vendedor_cierre]));

  return { corte: ultimo, porVendedor, moderna: ultimo.saldo_moderna_cierre };
}

/**
 * Arrastre vigente = cierre del corte anterior ± abonos ya registrados contra
 * ese corte (migración 015, Inc 7.5). Único punto de verdad para "cuánto
 * debe/le deben a un vendedor hoy" — lo usa tanto el stepper (apertura del
 * próximo corte) como el dashboard del gerente y la pantalla del vendedor.
 */
export async function cargarAperturaVigente(): Promise<AperturaCorte> {
  const base = await cargarApertura();
  if (!base.corte) return base;

  const abonos = await abonosDelCorte(base.corte.id);
  const porVendedor = new Map(base.porVendedor);
  for (const a of abonos) {
    const delta = a.direccion === 'vendedor_a_negocio' ? a.monto : -a.monto;
    porVendedor.set(a.vendedor_id, round2((porVendedor.get(a.vendedor_id) ?? 0) + delta));
  }

  return { ...base, porVendedor };
}

export interface UltimoCorteVendedor {
  /** El corte confirmado más reciente en el que este vendedor tiene línea. */
  corteId: string;
  /** cxc_nueva registrada para este vendedor en ese corte — honorario retenido por cartera sin cobrar. */
  cxcNueva: number;
}

/**
 * Línea del vendedor en el último corte confirmado (Inc 7.5) — de aquí sale
 * el honorario retenido (`cxc_nueva`) que "Mi saldo" sugiere reclamar al
 * cobrar la cartera correspondiente. Solo lectura; no participa en el motor.
 */
export async function cargarUltimoCorteVendedor(vendedorId: string): Promise<UltimoCorteVendedor | null> {
  const todos = await db.corte.toArray();
  const confirmados = todos.filter((c) => c.estado === 'confirmado');
  const ultimo = confirmados.sort((a, b) => a.fecha_generado.localeCompare(b.fecha_generado)).at(-1);
  if (!ultimo) return null;

  const lineas = await db.corte_vendedor.where('corte_id').equals(ultimo.id).toArray();
  const linea = lineas.find((l) => l.vendedor_id === vendedorId);
  return linea ? { corteId: ultimo.id, cxcNueva: linea.cxc_nueva } : null;
}

// ── Insumos por vendedor (reglas 1-2, modelo-datos-v1_4) ───────

/**
 * Deriva los insumos de un vendedor para el periodo, distinguiendo (R9,
 * anti-doble-conteo): `cxc_nueva` (venta de este periodo aún no cobrada) de
 * `cobro_cxc_vieja` (cobro de este periodo sobre una venta de un periodo
 * anterior — no es ingreso nuevo, solo salda arrastre).
 */
export async function derivarVendedorEntrada(
  vendedorId: string,
  inicioInstante: string,
  periodoFin: string,
  saldoVendedorApertura: number
): Promise<VendedorEntrada> {
  const [todasVentasVendedor, todosCobros, gastos] = await Promise.all([
    db.venta.where('vendedor_id').equals(vendedorId).toArray(),
    db.cobro.toArray(),
    db.gasto.where('vendedor_id').equals(vendedorId).toArray(),
  ]);

  const idsVentasVendedor = new Set(todasVentasVendedor.map((v) => v.id));
  const fechaPorVenta = new Map(todasVentasVendedor.map((v) => [v.id, soloFecha(v.fecha)]));

  const ventasPeriodo = todasVentasVendedor.filter((v) => enRango(v.fecha, inicioInstante, periodoFin));
  const ventasPeriodoTotal = round2(ventasPeriodo.reduce((s, v) => s + v.total, 0));
  const idsVentasPeriodo = new Set(ventasPeriodo.map((v) => v.id));

  const cobrosDelVendedorEnRango = todosCobros.filter(
    (c) => idsVentasVendedor.has(c.venta_id) && enRango(c.fecha, inicioInstante, periodoFin)
  );

  let efectivoCobrado = 0;
  let transferCobrado = 0;
  let cobradoSobreVentasNuevas = 0;
  let cobroCxcVieja = 0;
  for (const c of cobrosDelVendedorEnRango) {
    if (c.forma_pago === 'efectivo') efectivoCobrado += c.monto;
    else transferCobrado += c.monto;

    if (idsVentasPeriodo.has(c.venta_id)) {
      cobradoSobreVentasNuevas += c.monto;
    } else if (fechaPorVenta.has(c.venta_id)) {
      // Cobro de este periodo sobre una venta de un periodo anterior (R9):
      // no es ingreso nuevo, solo salda el arrastre.
      cobroCxcVieja += c.monto;
    }
  }

  const gastosRutaEnRango = gastos.filter((g) => g.tipo === 'ruta' && enRango(g.fecha, inicioInstante, periodoFin));
  let gastoRutaEfectivo = 0;
  let gastoRutaTransfer = 0;
  for (const g of gastosRutaEnRango) {
    if (g.forma_pago === 'efectivo') gastoRutaEfectivo += g.monto;
    else gastoRutaTransfer += g.monto;
  }

  const cxcNueva = round2(Math.max(0, ventasPeriodoTotal - cobradoSobreVentasNuevas));

  return {
    vendedor_id: vendedorId,
    efectivo_cobrado_neto: round2(efectivoCobrado - gastoRutaEfectivo),
    transfer_cobrado_neto: round2(transferCobrado - gastoRutaTransfer),
    cxc_nueva: cxcNueva,
    cobro_cxc_vieja: round2(cobroCxcVieja),
    saldo_vendedor_apertura: round2(saldoVendedorApertura),
  };
}

// ── Insumos de negocio (Inc 6 + backoffice) ────────────────────

export interface NegocioInsumos {
  negocio: NegocioEntrada;
  identidadControl: IdentidadControlProducto[];
  moderna: ReconciliacionModerna;
  backofficeTotal: number;
}

/** Deriva adeudo a La Moderna, identidad de control y backoffice del periodo. */
export async function cargarNegocioEntrada(
  inicioInstante: string,
  periodoFin: string,
  saldoModernaApertura: number
): Promise<NegocioInsumos> {
  const [suministros, envasados, productos, gastos] = await Promise.all([
    db.suministro_la_moderna.toArray(),
    db.envasado.toArray(),
    db.producto_base.toArray(),
    db.gasto.where('tipo').equals('backoffice').toArray(),
  ]);

  const suministrosPeriodo = suministros.filter((s) => enRango(s.fecha, inicioInstante, periodoFin));
  const envasadosPeriodo = envasados.filter((e) => enRango(e.fecha, inicioInstante, periodoFin));
  const gastosBackofficePeriodo = gastos.filter((g) => enRango(g.fecha, inicioInstante, periodoFin));

  const moderna = adeudoLaModerna(suministrosPeriodo, productos);

  // identidadControl es una pieza pura de lib/corte.ts; se reusa pasando
  // ventas/cobros/gastos vacíos (no aplican a nivel negocio) para no
  // duplicar la lógica de la identidad de control (ADR-0009).
  const { identidadControl } = calcularSnapshotVendedor({
    ventas: [],
    cobros: [],
    gastos: [],
    suministros: suministrosPeriodo,
    envasados: envasadosPeriodo,
    bodegaBase: [],
    bodegaPresentaciones: [],
    presentaciones: [],
    productos,
  });

  const backofficeTotal = round2(gastosBackofficePeriodo.reduce((s, g) => s + g.monto, 0));

  return {
    negocio: {
      adeudo_la_moderna: round2(moderna.total),
      backoffice_pendiente: backofficeTotal,
      saldo_moderna_apertura: round2(saldoModernaApertura),
    },
    identidadControl,
    moderna,
    backofficeTotal,
  };
}

// ── Mercancía sellada en bodega (Paso 2, acopio hacia La Moderna) ─────
// Cubre tanto químicos en bidón (inventario_bodega_base) como
// escobas/trapeadores/recogedores en pieza (inventario_bodega_presentacion,
// vía su presentación 'pieza' — mismo patrón de conversión que usa el
// trigger aplicar_movimiento_la_moderna del lado servidor, migración 007).

export interface SelladoDisponible {
  productoBaseId: string;
  nombre: string;
  disponibles: number;
}

/** Mercancía disponible en bodega para devolver a La Moderna, por producto base. */
export async function cargarSelladosDisponibles(): Promise<SelladoDisponible[]> {
  const [productos, base, presentaciones, bodegaPresentacion] = await Promise.all([
    db.producto_base.toArray(),
    db.inventario_bodega_base.toArray(),
    db.presentacion.toArray(),
    db.inventario_bodega_presentacion.toArray(),
  ]);

  const bidonesPorProducto = new Map(base.map((b) => [b.producto_base_id, b.bidones_disponibles]));
  const piezaPorProducto = new Map(
    presentaciones.filter((p) => p.unidad_venta === 'pieza').map((p) => [p.producto_base_id, p])
  );
  const cantidadPorPresentacion = new Map(bodegaPresentacion.map((b) => [b.presentacion_id, b.cantidad]));

  const out: SelladoDisponible[] = [];
  for (const prod of productos) {
    let disponibles: number;
    if (prod.unidad_compra === 'bidon') {
      disponibles = bidonesPorProducto.get(prod.id) ?? 0;
    } else {
      const pieza = piezaPorProducto.get(prod.id);
      if (!pieza) continue; // sin presentación 'pieza' (p. ej. papel_institucional): fuera de la cadena de bodega
      disponibles = presentacionesAUnidadCompra(cantidadPorPresentacion.get(pieza.id) ?? 0, pieza.factor_conversion);
    }
    if (disponibles > 0) {
      out.push({ productoBaseId: prod.id, nombre: prod.nombre, disponibles: round2(disponibles) });
    }
  }

  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ── Confirmación del corte (Paso 6) ────────────────────────────

export interface ConfirmarCorteInput {
  periodoInicio: string;
  periodoFin: string;
  nVendedores: number;
  vendedoresEntrada: VendedorEntrada[];
  negocio: NegocioEntrada;
  salida: CorteSalida;
}

export interface ConfirmarCorteResult {
  corte: Corte;
  corteVendedor: CorteVendedor[];
  liquidacion: LiquidacionMovimientoRow[];
}

/**
 * Escribe el corte de negocio completo — `corte` + `corte_vendedor[]` +
 * `liquidacion_movimiento[]` — en un solo lote local + cola (offline-first,
 * idempotente por `id`). Es un evento append-only: se escribe una sola vez,
 * ya `estado: 'confirmado'` (ver nota de cabecera de este módulo).
 */
export async function confirmarCorte(input: ConfirmarCorteInput): Promise<ConfirmarCorteResult> {
  const { periodoInicio, periodoFin, nVendedores, vendedoresEntrada, negocio, salida } = input;

  const corteId = generateUUID();
  const corte: Corte = {
    id: corteId,
    periodo_inicio: periodoInicio || null,
    periodo_fin: periodoFin,
    fecha_generado: new Date().toISOString(),
    estado: 'confirmado',
    n_vendedores: nVendedores,
    ventas_periodo: round2(salida.ventas_periodo),
    adeudo_la_moderna: round2(negocio.adeudo_la_moderna),
    backoffice_pendiente: round2(negocio.backoffice_pendiente),
    obligaciones_total: round2(salida.obligaciones_total),
    pool_liquido: round2(salida.pool_liquido),
    v_remanente: round2(salida.v_remanente),
    t_por_vendedor: round2(salida.t_por_vendedor),
    saldo_moderna_apertura: round2(negocio.saldo_moderna_apertura),
    saldo_moderna_cierre: round2(salida.saldo_moderna_cierre),
    snapshot: { entrada: { vendedores: vendedoresEntrada, negocio }, salida } as unknown as Record<string, unknown>,
  };
  await persist('corte', corte);

  const entradaPorVendedor = new Map(vendedoresEntrada.map((v) => [v.vendedor_id, v]));
  const corteVendedor: CorteVendedor[] = salida.por_vendedor.map((p) => {
    const entrada = entradaPorVendedor.get(p.vendedor_id)!;
    return {
      id: generateUUID(),
      corte_id: corteId,
      vendedor_id: p.vendedor_id,
      efectivo_cobrado_neto: round2(entrada.efectivo_cobrado_neto),
      transfer_cobrado_neto: round2(entrada.transfer_cobrado_neto),
      cxc_nueva: round2(entrada.cxc_nueva),
      cobro_cxc_vieja: round2(entrada.cobro_cxc_vieja),
      posicion_objetivo: round2(p.posicion_objetivo),
      efectivo_entregado: round2(p.efectivo_entregado),
      saldo_vendedor_apertura: round2(entrada.saldo_vendedor_apertura),
      saldo_vendedor_cierre: round2(p.saldo_vendedor_cierre),
    };
  });
  for (const linea of corteVendedor) {
    await persist('corte_vendedor', linea);
  }

  const liquidacion: LiquidacionMovimientoRow[] = salida.liquidacion.map((m) => ({
    id: generateUUID(),
    corte_id: corteId,
    origen_tipo: m.origen_tipo,
    origen_vendedor_id: m.origen_vendedor_id,
    destino_tipo: m.destino_tipo,
    destino_vendedor_id: m.destino_vendedor_id,
    monto: round2(m.monto),
    forma_pago: m.forma_pago,
    nota: m.nota,
  }));
  for (const movimiento of liquidacion) {
    await persist('liquidacion_movimiento', movimiento);
  }

  await syncEngine.refreshPendingCount();
  await syncEngine.syncNow();

  return { corte, corteVendedor, liquidacion };
}

async function persist(
  table: 'corte' | 'corte_vendedor' | 'liquidacion_movimiento',
  row: object
): Promise<void> {
  const raw = row as Record<string, unknown>;
  await db.table(table).put(raw);
  await enqueueOperation(table, 'upsert', raw);
}
