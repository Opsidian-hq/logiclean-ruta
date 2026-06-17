/**
 * Logiclean Ruta — Folio local
 *
 * Mientras un registro no se sincroniza, se muestra un folio local derivado de
 * su UUID de cliente ("LC-TMP-XXXX"). El folio oficial (p. ej. LC-0429) llega
 * desde el servidor al sincronizar; el UUID es la identidad real para deduplicar.
 */
export function folioLocal(uuid: string): string {
  const hex = uuid.replace(/[^0-9a-fA-F]/g, '').slice(0, 4).toUpperCase();
  return `LC-TMP-${hex.padEnd(4, '0')}`;
}
