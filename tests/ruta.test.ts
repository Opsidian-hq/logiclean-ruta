/**
 * Logiclean Ruta — Tests: ruta del día (H-08)
 *
 * RUTA-001: incluye por día de ruta == día de la semana actual (con acentos/mayúsculas)
 * RUTA-002: incluye por fecha_proxima_visita == hoy
 * RUTA-003: unión — basta con cumplir una de las dos condiciones
 * RUTA-004: excluye inactivos y los que no tocan hoy
 * RUTA-005: incluye tanto prospectos como activos, ordenados por nombre
 */

import { describe, it, expect } from 'vitest';
import { esRutaDeHoy, clientesDeHoy, diaSemana } from '../src/lib/ruta';
import type { Cliente } from '../src/db/schema';

// Lunes 2026-06-15 (mediodía local para evitar bordes de zona horaria).
const LUNES = new Date(2026, 5, 15, 12, 0, 0);

function cliente(parcial: Partial<Cliente>): Cliente {
  return {
    id: parcial.id ?? 'c',
    vendedor_id: 'v1',
    nombre: parcial.nombre ?? 'Cliente',
    tipo: 'mayoreo',
    estado: 'activo',
    ciclo_visita: 1,
    dia_ruta: parcial.dia_ruta ?? null,
    fecha_proxima_visita: parcial.fecha_proxima_visita ?? null,
    activo: parcial.activo ?? true,
    ...parcial,
  };
}

describe('diaSemana', () => {
  it('mapea correctamente el día de la semana', () => {
    expect(diaSemana(LUNES)).toBe('lunes');
  });
});

describe('esRutaDeHoy', () => {
  it('RUTA-001: coincide por día de ruta ignorando acentos y mayúsculas', () => {
    expect(esRutaDeHoy(cliente({ dia_ruta: 'Lunes' }), LUNES)).toBe(true);
    expect(esRutaDeHoy(cliente({ dia_ruta: 'LUNES' }), LUNES)).toBe(true);
    expect(esRutaDeHoy(cliente({ dia_ruta: 'martes' }), LUNES)).toBe(false);
  });

  it('RUTA-002: coincide por fecha próxima de visita == hoy', () => {
    expect(
      esRutaDeHoy(cliente({ fecha_proxima_visita: '2026-06-15' }), LUNES)
    ).toBe(true);
    expect(
      esRutaDeHoy(cliente({ fecha_proxima_visita: '2026-06-16' }), LUNES)
    ).toBe(false);
  });

  it('RUTA-003: unión — basta una de las dos condiciones', () => {
    // Día no coincide pero la fecha sí.
    expect(
      esRutaDeHoy(
        cliente({ dia_ruta: 'viernes', fecha_proxima_visita: '2026-06-15' }),
        LUNES
      )
    ).toBe(true);
  });
});

describe('clientesDeHoy', () => {
  it('RUTA-004/005: filtra activos de hoy, incluye prospectos y ordena por nombre', () => {
    const lista: Cliente[] = [
      cliente({ id: '1', nombre: 'Zeta', dia_ruta: 'Lunes', estado: 'activo' }),
      cliente({ id: '2', nombre: 'Alfa', dia_ruta: 'Lunes', estado: 'prospecto' }),
      cliente({ id: '3', nombre: 'Beta', dia_ruta: 'Martes' }), // otro día → fuera
      cliente({ id: '4', nombre: 'Gamma', dia_ruta: 'Lunes', activo: false }), // inactivo → fuera
    ];

    const hoy = clientesDeHoy(lista, LUNES);

    expect(hoy.map((c) => c.nombre)).toEqual(['Alfa', 'Zeta']);
    expect(hoy.map((c) => c.estado)).toContain('prospecto');
  });
});
