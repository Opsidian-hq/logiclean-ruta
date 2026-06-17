/**
 * Logiclean Ruta — Tests: resiliencia de almacenamiento (T2)
 *
 * STORAGE-001: detecta uso por encima del umbral (80% por defecto)
 * STORAGE-002: cuota desconocida / vacía no dispara alarma
 */

import { describe, it, expect } from 'vitest';
import { esAlmacenamientoBajo, UMBRAL_ALMACENAMIENTO_BAJO } from '../src/lib/storage';

describe('esAlmacenamientoBajo (T2)', () => {
  it('STORAGE-001: true cuando el uso alcanza/supera el 80% de la cuota', () => {
    expect(UMBRAL_ALMACENAMIENTO_BAJO).toBe(0.8);
    expect(esAlmacenamientoBajo(80, 100)).toBe(true); // exactamente el umbral
    expect(esAlmacenamientoBajo(95, 100)).toBe(true);
    expect(esAlmacenamientoBajo(50, 100)).toBe(false);
  });

  it('STORAGE-002: cuota 0/desconocida no alarma (sin datos no se asume)', () => {
    expect(esAlmacenamientoBajo(123, 0)).toBe(false);
    expect(esAlmacenamientoBajo(0, 0)).toBe(false);
  });

  it('STORAGE-003: el umbral es configurable', () => {
    expect(esAlmacenamientoBajo(60, 100, 0.5)).toBe(true);
    expect(esAlmacenamientoBajo(60, 100, 0.9)).toBe(false);
  });
});
