/**
 * Logiclean Ruta — useVendedorResumen hook (H-15, resumen de vendedor)
 *
 * Carga de solo lectura del snapshot del periodo en curso de un vendedor
 * específico, para el resumen que se abre al tocarlo en "Caja por vendedor"
 * (Inicio). Reusa el mismo trío `ultimoInstanteCorte` → `cargarInsumosCorte` →
 * `calcularCorte` que `useDashboard` — ningún cálculo nuevo.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { calcularCorte } from '../lib/corte';
import { cargarInsumosCorte, ultimoInstanteCorte } from '../lib/corteData';
import { cargarAperturaVigente } from '../lib/corteReparto';
import type { CorteSnapshot } from '../lib/corte';
import type { Vendedor } from '../db/schema';

export interface UseVendedorResumenReturn {
  vendedor: Vendedor | null;
  snapshot: CorteSnapshot | null;
  /** Saldo vigente con el negocio (Inc 7.5): negativo = debe, positivo = a favor. */
  saldoNegocio: number;
  loading: boolean;
  error: string | null;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export function useVendedorResumen(vendedorId: string): UseVendedorResumenReturn {
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [snapshot, setSnapshot] = useState<CorteSnapshot | null>(null);
  const [saldoNegocio, setSaldoNegocio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [v, inicio, apertura] = await Promise.all([
        db.vendedor.get(vendedorId),
        ultimoInstanteCorte(),
        cargarAperturaVigente(),
      ]);
      setVendedor(v ?? null);
      setSaldoNegocio(apertura.porVendedor.get(vendedorId) ?? 0);
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

  return { vendedor, snapshot, saldoNegocio, loading, error };
}
