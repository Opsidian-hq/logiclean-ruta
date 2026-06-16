/**
 * Logiclean Ruta — useVenta hook
 *
 * Envuelve `registrarVenta` (lib/ventas) inyectando el vendedor de la sesión
 * y exponiendo estado de envío. La escritura es local e instantánea: nunca se
 * bloquea esperando al servidor (offline-first).
 */

import { useState, useCallback } from 'react';
import { registrarVenta as registrarVentaLib } from '../lib/ventas';
import type {
  RegistrarVentaInput,
  RegistrarVentaResult,
} from '../lib/ventas';
import { useAuthContext } from '../context/AuthContext';

export type RegistrarVentaArgs = Omit<RegistrarVentaInput, 'vendedorId'>;

export interface UseVentaReturn {
  registrarVenta: (args: RegistrarVentaArgs) => Promise<RegistrarVentaResult>;
  submitting: boolean;
  error: string | null;
}

export function useVenta(): UseVentaReturn {
  const { user } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const registrarVenta = useCallback(
    async (args: RegistrarVentaArgs): Promise<RegistrarVentaResult> => {
      if (!user?.id) {
        throw new Error('No hay vendedor en sesión.');
      }
      setSubmitting(true);
      setError(null);
      try {
        return await registrarVentaLib({ ...args, vendedorId: user.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [user]
  );

  return { registrarVenta, submitting, error };
}
