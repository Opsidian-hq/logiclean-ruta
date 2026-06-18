/**
 * Logiclean Ruta — Tests: formato de moneda (D-001)
 *
 * Todo monto monetario se muestra con exactamente 2 decimales en toda la app.
 * El defecto D-001 mostraba "362.5" en vez de "362.50" en el campo de cobro;
 * el formateador canónico `money` es la referencia de este invariante.
 */

import { describe, it, expect } from 'vitest';
import { money } from '../src/lib/money';

describe('[D-001] money formatea con exactamente 2 decimales', () => {
  it('MONEY-001: completa decimales faltantes (362.5 → $362.50)', () => {
    expect(money(362.5)).toBe('$362.50');
  });

  it('MONEY-002: entero se muestra con .00', () => {
    expect(money(200)).toBe('$200.00');
  });

  it('MONEY-003: redondea a 2 decimales y mantiene el formato', () => {
    expect(money(0)).toBe('$0.00');
    expect(money(1234.5)).toBe('$1,234.50');
  });
});
