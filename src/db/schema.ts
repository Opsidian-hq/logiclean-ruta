/**
 * Logiclean Ruta — Schema de Dexie (IndexedDB)
 *
 * Espejo del modelo remoto (Supabase/Postgres).
 * Los cambios aquí deben reflejarse en 001_schema.sql.
 *
 * Convenciones:
 * - PKs: campo `id` (UUID string), siempre ++id NO aplica aquí
 * - En Dexie el esquema define solo los índices, no las columnas
 * - "&" = índice único, "*" = índice multi-entrada
 */

// ── Tipos TypeScript espejo del modelo remoto ─────────────────

export interface Vendedor {
  id: string;        // UUID = auth.users.id
  nombre: string;
  tipo: 'mayoreo' | 'menudeo';
}

export interface Cliente {
  id: string;
  vendedor_id: string;
  nombre: string;
  tipo: 'mayoreo' | 'menudeo';
  estado: 'prospecto' | 'activo';
  ciclo_visita: number;
  dia_ruta?: string | null;
  fecha_proxima_visita?: string | null;  // ISO date string
  activo: boolean;
  orden_ruta?: number | null;
}

export interface Visita {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  fecha: string;          // ISO date
  numero_ciclo: number;
  nota?: string;
  siguiente_paso?: string;
  fecha_proxima?: string; // ISO date
}

export type CategoriaProducto =
  | 'escobas'
  | 'trapeadores'
  | 'recogedores'
  | 'papel_institucional'
  | 'quimicos';

export interface ProductoBase {
  id: string;
  nombre: string;
  unidad_compra: 'bidon' | 'pieza';
  categoria: CategoriaProducto;
  precio_preferencial?: number;
  /** Litros que trae un bidón sellado completo (solo unidad_compra='bidon'). */
  litros_por_bidon?: number;
  activo: boolean;
}

export interface Presentacion {
  id: string;
  producto_base_id: string;
  nombre: string;
  unidad_venta: string;
  factor_conversion: number;
  precio_mayoreo: number;
  precio_menudeo: number;
  activo: boolean;
}

export interface Venta {
  id: string;
  vendedor_id: string;
  cliente_id: string;
  fecha: string;          // ISO timestamptz
  requiere_factura: boolean;
  total: number;
}

export interface LineaVenta {
  id: string;
  venta_id: string;
  presentacion_id: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Cobro {
  id: string;
  venta_id: string;
  fecha: string;          // ISO timestamptz
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
  tipo: 'total' | 'parcial';
}

export interface PedidoPendiente {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  presentacion_id: string;
  cantidad: number;
  fecha_compromiso?: string; // ISO date
  estado: string;           // 'pendiente' | 'surtido' | 'cancelado'
}

export interface InventarioVehiculo {
  id: string;
  vendedor_id: string;
  presentacion_id: string;
  cantidad: number;
}

export interface SuministroLaModerna {
  id: string;
  producto_base_id: string;
  fecha: string;            // ISO date
  cantidad_recibida: number;
  cantidad_devuelta: number;
}

export interface Gasto {
  id: string;
  vendedor_id?: string | null;
  tipo: 'ruta' | 'backoffice';
  categoria: string;
  fecha: string;            // ISO date
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
  descripcion?: string;
}

// ── Corte por reparto (H-20, Inc 7.2) — corte de negocio, no por vendedor.
// Ver docs/modelo-datos-v1_4-corte-reparto.md y ADR-0011. Reemplaza el CORTE
// por-vendedor de H-10; append-only (sin UPDATE/DELETE), igual que el resto
// del historial de cierre.

export interface Corte {
  id: string;
  periodo_inicio: string | null;   // ISO date; null = sin corte previo (primer corte)
  periodo_fin: string;      // ISO date
  fecha_generado: string;   // ISO timestamptz
  estado: 'borrador' | 'confirmado';
  n_vendedores: number;
  ventas_periodo: number;
  adeudo_la_moderna: number;
  backoffice_pendiente: number;
  obligaciones_total: number;
  pool_liquido: number;
  v_remanente: number;
  t_por_vendedor: number;
  saldo_moderna_apertura: number;
  saldo_moderna_cierre: number;
  snapshot: Record<string, unknown>;
}

/** Línea por vendedor de un corte de negocio (UNIQUE corte_id, vendedor_id). */
export interface CorteVendedor {
  id: string;
  corte_id: string;
  vendedor_id: string;
  efectivo_cobrado_neto: number;
  transfer_cobrado_neto: number;
  cxc_nueva: number;
  cobro_cxc_vieja: number;
  posicion_objetivo: number;
  efectivo_entregado: number;
  saldo_vendedor_apertura: number;
  saldo_vendedor_cierre: number;
}

/** Instrucción concreta de movimiento de dinero (Paso 5, ADR-0011). */
export interface LiquidacionMovimiento {
  id: string;
  corte_id: string;
  origen_tipo: 'vendedor' | 'negocio';
  origen_vendedor_id: string | null;
  destino_tipo: 'la_moderna' | 'backoffice' | 'vendedor' | 'negocio';
  destino_vendedor_id: string | null;
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
  nota?: string;
}

/**
 * Abono contra el saldo_vendedor_cierre del último corte confirmado (migración
 * 015). Ledger append-only: nunca modifica corte_vendedor, solo neta el saldo
 * vigente (ver `cargarAperturaVigente` en lib/corteReparto.ts). El vendedor es
 * quien registra el abono, ya que es quien salda su cuenta con el negocio.
 */
export interface AbonoSaldoVendedor {
  id: string;
  corte_id: string;
  vendedor_id: string;
  direccion: 'vendedor_a_negocio' | 'negocio_a_vendedor';
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
  fecha: string;  // ISO timestamptz
  nota?: string;
}

// ── Inc 6.1 — Inventario de bodega (contadores + eventos) ─────
// Ver docs/modelo-datos-inc6-bodega-envasado.md. Los contadores se
// materializan del lado servidor por trigger (ADR-0007); el cliente nunca
// empuja un valor absoluto de bodega (a diferencia de inventario_vehiculo).

export interface InventarioBodegaBase {
  id: string;
  producto_base_id: string;
  bidones_disponibles: number;    // químicos: consignación La Moderna
  litros_granel_estimado: number; // químicos: residuo abierto, de Logiclean
}

export interface InventarioBodegaPresentacion {
  id: string;
  presentacion_id: string;
  cantidad: number; // vendible en bodega: químico envasado o pieza de escoba
}

export interface MovimientoLaModerna {
  id: string;
  producto_base_id: string;
  tipo: 'recibido' | 'devuelto';
  fecha: string; // ISO date
  cantidad: number; // en unidad_compra: bidones o piezas
  responsable_id: string;
  nota?: string;
}

export interface Envasado {
  id: string;
  producto_base_id: string;
  fecha: string; // ISO date
  /** Litros totales que salieron a presentación (Σ cantidad × factor_conversion). */
  litros_envasados: number;
  /** Calculado por el trigger aplicar_envasado() (no lo captura el gerente). */
  bidones_abiertos: number;
  responsable_id: string;
  nota?: string;
}

export interface EnvasadoLinea {
  id: string;
  envasado_id: string;
  presentacion_id: string;
  cantidad: number;
}

export interface CargaVehiculo {
  id: string;
  vendedor_id: string;
  fecha: string; // ISO date
  responsable_id: string; // gerente o el propio vendedor
  nota?: string;
}

export interface CargaLinea {
  id: string;
  carga_id: string;
  presentacion_id: string;
  cantidad: number;
}

export interface DevolucionBodega {
  id: string;
  vendedor_id: string;
  fecha: string; // ISO date
  responsable_id: string;
  nota?: string;
}

export interface DevolucionLinea {
  id: string;
  devolucion_id: string;
  presentacion_id: string;
  cantidad: number;
}

// ── Tipo unión para todas las entidades ───────────────────────
export type EntityTable =
  | 'vendedor'
  | 'cliente'
  | 'visita'
  | 'producto_base'
  | 'presentacion'
  | 'venta'
  | 'linea_venta'
  | 'cobro'
  | 'pedido_pendiente'
  | 'inventario_vehiculo'
  | 'suministro_la_moderna'
  | 'gasto'
  | 'corte'
  | 'corte_vendedor'
  | 'liquidacion_movimiento'
  | 'abono_saldo_vendedor'
  | 'inventario_bodega_base'
  | 'inventario_bodega_presentacion'
  | 'movimiento_la_moderna'
  | 'envasado'
  | 'envasado_linea'
  | 'carga_vehiculo'
  | 'carga_linea'
  | 'devolucion_bodega'
  | 'devolucion_linea';

// ── Definición de stores Dexie ────────────────────────────────
// Formato: "++field" = autoincrement, "&field" = unique, "field" = índice
// Los campos no indexados se almacenan igualmente — Dexie persiste todo el objeto

export const DEXIE_SCHEMA = {
  vendedor:              '&id',
  cliente:               '&id, vendedor_id, activo, estado',
  visita:                '&id, cliente_id, vendedor_id, fecha',
  producto_base:         '&id, activo',
  presentacion:          '&id, producto_base_id, activo',
  venta:                 '&id, vendedor_id, cliente_id, fecha',
  linea_venta:           '&id, venta_id, presentacion_id',
  cobro:                 '&id, venta_id',
  pedido_pendiente:      '&id, cliente_id, vendedor_id, estado',
  inventario_vehiculo:   '&id, vendedor_id, presentacion_id',
  suministro_la_moderna: '&id, producto_base_id, fecha',
  gasto:                 '&id, vendedor_id, fecha, tipo',
  corte:                 '&id, vendedor_id',
  // Cola de operaciones offline (solo local, nunca sube como tabla)
  sync_queue:            '++_seq, &id, status, table_name, created_at',
} as const;

// Versión 2 (Inc 6.1): agrega el subsistema de inventario de bodega.
// Dexie requiere repetir los stores sin cambios junto con los nuevos para
// que la migración incremental (ver db/index.ts) construya el store set
// completo de esta versión.
export const DEXIE_SCHEMA_V2 = {
  ...DEXIE_SCHEMA,
  inventario_bodega_base:         '&id, producto_base_id',
  inventario_bodega_presentacion: '&id, presentacion_id',
  movimiento_la_moderna:          '&id, producto_base_id, tipo, fecha',
  envasado:                       '&id, producto_base_id, fecha',
  envasado_linea:                 '&id, envasado_id, presentacion_id',
  carga_vehiculo:                 '&id, vendedor_id, fecha',
  carga_linea:                    '&id, carga_id, presentacion_id',
  devolucion_bodega:              '&id, vendedor_id, fecha',
  devolucion_linea:               '&id, devolucion_id, presentacion_id',
} as const;

// Versión 3 (Inc 7.2/7.4): corte por reparto (H-20) — CORTE pasa de
// por-vendedor a de-negocio (ya no se indexa por vendedor_id, la columna se
// retiró: migración 011), y se agregan CORTE_VENDEDOR y LIQUIDACION_MOVIMIENTO.
export const DEXIE_SCHEMA_V3 = {
  ...DEXIE_SCHEMA_V2,
  corte:                 '&id',
  corte_vendedor:         '&id, corte_id, vendedor_id',
  liquidacion_movimiento: '&id, corte_id',
} as const;

// Versión 4 (Inc 7.5): abono de saldo vendedor↔negocio — salda el
// saldo_vendedor_cierre del último corte confirmado fuera del wizard.
export const DEXIE_SCHEMA_V4 = {
  ...DEXIE_SCHEMA_V3,
  abono_saldo_vendedor: '&id, corte_id, vendedor_id, [corte_id+vendedor_id]',
} as const;
