/**
 * Logiclean Ruta — Tests: reconciliación con La Moderna (Inc 3, actualizado Inc 6.2)
 *
 * SUM-001: adeudo = (recibido − devuelto) × precio_preferencial por producto
 * SUM-002: suma varios suministros del mismo producto base
 * SUM-003: ignora productos sin catálogo; total es la suma de adeudos
 *
 * El registro de suministro (antes registrarSuministro, captura manual) se
 * retiró en Inc 6.2 (ADR-0006): ver tests/recepcion.test.ts para el registro
 * de recepción que ahora alimenta el rollup.
 */

import { describe, it, expect } from 'vitest';
import { adeudoLaModerna } from '../src/lib/suministro';

const productos = [
  { id: 'pb-cloro', nombre: 'Cloro', precio_preferencial: 120 },
  { id: 'pb-jabon', nombre: 'Jabón', precio_preferencial: 90 },
];

describe('adeudoLaModerna', () => {
  it('SUM-001: adeudo por producto = neto × precio preferencial', () => {
    const r = adeudoLaModerna(
      [{ producto_base_id: 'pb-cloro', cantidad_recibida: 10, cantidad_devuelta: 3 }],
      productos
    );
    expect(r.porProducto[0].neto).toBe(7);
    expect(r.porProducto[0].adeudo).toBe(840); // 7 × 120
    expect(r.total).toBe(840);
  });

  it('SUM-002: agrega varios suministros del mismo producto', () => {
    const r = adeudoLaModerna(
      [
        { producto_base_id: 'pb-cloro', cantidad_recibida: 10, cantidad_devuelta: 2 },
        { producto_base_id: 'pb-cloro', cantidad_recibida: 5, cantidad_devuelta: 1 },
      ],
      productos
    );
    expect(r.porProducto[0].recibido).toBe(15);
    expect(r.porProducto[0].devuelto).toBe(3);
    expect(r.porProducto[0].adeudo).toBe(12 * 120);
  });

  it('SUM-003: ignora productos sin catálogo; total suma adeudos', () => {
    const r = adeudoLaModerna(
      [
        { producto_base_id: 'pb-cloro', cantidad_recibida: 4, cantidad_devuelta: 0 },
        { producto_base_id: 'pb-jabon', cantidad_recibida: 2, cantidad_devuelta: 0 },
        { producto_base_id: 'fantasma', cantidad_recibida: 9, cantidad_devuelta: 0 },
      ],
      productos
    );
    expect(r.porProducto).toHaveLength(2);
    expect(r.total).toBe(4 * 120 + 2 * 90);
  });
});
