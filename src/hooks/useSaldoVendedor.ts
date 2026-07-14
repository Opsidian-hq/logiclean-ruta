/**
 * Logiclean Ruta — useSaldoVendedor (Inc 7.5)
 *
 * Saldo vigente de UN vendedor con el negocio (saldo_vendedor_cierre del
 * último corte confirmado, neto de abonos ya registrados — ver
 * `cargarAperturaVigente`). Negativo = el vendedor debe al negocio; positivo
 * = el negocio le debe a él (a favor); 0 = al corriente.
 *
 * Solo lectura — el registro de abonos vive en el formulario libre de
 * `SaldoNegocioPage` (el vendedor decide cuándo y cuánto retira/devuelve),
 * que llama a `registrarAbonoSaldoVendedor` directamente.
 */

import { useCallback, useEffect, useState } from 'react';
import { cargarAperturaVigente } from '../lib/corteReparto';

export interface UseSaldoVendedorReturn {
  corteId: string | null;
  /** Negativo = debe al negocio; positivo = a favor del vendedor; 0 = al corriente. */
  saldo: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSaldoVendedor(vendedorId: string | null): UseSaldoVendedorReturn {
  const [corteId, setCorteId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendedorId) {
      setCorteId(null);
      setSaldo(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const apertura = await cargarAperturaVigente();
      setCorteId(apertura.corte?.id ?? null);
      setSaldo(apertura.porVendedor.get(vendedorId) ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { corteId, saldo, loading, error, refresh: load };
}
