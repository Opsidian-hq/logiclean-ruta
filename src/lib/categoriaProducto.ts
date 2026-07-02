/**
 * Logiclean Ruta — Categorías de producto
 *
 * Orden y etiquetas de las categorías del catálogo, compartidos entre la
 * vista de gerente (CatalogoPage) y la vista de vendedor (CatalogoOffline).
 */

import type { CategoriaProducto } from '../db/schema';

export const ORDEN_CATEGORIAS: CategoriaProducto[] = [
  'escobas',
  'trapeadores',
  'recogedores',
  'papel_institucional',
  'quimicos',
];

/**
 * Bucket de reserva para productos cuyo `categoria` no calza con ninguna de
 * las 5 categorías válidas (p. ej. filas sincronizadas antes de que la
 * migración que agrega/backfillea la columna corriera en producción). El
 * tipo de dominio garantiza `categoria: CategoriaProducto` en compile-time,
 * pero eso no es una garantía en runtime para datos que vienen de Dexie/
 * Supabase — nunca se descarta un producto por no reconocer su categoría.
 */
export const CATEGORIA_DESCONOCIDA = 'sin_categoria' as const;

export type CategoriaProductoOSinCategoria = CategoriaProducto | typeof CATEGORIA_DESCONOCIDA;

export const NOMBRE_CATEGORIA: Record<CategoriaProductoOSinCategoria, string> = {
  escobas: 'Escobas',
  trapeadores: 'Trapeadores',
  recogedores: 'Recogedores',
  papel_institucional: 'Papel Institucional',
  quimicos: 'Químicos',
  sin_categoria: 'Sin categoría',
};

export interface GrupoCategoria<T> {
  categoria: CategoriaProductoOSinCategoria;
  items: T[];
}

/**
 * Agrupa productos por categoría, en el orden de exhibición del catálogo.
 * Los productos con una categoría no reconocida caen en un grupo de reserva
 * ("Sin categoría") en vez de desaparecer del listado.
 */
export function agruparPorCategoria<T extends { categoria: CategoriaProducto }>(
  productos: T[]
): GrupoCategoria<T>[] {
  const grupos: GrupoCategoria<T>[] = ORDEN_CATEGORIAS.map((categoria) => ({
    categoria,
    items: productos.filter((p) => p.categoria === categoria),
  }));

  const sinCategoria = productos.filter((p) => !ORDEN_CATEGORIAS.includes(p.categoria));
  if (sinCategoria.length > 0) {
    grupos.push({ categoria: CATEGORIA_DESCONOCIDA, items: sinCategoria });
  }

  return grupos.filter((grupo) => grupo.items.length > 0);
}
