/**
 * Logiclean Ruta — Lógica de seguimiento de prospectos (H-02, H-03)
 *
 * Funciones puras (sin Dexie ni red), trazables a QA:
 *  - clasificación de vencimiento de la próxima visita,
 *  - lista "de la semana" (vencidos + por vencer hasta el domingo),
 *  - embudo por etapa del ciclo,
 *  - adherencia histórica al seguimiento (¿la siguiente visita llegó a tiempo?).
 */

import type { Cliente, Visita } from '../db/schema';
import { fechaISOLocal } from './ruta';

/** Longitud objetivo del ciclo de visitas ("visita N de 4"). */
export const CICLO_OBJETIVO = 4;

export type Vencimiento = 'vencido' | 'por_vencer' | 'al_dia';

/** Domingo (fin) de la semana de `fecha`, en ISO local (YYYY-MM-DD). */
export function finDeSemana(fecha: Date): string {
  const dia = fecha.getDay(); // 0 = domingo … 6 = sábado
  const diasHastaDomingo = dia === 0 ? 0 : 7 - dia;
  const domingo = new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate() + diasHastaDomingo
  );
  return fechaISOLocal(domingo);
}

/**
 * Clasifica la próxima visita de un cliente respecto a hoy:
 *  - 'vencido'    si la fecha ya pasó,
 *  - 'por_vencer' si cae entre hoy y el domingo de esta semana,
 *  - 'al_dia'     si es posterior (o no hay fecha agendada).
 */
export function clasificarVencimiento(
  cliente: Pick<Cliente, 'fecha_proxima_visita'>,
  hoy: Date = new Date()
): Vencimiento {
  const fecha = cliente.fecha_proxima_visita?.slice(0, 10);
  if (!fecha) return 'al_dia';

  const hoyISO = fechaISOLocal(hoy);
  if (fecha < hoyISO) return 'vencido';
  if (fecha <= finDeSemana(hoy)) return 'por_vencer';
  return 'al_dia';
}

/**
 * Prospectos a atender esta semana: vencidos (de cualquier fecha) + por vencer
 * hasta el domingo, ordenados por urgencia (fecha ascendente → los más
 * atrasados primero).
 */
export function prospectosDeLaSemana(
  clientes: Cliente[],
  hoy: Date = new Date()
): Cliente[] {
  return clientes
    .filter((c) => c.activo && c.estado === 'prospecto')
    .filter((c) => {
      const v = clasificarVencimiento(c, hoy);
      return v === 'vencido' || v === 'por_vencer';
    })
    .sort((a, b) =>
      (a.fecha_proxima_visita ?? '').localeCompare(b.fecha_proxima_visita ?? '')
    );
}

// ── Embudo (H-03) ─────────────────────────────────────────────

export interface EmbudoEtapa {
  etapa: number; // 1 … CICLO_OBJETIVO
  count: number;
}

export interface Embudo {
  etapas: EmbudoEtapa[];
  /** Prospectos convertidos = clientes activos (cartera activa). */
  convertidos: number;
}

/**
 * Cuenta prospectos por etapa del ciclo (1ª … 4ª visita) y los convertidos.
 * El ciclo se acota al objetivo: un prospecto con ciclo_visita > 4 se cuenta en
 * la etapa 4.
 */
export function embudoPorEtapa(clientes: Cliente[]): Embudo {
  const etapas: EmbudoEtapa[] = Array.from(
    { length: CICLO_OBJETIVO },
    (_, i) => ({ etapa: i + 1, count: 0 })
  );

  let convertidos = 0;

  for (const c of clientes) {
    if (!c.activo) continue;
    if (c.estado === 'activo') {
      convertidos++;
      continue;
    }
    // prospecto
    const etapa = Math.min(Math.max(c.ciclo_visita, 1), CICLO_OBJETIVO);
    etapas[etapa - 1].count++;
  }

  return { etapas, convertidos };
}

// ── Adherencia (H-03) ─────────────────────────────────────────

export interface Adherencia {
  /** Porcentaje 0–100; 0 si no hay base de cálculo. */
  pct: number;
  aTiempo: number;
  total: number;
}

/**
 * Adherencia histórica: de las visitas cuya próxima fecha agendada ya pasó
 * (es evaluable), ¿qué porcentaje tuvo una visita posterior registrada en o
 * antes de esa fecha? "Recibió su siguiente visita a tiempo" (PRD H-03).
 */
export function adherencia(visitas: Visita[], hoy: Date = new Date()): Adherencia {
  const hoyISO = fechaISOLocal(hoy);
  let total = 0;
  let aTiempo = 0;

  for (const v of visitas) {
    const agendada = v.fecha_proxima?.slice(0, 10);
    // Solo evaluable si tenía próxima fecha y ya pasó.
    if (!agendada || agendada >= hoyISO) continue;
    total++;

    const siguienteATiempo = visitas.some(
      (w) =>
        w.cliente_id === v.cliente_id &&
        w.id !== v.id &&
        w.fecha > v.fecha &&
        w.fecha <= agendada
    );
    if (siguienteATiempo) aTiempo++;
  }

  const pct = total === 0 ? 0 : Math.round((aTiempo / total) * 100);
  return { pct, aTiempo, total };
}
