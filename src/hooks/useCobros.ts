/**
 * Logiclean Ruta — useCobros / useSaldoCliente hooks
 *
 * Envuelven la capa `lib/cobros` para la UI de cobranza (Flujo C, H-07).
 * La escritura es local e instantánea; nunca se bloquea esperando al servidor.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  desgloseCliente as desgloseClienteLib,
  registrarCobro as registrarCobroLib,
  registrarCobroCliente as registrarCobroClienteLib,
} from '../lib/cobros';
import type {
  DesgloseCliente,
  RegistrarCobroInput,
  RegistrarCobroClienteInput,
} from '../lib/cobros';
import type { Cobro } from '../db/schema';

// ── Registro de cobros ────────────────────────────────────────

export interface UseCobrosReturn {
  registrarCobro: (input: RegistrarCobroInput) => Promise<Cobro>;
  registrarCobroCliente: (input: RegistrarCobroClienteInput) => Promise<Cobro[]>;
  submitting: boolean;
  error: string | null;
}

export function useCobros(): UseCobrosReturn {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSubmitting(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const registrarCobro = useCallback(
    (input: RegistrarCobroInput) => run(() => registrarCobroLib(input)),
    [run]
  );
  const registrarCobroCliente = useCallback(
    (input: RegistrarCobroClienteInput) => run(() => registrarCobroClienteLib(input)),
    [run]
  );

  return { registrarCobro, registrarCobroCliente, submitting, error };
}

// ── Saldo derivado del cliente ────────────────────────────────

export interface UseSaldoClienteReturn {
  desglose: DesgloseCliente | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Deriva y observa el saldo del cliente (ventas − cobros). El cálculo es local;
 * el estado `loading` cubre el skeleton breve mientras se suma (P3 · Cargando).
 */
export function useSaldoCliente(clienteId: string | null): UseSaldoClienteReturn {
  const [desglose, setDesglose] = useState<DesgloseCliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clienteId) {
      setDesglose(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await desgloseClienteLib(clienteId);
      setDesglose(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { desglose, loading, error, refresh: load };
}
