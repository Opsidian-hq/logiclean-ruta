/**
 * Logiclean Ruta — Formato de moneda
 *
 * Cifras en pesos con dos decimales y separador de miles. Se usa con la clase
 * `.numeric` (cifras tabulares) en la UI.
 */
export function money(n: number): string {
  return `$${n.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
