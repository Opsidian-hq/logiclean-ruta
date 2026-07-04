/**
 * Logiclean Ruta — useVendedorResumen hook (H-15, resumen de vendedor)
 *
 * Carga de solo lectura del snapshot del periodo en curso de un vendedor
 * específico, para el resumen que se abre al tocarlo en "Caja por vendedor"
 * (Inicio). Reusa el mismo trío `ultimoPeriodoFin` → `cargarInsumosCorte` →
 * `calcularCorte` que `useCorte` y `useDashboard` — ningún cálculo nuevo.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { calcularCorte } from '../lib/corte';
import { cargarInsumosCorte, ultimoPeriodoFin } from '../lib/corteData';
import type { CorteSnapshot } from '../lib/corte';
import type { Vendedor } from '../db/schema';

export interface UseVendedorResumenReturn {
  vendedor: Vendedor | null;
  snapshot: CorteSnapshot | null;
  loading: boolean;
  error: string | null;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export function useVendedorResumen(vendedorId: string): UseVendedorResumenReturn {
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [snapshot, setSnapshot] = useState<CorteSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [v, inicio] = await Promise.all([
        db.vendedor.get(vendedorId),
        ultimoPeriodoFin(vendedorId),
      ]);
      setVendedor(v ?? null);
      const insumos = await cargarInsumosCorte(vendedorId, inicio, hoyISO());
      setSnapshot(calcularCorte(insumos));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  return { vendedor, snapshot, loading, error };
}
