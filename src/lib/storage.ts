/**
 * Logiclean Ruta — Resiliencia de almacenamiento offline (T2)
 *
 * Mitigaciones del ADR-0002 para la fragilidad del offline en iPhone (PWA):
 *  - Solicitar almacenamiento **persistente** para reducir el riesgo de que iOS
 *    purgue la BD local sin avisar.
 *  - Estimar el uso vs. la cuota para advertir al usuario cuando el espacio
 *    escasea (antes de que una purga le cueste datos).
 *
 * Estas funciones NO tocan la lógica de sync ni el esquema local; solo leen el
 * estado del almacenamiento del navegador y registran diagnóstico en consola.
 */

/** Umbral por defecto: 80% de la cuota → se considera "almacenamiento bajo". */
export const UMBRAL_ALMACENAMIENTO_BAJO = 0.8;

export interface EstimacionAlmacenamiento {
  usage: number;
  quota: number;
  /** uso / cuota (0 si la cuota es desconocida). */
  ratio: number;
  /** El uso superó el umbral de la cuota. */
  bajo: boolean;
}

/**
 * Pura: ¿el uso supera el umbral de la cuota? Si la cuota es 0/desconocida,
 * no se puede afirmar que esté bajo → false (no se alarma sin datos).
 */
export function esAlmacenamientoBajo(
  usage: number,
  quota: number,
  umbral: number = UMBRAL_ALMACENAMIENTO_BAJO
): boolean {
  if (!quota || quota <= 0) return false;
  return usage / quota >= umbral;
}

/**
 * Solicita almacenamiento persistente al navegador. Si ya es persistente, no
 * vuelve a pedir. Nunca bloquea la operación: solo registra el resultado para
 * diagnóstico. Devuelve si el almacenamiento quedó persistente.
 */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
      return false;
    }
    if (navigator.storage.persisted) {
      const yaPersistente = await navigator.storage.persisted();
      if (yaPersistente) {
        console.info('[storage] El almacenamiento ya es persistente.');
        return true;
      }
    }
    const concedido = await navigator.storage.persist();
    console.info(
      `[storage] navigator.storage.persist() → ${concedido ? 'concedido' : 'rechazado'}.`
    );
    return concedido;
  } catch (err) {
    console.warn('[storage] No se pudo solicitar persistencia:', err);
    return false;
  }
}

/**
 * Estima el uso y la cuota del almacenamiento local. Devuelve null si el
 * navegador no expone `storage.estimate` (no se puede medir → no se alarma).
 */
export async function estimarAlmacenamiento(
  umbral: number = UMBRAL_ALMACENAMIENTO_BAJO
): Promise<EstimacionAlmacenamiento | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      return null;
    }
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      usage,
      quota,
      ratio: quota > 0 ? usage / quota : 0,
      bajo: esAlmacenamientoBajo(usage, quota, umbral),
    };
  } catch (err) {
    console.warn('[storage] No se pudo estimar el almacenamiento:', err);
    return null;
  }
}
