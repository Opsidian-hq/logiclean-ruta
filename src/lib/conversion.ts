/**
 * Logiclean Ruta — Conversión presentación ↔ unidad de compra (H-11, Inc 3)
 *
 * La cuenta con La Moderna se lleva en la **unidad de compra** (bidón para
 * químicos, pieza para escobas/trapeadores/papel institucional), mientras que
 * la venta y el inventario se llevan en **presentaciones** (1 L, 3.7 L, pza…).
 *
 * `factor_conversion` = cuántas presentaciones salen de **una** unidad de
 * compra (p. ej. 10 botellas de 1 L por bidón). Por eso:
 *
 *     unidadesDeCompra = cantidadPresentaciones / factor_conversion
 *
 * Funciones puras y sin estado: son la base testeable del corte (riesgo T8).
 */

import type { Presentacion, InventarioVehiculo } from '../db/schema';

/**
 * Traduce una cantidad en presentaciones a su equivalente en unidades de
 * compra (bidones/piezas). Si el factor no es válido (≤ 0), devuelve 0 para
 * no contaminar el corte con divisiones indefinidas.
 */
export function presentacionesAUnidadCompra(
  cantidadPresentaciones: number,
  factorConversion: number
): number {
  if (!(factorConversion > 0)) return 0;
  return cantidadPresentaciones / factorConversion;
}

/** Cantidad en unidad de compra para un producto base. */
export interface UnidadCompraPorProducto {
  producto_base_id: string;
  /** Unidades de compra (bidones/piezas) acumuladas. */
  unidades: number;
}

type PresentacionConv = Pick<
  Presentacion,
  'id' | 'producto_base_id' | 'factor_conversion'
>;

/**
 * Agrega un inventario en presentaciones a unidades de compra por producto
 * base. Útil para la "vista de inventario del corte" (H-10): cuánto producto,
 * en bidones, sigue en el vehículo al cierre.
 *
 * Las presentaciones sin catálogo conocido (sin factor) se ignoran.
 */
export function inventarioAUnidadCompra(
  inventario: Pick<InventarioVehiculo, 'presentacion_id' | 'cantidad'>[],
  presentaciones: PresentacionConv[]
): UnidadCompraPorProducto[] {
  const factorPorPres = new Map<string, PresentacionConv>();
  for (const p of presentaciones) factorPorPres.set(p.id, p);

  const acumulado = new Map<string, number>();
  for (const inv of inventario) {
    const pres = factorPorPres.get(inv.presentacion_id);
    if (!pres) continue;
    const unidades = presentacionesAUnidadCompra(inv.cantidad, pres.factor_conversion);
    acumulado.set(
      pres.producto_base_id,
      (acumulado.get(pres.producto_base_id) ?? 0) + unidades
    );
  }

  return [...acumulado.entries()].map(([producto_base_id, unidades]) => ({
    producto_base_id,
    unidades,
  }));
}

/**
 * Litros envasados a partir de las líneas de un envasado (H-17). Para
 * presentaciones de químicos (unidad_venta='litro'), factor_conversion es
 * de-facto el número de litros que contiene una unidad de esa presentación
 * (ver seed: 1 L/3.75 L/20 L → factor_conversion 1/3.75/20) — no
 * "presentaciones por unidad de compra" como en el resto de este archivo.
 * Presentaciones sin catálogo conocido se ignoran (igual que
 * `inventarioAUnidadCompra`).
 */
export function calcularLitrosEnvasados(
  lineas: { presentacionId: string; cantidad: number }[],
  presentaciones: Pick<Presentacion, 'id' | 'factor_conversion'>[]
): number {
  const factorPorId = new Map(presentaciones.map((p) => [p.id, p.factor_conversion]));
  return lineas.reduce((sum, l) => {
    const factor = factorPorId.get(l.presentacionId);
    return factor && factor > 0 ? sum + l.cantidad * factor : sum;
  }, 0);
}
