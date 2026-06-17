/**
 * Logiclean Ruta — Tests: lógica de precios de venta (H-04)
 *
 * PRECIO-001: cliente de mayoreo aplica precio_mayoreo
 * PRECIO-002: cliente de menudeo aplica precio_menudeo
 * PRECIO-003: total = suma de importes, redondeado a 2 decimales
 */

import { describe, it, expect } from 'vitest';
import {
  precioUnitario,
  importeLinea,
  totalVenta,
  calcularIVA,
  totalConFactura,
  IVA_TASA,
} from '../src/lib/precios';

const pres = { precio_mayoreo: 100, precio_menudeo: 130 };

describe('precioUnitario', () => {
  it('PRECIO-001: mayoreo aplica la lista de mayoreo', () => {
    expect(precioUnitario(pres, 'mayoreo')).toBe(100);
  });

  it('PRECIO-002: menudeo aplica la lista de menudeo', () => {
    expect(precioUnitario(pres, 'menudeo')).toBe(130);
  });
});

describe('totalVenta', () => {
  it('PRECIO-003: suma los importes de las líneas', () => {
    const total = totalVenta([
      { cantidad: 3, precio_unitario: 100 },
      { cantidad: 2, precio_unitario: 130 },
    ]);
    expect(total).toBe(560);
  });

  it('PRECIO-003b: redondea a 2 decimales sin ruido de punto flotante', () => {
    expect(importeLinea(3, 0.1)).toBe(0.3);
    expect(totalVenta([{ cantidad: 3, precio_unitario: 0.1 }])).toBe(0.3);
  });
});

// ── [H-06·1] precio de lista + IVA en venta facturable ────────
describe('facturación: precio de lista + IVA (H-06)', () => {
  it('PRECIO-004: IVA = 16% del subtotal, redondeado a centavos', () => {
    expect(IVA_TASA).toBe(0.16);
    expect(calcularIVA(386)).toBe(61.76);
    expect(calcularIVA(560)).toBe(89.6);
  });

  it('PRECIO-005: facturable → subtotal + IVA; no facturable → subtotal', () => {
    expect(totalConFactura(386, true)).toBe(447.76); // 386 + 61.76
    expect(totalConFactura(386, false)).toBe(386);
  });
});
