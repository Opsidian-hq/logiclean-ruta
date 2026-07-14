/**
 * Logiclean Ruta — useHonorarioRetenido (Inc 7.5)
 *
 * Honorario retenido en el último corte confirmado por cartera aún sin
 * cobrar (`cxc_nueva`, ver `src/domain/corte/motor.ts:52`). Puramente
 * informativo — no registra nada; solo sugiere un monto para prellenar el
 * formulario de abono libre (el vendedor decide cuánto y cuándo retirar).
 *
 * No toca el motor de corte ni `derivarVendedorEntrada`: los reutiliza
 * tal cual, de solo lectura, para leer cuánto se ha cobrado en vivo sobre
 * ventas anteriores al último corte.
 */

import { useCallback, useEffect, useState } from 'react';
import { cargarUltimoCorteVendedor, derivarVendedorEntrada } from '../lib/corteReparto';
import { ultimoInstanteCorte } from '../lib/corteData';
import { abonosDelCorte } from '../lib/abonoVendedor';

const hoyISO = () => new Date().toISOString().slice(0, 10);

export interface UseHonorarioRetenidoReturn {
  corteId: string | null;
  /** cxc_nueva del último corte confirmado — honorario retenido por cartera sin cobrar en ese momento. */
  retenido: number;
  /** Cuánto se ha cobrado en vivo, desde ese corte, sobre ventas anteriores a él. */
  cobradoDesdeCorte: number;
  /** Sugerencia de monto a reclamar (min(retenido, cobradoDesdeCorte) − lo ya reclamado). Solo prellenado, no es un tope. */
  sugerido: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHonorarioRetenido(vendedorId: string | null): UseHonorarioRetenidoReturn {
  const [corteId, setCorteId] = useState<string | null>(null);
  const [retenido, setRetenido] = useState(0);
  const [cobradoDesdeCorte, setCobradoDesdeCorte] = useState(0);
  const [sugerido, setSugerido] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vendedorId) {
      setCorteId(null);
      setRetenido(0);
      setCobradoDesdeCorte(0);
      setSugerido(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ultimo = await cargarUltimoCorteVendedor(vendedorId);
      if (!ultimo) {
        setCorteId(null);
        setRetenido(0);
        setCobradoDesdeCorte(0);
        setSugerido(0);
        setError(null);
        return;
      }

      const [inicioInstante, abonos] = await Promise.all([
        ultimoInstanteCorte(),
        abonosDelCorte(ultimo.corteId),
      ]);
      const entrada = await derivarVendedorEntrada(vendedorId, inicioInstante, hoyISO(), 0);
      const yaReclamado = abonos
        .filter((a) => a.vendedor_id === vendedorId && a.direccion === 'negocio_a_vendedor')
        .reduce((s, a) => s + a.monto, 0);

      setCorteId(ultimo.corteId);
      setRetenido(ultimo.cxcNueva);
      setCobradoDesdeCorte(entrada.cobro_cxc_vieja);
      setSugerido(Math.max(0, Math.min(ultimo.cxcNueva, entrada.cobro_cxc_vieja) - yaReclamado));
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

  return { corteId, retenido, cobradoDesdeCorte, sugerido, loading, error, refresh: load };
}
