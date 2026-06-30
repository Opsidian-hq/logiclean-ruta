/**
 * Logiclean Ruta — useGastos hook (H-12)
 *
 * Gastos de ruta del vendedor actual: registro de baja fricción + lista del
 * periodo activo (desde el último corte hasta hoy) con totales por bolsa.
 * Lee/escribe en Dexie (offline-first).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import {
  registrarGasto as registrarGastoLib,
  totalesPorBolsa,
} from '../lib/gastos';
import type { RegistrarGastoInput } from '../lib/gastos';
import { ultimoPeriodoFin } from '../lib/corteData';
import { useAuthContext } from '../context/AuthContext';
import type { Gasto } from '../db/schema';

export type RegistrarGastoArgs = Omit<RegistrarGastoInput, 'vendedorId'>;

export interface UseGastosReturn {
  gastosPeriodo: Gasto[];
  /** Fecha ISO del último corte ('' si no hay cortes previos). */
  periodoInicio: string;
  totales: { efectivo: number; transferencia: number };
  loading: boolean;
  error: string | null;
  registrarGasto: (args: RegistrarGastoArgs) => Promise<Gasto>;
  refresh: () => Promise<void>;
}

export function useGastos(): UseGastosReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [gastosPeriodo, setGastosPeriodo] = useState<Gasto[]>([]);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    if (!vendedorId) {
      setGastosPeriodo([]);
      setLoading(false);
      return;
    }
    try {
      const inicio = await ultimoPeriodoFin(vendedorId);
      setPeriodoInicio(inicio);
      const todos = await db.gasto
        .where('vendedor_id')
        .equals(vendedorId)
        .toArray();
      const delPeriodo = todos
        .filter((g) => !inicio || g.fecha.slice(0, 10) > inicio)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      setGastosPeriodo(delPeriodo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  const registrarGasto = useCallback(
    async (args: RegistrarGastoArgs): Promise<Gasto> => {
      if (!vendedorId) throw new Error('No hay vendedor en sesión.');
      const gasto = await registrarGastoLib({ ...args, vendedorId });
      await loadFromLocal();
      return gasto;
    },
    [vendedorId, loadFromLocal]
  );

  return {
    gastosPeriodo,
    periodoInicio,
    totales: totalesPorBolsa(gastosPeriodo),
    loading,
    error,
    registrarGasto,
    refresh,
  };
}
