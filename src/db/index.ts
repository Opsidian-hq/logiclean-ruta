/**
 * Logiclean Ruta — Instancia de Dexie (IndexedDB)
 *
 * Importar `db` desde aquí en lugar de instanciar Dexie directamente.
 * La versión de la BD se incrementa cuando cambia DEXIE_SCHEMA.
 */

import Dexie, { type Table } from 'dexie';
import { DEXIE_SCHEMA, DEXIE_SCHEMA_V2, DEXIE_SCHEMA_V3, DEXIE_SCHEMA_V4 } from './schema';
import type {
  Vendedor,
  Cliente,
  Visita,
  ProductoBase,
  Presentacion,
  Venta,
  LineaVenta,
  Cobro,
  PedidoPendiente,
  InventarioVehiculo,
  SuministroLaModerna,
  Gasto,
  Corte,
  CorteVendedor,
  LiquidacionMovimiento,
  AbonoSaldoVendedor,
  InventarioBodegaBase,
  InventarioBodegaPresentacion,
  MovimientoLaModerna,
  Envasado,
  EnvasadoLinea,
  CargaVehiculo,
  CargaLinea,
  DevolucionBodega,
  DevolucionLinea,
} from './schema';
import type { SyncQueueItem } from '../sync/queue';

class LogicleanDB extends Dexie {
  // ── Tablas del modelo de datos ─────────────────────────────
  vendedor!:              Table<Vendedor>;
  cliente!:               Table<Cliente>;
  visita!:                Table<Visita>;
  producto_base!:         Table<ProductoBase>;
  presentacion!:          Table<Presentacion>;
  venta!:                 Table<Venta>;
  linea_venta!:           Table<LineaVenta>;
  cobro!:                 Table<Cobro>;
  pedido_pendiente!:      Table<PedidoPendiente>;
  inventario_vehiculo!:   Table<InventarioVehiculo>;
  suministro_la_moderna!: Table<SuministroLaModerna>;
  gasto!:                 Table<Gasto>;
  corte!:                 Table<Corte>;
  // ── Inc 7.2 — Corte por reparto (corte de negocio) ─────────
  corte_vendedor!:         Table<CorteVendedor>;
  liquidacion_movimiento!: Table<LiquidacionMovimiento>;
  // ── Inc 7.5 — Abono de saldo vendedor↔negocio ──────────────
  abono_saldo_vendedor!:   Table<AbonoSaldoVendedor>;
  // ── Inc 6.1 — Inventario de bodega ─────────────────────────
  inventario_bodega_base!:         Table<InventarioBodegaBase>;
  inventario_bodega_presentacion!: Table<InventarioBodegaPresentacion>;
  movimiento_la_moderna!:          Table<MovimientoLaModerna>;
  envasado!:                       Table<Envasado>;
  envasado_linea!:                 Table<EnvasadoLinea>;
  carga_vehiculo!:                 Table<CargaVehiculo>;
  carga_linea!:                    Table<CargaLinea>;
  devolucion_bodega!:              Table<DevolucionBodega>;
  devolucion_linea!:               Table<DevolucionLinea>;
  // ── Cola de sync offline ──────────────────────────────────
  sync_queue!:            Table<SyncQueueItem>;

  constructor() {
    super('logiclean-ruta');

    // Versión 1: esquema inicial (Inc 0)
    // Incrementar la versión si se añaden/modifican índices
    this.version(1).stores(DEXIE_SCHEMA);

    // Versión 2 (Inc 6.1): inventario de bodega (contadores + eventos).
    // Solo agrega stores nuevos; no toca índices existentes.
    this.version(2).stores(DEXIE_SCHEMA_V2);

    // Versión 3 (Inc 7.2/7.4): corte por reparto (H-20). CORTE pasa de
    // por-vendedor a de-negocio (se retira el índice vendedor_id) y se
    // agregan CORTE_VENDEDOR + LIQUIDACION_MOVIMIENTO.
    this.version(3).stores(DEXIE_SCHEMA_V3);

    // Versión 4 (Inc 7.5): abono de saldo vendedor↔negocio.
    this.version(4).stores(DEXIE_SCHEMA_V4);
  }
}

export const db = new LogicleanDB();
