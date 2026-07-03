/**
 * Logiclean Ruta — Tests Inc 6.6: resolución de nombres del seed de relanzamiento
 *
 * scripts/seed-inc6-relanzamiento.mjs es un script de una sola vez (cutover);
 * no se ejecuta en este entorno (requiere SUPABASE_SERVICE_ROLE_KEY real y el
 * conteo físico del PM — ver el propio script). Esta suite cubre la pieza
 * pura y de mayor riesgo: resolver los nombres del archivo de conteo contra
 * el catálogo, donde un match equivocado sembraría el producto/vendedor
 * incorrecto.
 *
 * SEED-001: resuelve un nombre único a su id
 * SEED-002: falla (null) si el nombre no existe
 * SEED-003: falla (null) si el nombre es ambiguo — más seguro que adivinar
 */

import { describe, it, expect } from 'vitest';
import { resolverPorNombre } from '../scripts/seed-inc6-relanzamiento.mjs';

const catalogo = [
  { id: 'id-1', nombre: 'Limpiador Multiusos Canela Logiclean' },
  { id: 'id-2', nombre: 'Limpiador Multiusos Mar Fresco Logiclean' },
  { id: 'id-3', nombre: 'Escoba mixta 6 hilos La Moderna' },
];

describe('resolverPorNombre', () => {
  it('SEED-001: resuelve un nombre único a su id', () => {
    expect(resolverPorNombre(catalogo, 'Limpiador Multiusos Canela Logiclean', 'Producto base')).toBe('id-1');
  });

  it('SEED-002: devuelve null si el nombre no existe en el catálogo', () => {
    expect(resolverPorNombre(catalogo, 'Producto que no existe', 'Producto base')).toBeNull();
  });

  it('SEED-003: devuelve null si el nombre es ambiguo (no adivina)', () => {
    const conDuplicado = [...catalogo, { id: 'id-1-bis', nombre: 'Limpiador Multiusos Canela Logiclean' }];
    expect(resolverPorNombre(conDuplicado, 'Limpiador Multiusos Canela Logiclean', 'Producto base')).toBeNull();
  });
});
