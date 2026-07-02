/**
 * Logiclean Ruta — Tests: agrupación del catálogo por categoría
 *
 * Incidente: tras agregar `categoria` a producto_base, filas legado
 * sincronizadas antes de correr la migración en producción llegan con
 * `categoria: undefined`. `agruparPorCategoria` las descartaba en vez de
 * mostrarlas, dejando el catálogo completamente en blanco (ni productos
 * ni mensaje de "sin productos"). Este archivo blinda que eso no pase:
 * ningún producto debe desaparecer, sin importar su `categoria`.
 */

import { describe, it, expect } from 'vitest';
import {
  agruparPorCategoria,
  ORDEN_CATEGORIAS,
  NOMBRE_CATEGORIA,
  CATEGORIA_DESCONOCIDA,
} from '../src/lib/categoriaProducto';
import type { CategoriaProducto } from '../src/db/schema';

interface ProductoDePrueba {
  id: string;
  categoria: CategoriaProducto;
}

const producto = (id: string, categoria: unknown): ProductoDePrueba => ({
  id,
  categoria: categoria as CategoriaProducto,
});

describe('agruparPorCategoria', () => {
  it('CATP-001: agrupa categorías conocidas en el orden de ORDEN_CATEGORIAS y omite las vacías', () => {
    const productos = [
      producto('1', 'quimicos'),
      producto('2', 'escobas'),
      producto('3', 'quimicos'),
    ];

    const grupos = agruparPorCategoria(productos);

    expect(grupos.map((g) => g.categoria)).toEqual(['escobas', 'quimicos']);
    expect(grupos.find((g) => g.categoria === 'quimicos')?.items).toHaveLength(2);
  });

  it('CATP-002: un producto con categoria undefined cae en "sin_categoria", no desaparece', () => {
    const productos = [producto('1', 'quimicos'), producto('2', undefined)];

    const grupos = agruparPorCategoria(productos);
    const sinCategoria = grupos.find((g) => g.categoria === CATEGORIA_DESCONOCIDA);

    expect(sinCategoria?.items.map((p) => p.id)).toEqual(['2']);
  });

  it('CATP-003: un valor de categoria inesperado (typo/legado) también cae en "sin_categoria"', () => {
    const productos = [producto('1', 'quimico'), producto('2', null)];

    const grupos = agruparPorCategoria(productos);
    const sinCategoria = grupos.find((g) => g.categoria === CATEGORIA_DESCONOCIDA);

    expect(sinCategoria?.items).toHaveLength(2);
  });

  it('CATP-004: reproduce el incidente — 34 productos sin categoría + 1 con categoría no quedan en blanco', () => {
    const productos = [
      ...Array.from({ length: 34 }, (_, i) => producto(`legado-${i}`, undefined)),
      producto('nuevo', 'quimicos'),
    ];

    const grupos = agruparPorCategoria(productos);
    const totalItems = grupos.reduce((sum, g) => sum + g.items.length, 0);

    expect(totalItems).toBe(35);
    expect(grupos.find((g) => g.categoria === CATEGORIA_DESCONOCIDA)?.items).toHaveLength(34);
  });

  it('CATP-005: invariante — nunca se pierde un producto, sin importar su categoria', () => {
    const productos = [
      producto('1', 'escobas'),
      producto('2', undefined),
      producto('3', 'valor-invalido'),
      producto('4', 'papel_institucional'),
    ];

    const grupos = agruparPorCategoria(productos);
    const totalItems = grupos.reduce((sum, g) => sum + g.items.length, 0);

    expect(totalItems).toBe(productos.length);
  });

  it('CATP-006: toda categoría devuelta tiene una etiqueta en NOMBRE_CATEGORIA', () => {
    const productos = [producto('1', undefined), ...ORDEN_CATEGORIAS.map((c, i) => producto(`${i}`, c))];

    const grupos = agruparPorCategoria(productos);

    for (const grupo of grupos) {
      expect(NOMBRE_CATEGORIA[grupo.categoria]).toBeTruthy();
    }
    expect(NOMBRE_CATEGORIA[CATEGORIA_DESCONOCIDA]).toBe('Sin categoría');
  });
});
