/**
 * Logiclean Ruta — useRegistrosNegocio hook (Inc 3, recortado a Backoffice
 * en el refactor de Inventario de bodega)
 *
 * Gastos de backoffice del negocio, que alimentan el corte. La recepción y
 * devolución con La Moderna se movió a `useRecepcionModerna` / la página
 * dedicada `RecepcionModernaPage` (alcanzable desde el FAB de Inventario).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarGasto } from '../lib/gastos';
import type { RegistrarGastoInput } from '../lib/gastos';
import type { Gasto } from '../db/schema';

export interface UseRegistrosNegocioReturn {
  gastosBackoffice: Gasto[];
  loading: boolean;
  crearGastoBackoffice: (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRegistrosNegocio(): UseRegistrosNegocioReturn {
  const [gastosBackoffice, setGastosBackoffice] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const gastos = await db.gasto.where('tipo').equals('backoffice').toArray();
    setGastosBackoffice(gastos.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const crearGastoBackoffice = useCallback(
    async (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => {
      await registrarGasto({ ...input, tipo: 'backoffice' });
      await load();
    },
    [load]
  );

  return {
    gastosBackoffice,
    loading,
    crearGastoBackoffice,
    refresh: load,
  };
}
