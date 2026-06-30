/**
 * Logiclean Ruta — Días de visita (forma de display)
 *
 * Lista canónica de nombres de día usada por DiaVisitaSelect y por los
 * formularios que preseleccionan el día de hoy. Para comparar/normalizar
 * `dia_ruta` contra la fecha, ver `lib/ruta.ts`.
 */

/** Días de visita en orden de la semana laboral (lunes primero). */
export const DIAS_VISITA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/** Nombre del día de la semana actual (p. ej. "Martes"), en el mismo formato que DIAS_VISITA. */
export function diaVisitaHoy(): string {
  const idx = (new Date().getDay() + 6) % 7; // getDay(): 0=Dom..6=Sáb → reindexa a 0=Lunes..6=Domingo
  return DIAS_VISITA[idx];
}
