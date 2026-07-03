/**
 * Logiclean Ruta — useCorte hook (H-10, Inc 3)
 *
 * Orquesta la previsualización y el registro del corte semanal del gerente.
 * NO contiene lógica de dinero: acota los datos de Dexie (vía `corteData`) y
 * delega el cálculo a `calcularCorte` / `generarCorte` (lib pura y testeada).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { calcularCorte, generarCorte } from '../lib/corte';
import { cargarInsumosCorte, ultimoPeriodoFin } from '../lib/corteData';
import type { CorteSnapshot } from '../lib/corte';
import type { Vendedor } from '../db/schema';

export interface EntregaInput {
  efectivo?: number;
  transferencias?: number;
}

export interface UseCorteReturn {
  vendedores: Vendedor[];
  vendedorId: string;
  setVendedorId: (id: string) => void;
  /** Inicio del periodo (derivado del último corte; '' = sin corte previo). */
  periodoInicio: string;
  periodoFin: string;
  setPeriodoFin: (d: string) => void;
  snapshot: CorteSnapshot | null;
  loading: boolean;
  error: string | null;
  registrar: (entrega?: EntregaInput) => Promise<void>;
  refresh: () => Promise<void>;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export function useCorte(): UseCorteReturn {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState(hoyISO());
  const [snapshot, setSnapshot] = useState<CorteSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.vendedor.toArray().then(setVendedores);
  }, []);

  const cargar = useCallback(async () => {
    if (!vendedorId) {
      setSnapshot(null);
      setPeriodoInicio('');
      return;
    }
    setLoading(true);
    try {
      const inicio = await ultimoPeriodoFin(vendedorId);
      setPeriodoInicio(inicio);
      const insumos = await cargarInsumosCorte(vendedorId, inicio, periodoFin);
      setSnapshot(calcularCorte(insumos));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId, periodoFin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const registrar = useCallback(
    async (entrega?: EntregaInput) => {
      if (!vendedorId) throw new Error('Selecciona un vendedor.');
      const inicioConcreto = periodoInicio || periodoFin;
      const insumos = await cargarInsumosCorte(vendedorId, periodoInicio, periodoFin);
      await generarCorte({
        vendedorId,
        periodoInicio: inicioConcreto,
        periodoFin,
        efectivoEntregado: entrega?.efectivo,
        transferenciasEntregadas: entrega?.transferencias,
        ...insumos,
      });
      await cargar();
    },
    [vendedorId, periodoInicio, periodoFin, cargar]
  );

  return {
    vendedores,
    vendedorId,
    setVendedorId,
    periodoInicio,
    periodoFin,
    setPeriodoFin,
    snapshot,
    loading,
    error,
    registrar,
    refresh: cargar,
  };
}
