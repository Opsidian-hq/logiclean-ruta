/**
 * Logiclean Ruta — Lógica de "ruta del día" (H-08)
 *
 * Funciones puras (sin Dexie ni red), trazables a QA. Un cliente entra a la
 * ruta de hoy si su `dia_ruta` coincide con el día de la semana actual **o**
 * si su `fecha_proxima_visita` es hoy (decisión: unión día + fecha).
 *
 * `dia_ruta` es texto libre (p. ej. "Lunes", "miércoles"), así que se compara
 * normalizando mayúsculas y acentos.
 */

import type { Cliente } from '../db/schema';

// JS getDay(): 0 = domingo … 6 = sábado
const DIAS_SEMANA = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const;

/** minúsculas, sin acentos, sin espacios extremos. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Nombre normalizado del día de la semana de una fecha (local). */
export function diaSemana(fecha: Date): string {
  return DIAS_SEMANA[fecha.getDay()];
}

/** Fecha local en formato ISO (YYYY-MM-DD), sin corrimiento por zona horaria. */
export function fechaISOLocal(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ¿Este cliente debe visitarse hoy? (unión: día de ruta o fecha próxima). */
export function esRutaDeHoy(cliente: Cliente, hoy: Date = new Date()): boolean {
  const porDia =
    !!cliente.dia_ruta && normalizar(cliente.dia_ruta) === diaSemana(hoy);
  const porFecha =
    !!cliente.fecha_proxima_visita &&
    cliente.fecha_proxima_visita.slice(0, 10) === fechaISOLocal(hoy);
  return porDia || porFecha;
}

/**
 * Clientes/prospectos activos a visitar hoy, ordenados por orden_ruta del
 * vendedor (si está asignado) y luego alfabéticamente como desempate.
 * Incluye ambos estados (prospecto y activo); la urgencia/vencidos es Inc 2.
 */
export function clientesDeHoy(
  clientes: Cliente[],
  hoy: Date = new Date()
): Cliente[] {
  return clientes
    .filter((c) => c.activo && esRutaDeHoy(c, hoy))
    .sort((a, b) => {
      const oa = a.orden_ruta ?? Infinity;
      const ob = b.orden_ruta ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
}
