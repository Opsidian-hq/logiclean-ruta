/**
 * Logiclean Ruta — UUID generado en cliente
 *
 * PKs siempre se generan en el cliente (no autoincrementales).
 * Esto garantiza que las operaciones offline tengan IDs válidos
 * antes de sincronizar con el servidor, eliminando colisiones y
 * permitiendo upsert idempotente por `id`.
 *
 * crypto.randomUUID() es parte del estándar Web Crypto API
 * (disponible en todos los browsers modernos y Node.js 14.17+).
 */

/**
 * Genera un UUID v4 usando crypto.randomUUID().
 * Devuelve una cadena de 36 caracteres en formato
 * xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para entornos sin crypto.randomUUID (tests con Node < 14.17)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
