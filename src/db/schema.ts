/**
 * Logiclean Ruta — Schema de Dexie (IndexedDB)
 *
 * Espejo del modelo remoto (Supabase/Postgres).
 * Los cambios aquí deben reflejarse en 20260611100001_schema.sql.
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

export interface ProductoBase {
  id: string;
  nombre: string;
  unidad_compra: 'bidon' | 'docena';
  precio_preferencial?: number;
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

export interface Corte {
  id: string;
  vendedor_id: string;
  periodo_inicio: string;   // ISO date
  periodo_fin: string;      // ISO date
  fecha_generado: string;   // ISO timestamptz
  efectivo_entregado: number;
  transferencias_entregadas: number;
  snapshot: Record<string, unknown>;
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
  | 'corte';

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
