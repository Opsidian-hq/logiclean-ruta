/**
 * Logiclean Ruta — Datos de la cuenta para transferencia
 *
 * Cuenta a la que el cliente transfiere. Se muestra en pantalla (solo lectura)
 * para girar el equipo hacia el cliente cuando elige "Transferencia" (P1).
 * Valores tomados del prototipo aprobado `Cobranza_en_ruta.html`.
 *
 * En producción esto vendría de la configuración del negocio; aquí es una
 * constante de presentación (este incremento no captura ni edita la cuenta).
 */

export interface CuentaTransferencia {
  banco: string;
  titular: string;
  numero: string;
  clabe: string;
}

export const CUENTA_TRANSFERENCIA: CuentaTransferencia = {
  banco: 'BBVA',
  titular: 'Logiclean S.A. de C.V.',
  numero: '4152 3137 0098 4471',
  clabe: '012 320 ··· 471',
};
