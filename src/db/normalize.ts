/**
 * Logiclean Ruta — Normalización de filas para Dexie (IndexedDB)
 *
 * IndexedDB **no admite booleanos como clave de índice**: una fila con
 * `activo: true` queda fuera del índice `activo`, por lo que una consulta
 * `.where('activo').equals(1)` NO la encuentra.
 *
 * Para que los índices booleanos funcionen, en el límite de escritura a Dexie
 * convertimos cada booleano a `1`/`0`. El modelo de dominio (y el payload que
 * se envía a Supabase, donde la columna es BOOLEAN) sigue usando booleanos:
 * la normalización es exclusiva de la copia local.
 *
 * Convención de lectura ya existente en los hooks: `.where('activo').equals(1)`.
 */

/** Valor booleano almacenado como 1/0 para que IndexedDB lo indexe. */
export type DexieBool = 0 | 1;

/**
 * Devuelve una copia de la fila con todos los campos booleanos convertidos a
 * 1/0. No muta el objeto original. Los demás campos se conservan tal cual.
 */
export function toDexieRow<T extends object>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  }
  return out as T;
}
