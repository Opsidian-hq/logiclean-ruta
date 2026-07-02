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

export const NOMBRE_CATEGORIA: Record<CategoriaProducto, string> = {
  escobas: 'Escobas',
  trapeadores: 'Trapeadores',
  recogedores: 'Recogedores',
  papel_institucional: 'Papel Institucional',
  quimicos: 'Químicos',
};

export interface GrupoCategoria<T> {
  categoria: CategoriaProducto;
  items: T[];
}

/** Agrupa productos por categoría, en el orden de exhibición del catálogo. */
export function agruparPorCategoria<T extends { categoria: CategoriaProducto }>(
  productos: T[]
): GrupoCategoria<T>[] {
  return ORDEN_CATEGORIAS.map((categoria) => ({
    categoria,
    items: productos.filter((p) => p.categoria === categoria),
  })).filter((grupo) => grupo.items.length > 0);
}
