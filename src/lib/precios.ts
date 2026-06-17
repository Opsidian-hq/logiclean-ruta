/**
 * Logiclean Ruta — Lógica de precios de venta (H-04)
 *
 * Funciones puras (sin Dexie ni red) para que QA las trace directo a los
 * criterios de aceptación:
 *  - El `tipo` del cliente decide la lista: mayoreo → precio_mayoreo,
 *    menudeo → precio_menudeo.
 *  - El precio se **congela** al momento de la venta: se copia a la línea y
 *    no se recalcula si el catálogo cambia después.
 */

import type { Presentacion } from '../db/schema';

export type TipoCliente = 'mayoreo' | 'menudeo';

/**
 * Precio unitario de lista para una presentación según el tipo de cliente.
 * Este es el valor que se congela en `linea_venta.precio_unitario`.
 */
export function precioUnitario(
  presentacion: Pick<Presentacion, 'precio_mayoreo' | 'precio_menudeo'>,
  tipo: TipoCliente
): number {
  return tipo === 'mayoreo'
    ? presentacion.precio_mayoreo
    : presentacion.precio_menudeo;
}

/** Importe de una línea: cantidad × precio unitario congelado. */
export function importeLinea(cantidad: number, precioUnitario: number): number {
  return redondear(cantidad * precioUnitario);
}

/** Total de la venta: suma de los importes de cada línea. */
export function totalVenta(
  lineas: { cantidad: number; precio_unitario: number }[]
): number {
  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario,
    0
  );
  return redondear(total);
}

// ── Facturación (H-06): precio de lista + IVA ─────────────────
//
// El MVP **registra, no timbra**. Cuando la venta se marca "requiere factura",
// el monto se calcula a precio de lista + IVA (PRD v1.2, H-06). El destino
// fiscal/no fiscal se deduce del cruce requiere_factura × forma_pago en el
// modelo; aquí solo se aplica el IVA al subtotal de lista.

/** Tasa de IVA aplicable a ventas facturables (16%). */
export const IVA_TASA = 0.16;

/** IVA sobre un subtotal de lista. */
export function calcularIVA(subtotal: number): number {
  return redondear(subtotal * IVA_TASA);
}

/**
 * Total de la venta según facturación: si requiere factura, subtotal + IVA;
 * si no, el subtotal tal cual.
 */
export function totalConFactura(subtotal: number, requiereFactura: boolean): number {
  return requiereFactura ? redondear(subtotal + calcularIVA(subtotal)) : redondear(subtotal);
}

/** Redondeo monetario a 2 decimales evitando ruido de punto flotante. */
export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
