/**
 * Logiclean Ruta — Tests: conversión presentación ↔ unidad de compra (H-11)
 *
 * CONV-001: presentaciones / factor = unidades de compra
 * CONV-002: factor inválido (≤0) devuelve 0, no NaN/Infinity
 * CONV-003: agrega inventario por producto base sumando presentaciones
 * CONV-004: ignora presentaciones sin catálogo conocido
 */

import { describe, it, expect } from 'vitest';
import {
  presentacionesAUnidadCompra,
  inventarioAUnidadCompra,
} from '../src/lib/conversion';

describe('presentacionesAUnidadCompra', () => {
  it('CONV-001: divide por el factor (10 botellas / 10 por bidón = 1 bidón)', () => {
    expect(presentacionesAUnidadCompra(10, 10)).toBe(1);
    expect(presentacionesAUnidadCompra(25, 10)).toBe(2.5);
  });

  it('CONV-002: factor inválido devuelve 0', () => {
    expect(presentacionesAUnidadCompra(10, 0)).toBe(0);
    expect(presentacionesAUnidadCompra(10, -3)).toBe(0);
  });
});

describe('inventarioAUnidadCompra', () => {
  const presentaciones = [
    { id: 'p-cloro1', producto_base_id: 'pb-cloro', factor_conversion: 10 },
    { id: 'p-cloro37', producto_base_id: 'pb-cloro', factor_conversion: 2 },
    { id: 'p-jabon1', producto_base_id: 'pb-jabon', factor_conversion: 10 },
  ];

  it('CONV-003: suma presentaciones del mismo producto base', () => {
    const res = inventarioAUnidadCompra(
      [
        { presentacion_id: 'p-cloro1', cantidad: 20 }, // 20/10 = 2 bidones
        { presentacion_id: 'p-cloro37', cantidad: 6 }, // 6/2  = 3 bidones
        { presentacion_id: 'p-jabon1', cantidad: 10 }, // 10/10 = 1 bidón
      ],
      presentaciones
    );
    const cloro = res.find((r) => r.producto_base_id === 'pb-cloro');
    const jabon = res.find((r) => r.producto_base_id === 'pb-jabon');
    expect(cloro?.unidades).toBe(5);
    expect(jabon?.unidades).toBe(1);
  });

  it('CONV-004: ignora presentaciones sin catálogo conocido', () => {
    const res = inventarioAUnidadCompra(
      [{ presentacion_id: 'desconocida', cantidad: 99 }],
      presentaciones
    );
    expect(res).toHaveLength(0);
  });
});
