/**
 * Logiclean Ruta — Reconciliación con La Moderna (Inc 3, actualizado Inc 6.2)
 *
 * El suministro es **venta-o-devolución**: Logiclean recibe producto a granel
 * (en unidad de compra) y, al cierre, paga lo que se quedó y devuelve lo no
 * vendido. Lo que Logiclean le debe a La Moderna por producto base es:
 *
 *     adeudo = (recibido − devuelto) × precio_preferencial
 *
 * El `factor_conversion` NO entra en este adeudo (se calcula sobre la unidad de
 * compra); sirve solo para traducir el lado de ventas/inventario (ver
 * `lib/conversion.ts`). Cálculo puro sobre `suministro_la_moderna`.
 *
 * Desde Inc 6.2 (ADR-0006), `suministro_la_moderna` ya no se captura a mano:
 * es un rollup alimentado por el evento `movimiento_la_moderna` (recibido) vía
 * trigger (migración 008). El registro de recepción vive en
 * `lib/movimientoLaModerna.ts`.
 */

import type { SuministroLaModerna, ProductoBase } from '../db/schema';

// ── Reconciliación (cálculo puro) ─────────────────────────────

export interface AdeudoProducto {
  producto_base_id: string;
  nombre: string;
  recibido: number;
  devuelto: number;
  /** recibido − devuelto, en unidad de compra. */
  neto: number;
  /** neto × precio_preferencial. */
  adeudo: number;
}

export interface ReconciliacionModerna {
  porProducto: AdeudoProducto[];
  /** Suma de adeudos de todos los productos. */
  total: number;
}

type ProductoPrecio = Pick<ProductoBase, 'id' | 'nombre' | 'precio_preferencial'>;

/**
 * Calcula el adeudo a La Moderna agregando los suministros del periodo por
 * producto base. Suministros de productos sin catálogo conocido se ignoran.
 */
export function adeudoLaModerna(
  suministros: Pick<
    SuministroLaModerna,
    'producto_base_id' | 'cantidad_recibida' | 'cantidad_devuelta'
  >[],
  productos: ProductoPrecio[]
): ReconciliacionModerna {
  const prodPorId = new Map<string, ProductoPrecio>();
  for (const p of productos) prodPorId.set(p.id, p);

  // Acumular recibido/devuelto por producto base.
  const acc = new Map<string, { recibido: number; devuelto: number }>();
  for (const s of suministros) {
    const cur = acc.get(s.producto_base_id) ?? { recibido: 0, devuelto: 0 };
    cur.recibido += s.cantidad_recibida;
    cur.devuelto += s.cantidad_devuelta;
    acc.set(s.producto_base_id, cur);
  }

  const porProducto: AdeudoProducto[] = [];
  for (const [producto_base_id, { recibido, devuelto }] of acc) {
    const prod = prodPorId.get(producto_base_id);
    if (!prod) continue;
    const neto = recibido - devuelto;
    const adeudo = neto * (prod.precio_preferencial ?? 0);
    porProducto.push({
      producto_base_id,
      nombre: prod.nombre,
      recibido,
      devuelto,
      neto,
      adeudo,
    });
  }

  // Orden estable por nombre para una vista predecible.
  porProducto.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const total = porProducto.reduce((sum, p) => sum + p.adeudo, 0);
  return { porProducto, total };
}
