/**
 * Logiclean Ruta — useSaldosVendedores (Inc 7.5, gerente)
 *
 * Saldo neto vigente de TODOS los vendedores con el negocio
 * (`cargarSaldoNetoVendedor` por vendedor), para el Dashboard y el resumen
 * por vendedor. Solo lectura — el gerente no registra abonos (decisión ya
 * tomada).
 */

import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/index';
import { cargarSaldoNetoVendedor } from '../lib/corteReparto';

export interface SaldoVendedor {
  vendedorId: string;
  nombre: string;
  /** Negativo = debe al negocio; positivo = a favor del vendedor; 0 = al corriente. */
  saldo: number;
}

export interface UseSaldosVendedoresReturn {
  saldos: SaldoVendedor[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSaldosVendedores(): UseSaldosVendedoresReturn {
  const [saldos, setSaldos] = useState<SaldoVendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const vendedores = await db.vendedor.toArray();
      const netos = await Promise.all(vendedores.map((v) => cargarSaldoNetoVendedor(v.id)));
      setSaldos(
        vendedores.map((v, i) => ({
          vendedorId: v.id,
          nombre: v.nombre,
          saldo: netos[i].saldo,
        }))
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { saldos, loading, error, refresh: load };
}
