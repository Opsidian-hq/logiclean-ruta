/**
 * Logiclean Ruta — Tests: seguimiento de prospectos (H-02, H-03)
 *
 * PROSP-001: clasificación vencido / por_vencer / al_dia (semana = hasta domingo)
 * PROSP-002: prospectosDeLaSemana = vencidos + por vencer, orden por urgencia
 * PROSP-003: embudoPorEtapa cuenta por etapa del ciclo y los convertidos
 * PROSP-004: adherencia histórica (¿llegó la siguiente visita a tiempo?)
 */

import { describe, it, expect } from 'vitest';
import {
  clasificarVencimiento,
  prospectosDeLaSemana,
  seguimientoDeLaSemana,
  embudoPorEtapa,
  adherencia,
  finDeSemana,
} from '../src/lib/prospectos';
import type { Cliente, Visita } from '../src/db/schema';

// Lunes 2026-06-15; domingo de esa semana = 2026-06-21.
const LUNES = new Date(2026, 5, 15, 12, 0, 0);

function cli(p: Partial<Cliente>): Cliente {
  return {
    id: p.id ?? 'c',
    vendedor_id: 'v1',
    nombre: p.nombre ?? 'C',
    tipo: 'menudeo',
    estado: p.estado ?? 'prospecto',
    ciclo_visita: p.ciclo_visita ?? 1,
    dia_ruta: null,
    fecha_proxima_visita: p.fecha_proxima_visita ?? null,
    activo: p.activo ?? true,
    ...p,
  };
}

describe('finDeSemana / clasificarVencimiento', () => {
  it('PROSP-001: domingo de la semana actual', () => {
    expect(finDeSemana(LUNES)).toBe('2026-06-21');
  });

  it('PROSP-001: clasifica según la próxima visita', () => {
    expect(clasificarVencimiento({ fecha_proxima_visita: '2026-06-10' }, LUNES)).toBe('vencido');
    expect(clasificarVencimiento({ fecha_proxima_visita: '2026-06-15' }, LUNES)).toBe('por_vencer');
    expect(clasificarVencimiento({ fecha_proxima_visita: '2026-06-21' }, LUNES)).toBe('por_vencer');
    expect(clasificarVencimiento({ fecha_proxima_visita: '2026-06-22' }, LUNES)).toBe('al_dia');
    expect(clasificarVencimiento({ fecha_proxima_visita: null }, LUNES)).toBe('al_dia');
  });
});

describe('prospectosDeLaSemana', () => {
  it('PROSP-002: incluye vencidos + por vencer, ordenados por urgencia', () => {
    const lista = [
      cli({ id: 'a', nombre: 'A', fecha_proxima_visita: '2026-06-18' }), // por vencer
      cli({ id: 'b', nombre: 'B', fecha_proxima_visita: '2026-06-05' }), // vencido (más urgente)
      cli({ id: 'c', nombre: 'C', fecha_proxima_visita: '2026-06-30' }), // al día → fuera
      cli({ id: 'd', nombre: 'D', fecha_proxima_visita: '2026-06-10', estado: 'activo' }), // activo → fuera
      cli({ id: 'e', nombre: 'E', fecha_proxima_visita: '2026-06-12', activo: false }), // inactivo → fuera
    ];
    const res = prospectosDeLaSemana(lista, LUNES);
    expect(res.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('seguimientoDeLaSemana', () => {
  it('PROSP-005: incluye prospectos Y clientes activos con visita/entrega esta semana', () => {
    const lista = [
      cli({ id: 'a', nombre: 'A', fecha_proxima_visita: '2026-06-18' }), // prospecto por vencer
      cli({ id: 'b', nombre: 'B', fecha_proxima_visita: '2026-06-05' }), // prospecto vencido
      cli({ id: 'd', nombre: 'D', fecha_proxima_visita: '2026-06-19', estado: 'activo' }), // activo con entrega → dentro
      cli({ id: 'f', nombre: 'F', fecha_proxima_visita: null, estado: 'activo' }), // activo sin fecha → fuera
      cli({ id: 'c', nombre: 'C', fecha_proxima_visita: '2026-06-30' }), // al día → fuera
      cli({ id: 'e', nombre: 'E', fecha_proxima_visita: '2026-06-12', activo: false }), // inactivo → fuera
    ];
    const res = seguimientoDeLaSemana(lista, LUNES);
    // Orden por urgencia (fecha asc): b(06-05), a(06-18), d(06-19)
    expect(res.map((c) => c.id)).toEqual(['b', 'a', 'd']);
  });
});

describe('embudoPorEtapa', () => {
  it('PROSP-003: cuenta por etapa y convertidos; ciclo>4 cae en etapa 4', () => {
    const lista = [
      cli({ id: '1', ciclo_visita: 1 }),
      cli({ id: '2', ciclo_visita: 2 }),
      cli({ id: '3', ciclo_visita: 2 }),
      cli({ id: '4', ciclo_visita: 5 }), // → etapa 4
      cli({ id: '5', estado: 'activo' }), // convertido
      cli({ id: '6', estado: 'prospecto', ciclo_visita: 1, activo: false }), // fuera
    ];
    const e = embudoPorEtapa(lista);
    expect(e.etapas).toEqual([
      { etapa: 1, count: 1 },
      { etapa: 2, count: 2 },
      { etapa: 3, count: 0 },
      { etapa: 4, count: 1 },
    ]);
    expect(e.convertidos).toBe(1);
  });
});

describe('adherencia', () => {
  it('PROSP-004: % de visitas cuya siguiente llegó en o antes de la fecha agendada', () => {
    const visitas: Visita[] = [
      // A: agendó 06-08, recibió visita el 06-07 → a tiempo
      { id: 'v1', cliente_id: 'A', vendedor_id: 'v', fecha: '2026-06-01', numero_ciclo: 1, fecha_proxima: '2026-06-08' },
      { id: 'w1', cliente_id: 'A', vendedor_id: 'v', fecha: '2026-06-07', numero_ciclo: 2 },
      // B: agendó 06-05, nunca recibió siguiente → no a tiempo
      { id: 'v2', cliente_id: 'B', vendedor_id: 'v', fecha: '2026-06-01', numero_ciclo: 1, fecha_proxima: '2026-06-05' },
      // C: agendó 06-20 (futuro respecto a hoy) → no evaluable
      { id: 'v3', cliente_id: 'C', vendedor_id: 'v', fecha: '2026-06-10', numero_ciclo: 1, fecha_proxima: '2026-06-20' },
    ];
    const a = adherencia(visitas, LUNES);
    expect(a.total).toBe(2);
    expect(a.aTiempo).toBe(1);
    expect(a.pct).toBe(50);
  });

  it('PROSP-004b: sin base de cálculo devuelve 0%', () => {
    expect(adherencia([], LUNES)).toEqual({ pct: 0, aTiempo: 0, total: 0 });
  });
});
