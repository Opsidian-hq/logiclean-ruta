/**
 * Logiclean Ruta — Tests: gestión del catálogo (H-13)
 *
 * Trazabilidad con el PRD v1.2, H-13:
 *  - Alta de producto con presentaciones/precios/factor → CAT-101, CAT-102
 *  - Editar precio/factor → ventas posteriores usan el nuevo valor → CAT-103
 *  - Baja → se desactiva, no se borra (preserva histórico) → CAT-104, CAT-105
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import {
  guardarProducto,
  guardarPresentacion,
  desactivarProducto,
  desactivarPresentacion,
} from '../src/lib/catalogo';
import { precioUnitario } from '../src/lib/precios';
import { db } from '../src/db/index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('[H-13] gestión del catálogo', () => {
  it('CAT-101: alta de producto con su presentación, precios y factor', async () => {
    const prod = await guardarProducto({
      nombre: 'Multiusos',
      unidad_compra: 'bidon',
      categoria: 'quimicos',
      activo: true,
    });
    const pres = await guardarPresentacion({
      producto_base_id: prod.id,
      nombre: 'Multiusos 1 L',
      unidad_venta: 'litro',
      factor_conversion: 20,
      precio_mayoreo: 100,
      precio_menudeo: 130,
      activo: true,
    });

    const prodDB = await db.producto_base.get(prod.id);
    const presDB = await db.presentacion.get(pres.id);
    expect(prodDB?.nombre).toBe('Multiusos');
    expect(presDB?.factor_conversion).toBe(20);
    expect(presDB?.precio_mayoreo).toBe(100);
    expect(presDB?.precio_menudeo).toBe(130);
  });

  it('CAT-102: alta y baja entran a la cola de sync como pending', async () => {
    const prod = await guardarProducto({ nombre: 'X', unidad_compra: 'bidon', categoria: 'quimicos', activo: true });
    await desactivarProducto(prod.id);

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    expect(pendientes.filter((p) => p.table_name === 'producto_base').length).toBeGreaterThanOrEqual(2);
    expect(pendientes.every((p) => p.status === 'pending')).toBe(true);
  });

  it('CAT-103: editar el precio → una venta posterior usa el nuevo valor', async () => {
    const prod = await guardarProducto({ nombre: 'Multiusos', unidad_compra: 'bidon', categoria: 'quimicos', activo: true });
    const pres = await guardarPresentacion({
      producto_base_id: prod.id,
      nombre: 'Multiusos 1 L',
      unidad_venta: 'litro',
      factor_conversion: 20,
      precio_mayoreo: 100,
      precio_menudeo: 130,
      activo: true,
    });

    // Editar el precio de menudeo manteniendo el id (misma presentación).
    await guardarPresentacion({
      id: pres.id,
      producto_base_id: prod.id,
      nombre: 'Multiusos 1 L',
      unidad_venta: 'litro',
      factor_conversion: 20,
      precio_mayoreo: 100,
      precio_menudeo: 145,
      activo: true,
    });

    const presDB = await db.presentacion.get(pres.id);
    expect(presDB?.precio_menudeo).toBe(145);
    // Una venta posterior congelaría el nuevo precio de lista.
    expect(precioUnitario(presDB!, 'menudeo')).toBe(145);
  });

  it('CAT-104: baja de producto = desactiva (no borra) y sale de los activos', async () => {
    const prod = await guardarProducto({ nombre: 'Descontinuado', unidad_compra: 'bidon', categoria: 'quimicos', activo: true });
    await desactivarProducto(prod.id);

    // La fila sigue existiendo (no DELETE), pero ya no figura entre los activos.
    const prodDB = await db.producto_base.get(prod.id);
    expect(prodDB).toBeTruthy();
    const activos = await db.producto_base.where('activo').equals(1).toArray();
    expect(activos.find((p) => p.id === prod.id)).toBeUndefined();
  });

  it('CAT-106: producto recién dado de alta aparece en la consulta de activos (D-005)', async () => {
    // Reproduce el caso de QA: alta de "Trapeador Microseda 1pz" con su
    // presentación. El producto debe quedar indexado como activo (activo=1)
    // para que la lista del catálogo (where activo=1) lo muestre sin recargar.
    const prod = await guardarProducto({
      nombre: 'Trapeador Microseda 1pz',
      unidad_compra: 'pieza',
      categoria: 'trapeadores',
      activo: true,
    });
    await guardarPresentacion({
      producto_base_id: prod.id,
      nombre: 'Trapeador pieza',
      unidad_venta: 'pieza',
      factor_conversion: 1,
      precio_mayoreo: 45,
      precio_menudeo: 65,
      activo: true,
    });

    // La lista del catálogo usa exactamente esta consulta.
    const activos = await db.producto_base.where('activo').equals(1).toArray();
    expect(activos.find((p) => p.id === prod.id)).toBeDefined();

    const presActivas = await db.presentacion
      .where('producto_base_id')
      .equals(prod.id)
      .filter((p) => Boolean(p.activo))
      .toArray();
    expect(presActivas).toHaveLength(1);
    expect(presActivas[0].unidad_venta).toBe('pieza');
  });

  it('CAT-105: baja de presentación = desactiva (no borra)', async () => {
    const prod = await guardarProducto({ nombre: 'P', unidad_compra: 'bidon', categoria: 'quimicos', activo: true });
    const pres = await guardarPresentacion({
      producto_base_id: prod.id,
      nombre: 'P 1 L',
      unidad_venta: 'litro',
      factor_conversion: 10,
      precio_mayoreo: 50,
      precio_menudeo: 60,
      activo: true,
    });
    await desactivarPresentacion(pres.id);

    const presDB = await db.presentacion.get(pres.id);
    expect(presDB).toBeTruthy();
    const activas = await db.presentacion.where('activo').equals(1).toArray();
    expect(activas.find((p) => p.id === pres.id)).toBeUndefined();
  });
});
