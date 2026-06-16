/**
 * Logiclean Ruta — useRegistrosNegocio hook (Inc 3, Fase 4)
 *
 * Registros del negocio que alimentan el corte: suministro/devolución con La
 * Moderna y gastos de backoffice. Carga productos (para el selector) y las
 * listas recientes; expone los registradores (delegan en las libs puras).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarSuministro } from '../lib/suministro';
import { registrarGasto } from '../lib/gastos';
import type { RegistrarSuministroInput } from '../lib/suministro';
import type { RegistrarGastoInput } from '../lib/gastos';
import type { ProductoBase, SuministroLaModerna, Gasto } from '../db/schema';

export interface UseRegistrosNegocioReturn {
  productos: ProductoBase[];
  suministros: SuministroLaModerna[];
  gastosBackoffice: Gasto[];
  nombreProducto: (id: string) => string;
  loading: boolean;
  crearSuministro: (input: RegistrarSuministroInput) => Promise<void>;
  crearGastoBackoffice: (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRegistrosNegocio(): UseRegistrosNegocioReturn {
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [suministros, setSuministros] = useState<SuministroLaModerna[]>([]);
  const [gastosBackoffice, setGastosBackoffice] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prods, sums, gastos] = await Promise.all([
      db.producto_base.where('activo').equals(1).toArray(),
      db.suministro_la_moderna.toArray(),
      db.gasto.where('tipo').equals('backoffice').toArray(),
    ]);
    setProductos(prods);
    setSuministros(sums.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setGastosBackoffice(gastos.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const nombreProducto = useCallback(
    (id: string) => productos.find((p) => p.id === id)?.nombre ?? id,
    [productos]
  );

  const crearSuministro = useCallback(
    async (input: RegistrarSuministroInput) => {
      await registrarSuministro(input);
      await load();
    },
    [load]
  );

  const crearGastoBackoffice = useCallback(
    async (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => {
      await registrarGasto({ ...input, tipo: 'backoffice' });
      await load();
    },
    [load]
  );

  return {
    productos,
    suministros,
    gastosBackoffice,
    nombreProducto,
    loading,
    crearSuministro,
    crearGastoBackoffice,
    refresh: load,
  };
}
