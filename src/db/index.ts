/**
 * Logiclean Ruta — Instancia de Dexie (IndexedDB)
 *
 * Importar `db` desde aquí en lugar de instanciar Dexie directamente.
 * La versión de la BD se incrementa cuando cambia DEXIE_SCHEMA.
 */

import Dexie, { type Table } from 'dexie';
import { DEXIE_SCHEMA } from './schema';
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
  // ── Cola de sync offline ──────────────────────────────────
  sync_queue!:            Table<SyncQueueItem>;

  constructor() {
    super('logiclean-ruta');

    // Versión 1: esquema inicial (Inc 0)
    // Incrementar la versión si se añaden/modifican índices
    this.version(1).stores(DEXIE_SCHEMA);
  }
}

export const db = new LogicleanDB();
