/**
 * Logiclean Ruta — useGastos hook (H-12)
 *
 * Gastos de ruta del vendedor actual: registro de baja fricción + lista del día
 * con totales por bolsa. Lee/escribe en Dexie (offline-first).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import {
  registrarGasto as registrarGastoLib,
  totalesPorBolsa,
} from '../lib/gastos';
import type { RegistrarGastoInput } from '../lib/gastos';
import { useAuthContext } from '../context/AuthContext';
import type { Gasto } from '../db/schema';

export type RegistrarGastoArgs = Omit<RegistrarGastoInput, 'vendedorId'>;

export interface UseGastosReturn {
  gastosHoy: Gasto[];
  totales: { efectivo: number; transferencia: number };
  loading: boolean;
  error: string | null;
  registrarGasto: (args: RegistrarGastoArgs) => Promise<Gasto>;
  refresh: () => Promise<void>;
}

export function useGastos(): UseGastosReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [gastosHoy, setGastosHoy] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    if (!vendedorId) {
      setGastosHoy([]);
      setLoading(false);
      return;
    }
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const todos = await db.gasto
        .where('vendedor_id')
        .equals(vendedorId)
        .toArray();
      const delDia = todos
        .filter((g) => g.fecha.slice(0, 10) === hoy)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      setGastosHoy(delDia);
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
    gastosHoy,
    totales: totalesPorBolsa(gastosHoy),
    loading,
    error,
    registrarGasto,
    refresh,
  };
}
