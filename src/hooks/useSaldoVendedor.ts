/**
 * Logiclean Ruta — useSaldoVendedor (Inc 7.5)
 *
 * Saldo vigente de UN vendedor con el negocio (saldo_vendedor_cierre del
 * último corte confirmado, neto de abonos ya registrados — ver
 * `cargarAperturaVigente`). Negativo = el vendedor debe al negocio; positivo
 * = el negocio le debe a él (a favor); 0 = al corriente.
 *
 * El propio vendedor registra el abono cuando lo salda: `registrarAbono`
 * deriva la dirección del signo del saldo, así el llamador solo da el monto
 * y la forma de pago.
 */

import { useCallback, useEffect, useState } from 'react';
import { cargarAperturaVigente } from '../lib/corteReparto';
import { registrarAbonoSaldoVendedor, type FormaPagoAbono } from '../lib/abonoVendedor';

export interface UseSaldoVendedorReturn {
  corteId: string | null;
  /** Negativo = debe al negocio; positivo = a favor del vendedor; 0 = al corriente. */
  saldo: number;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  registrarAbono: (monto: number, formaPago: FormaPagoAbono) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSaldoVendedor(vendedorId: string | null): UseSaldoVendedorReturn {
  const [corteId, setCorteId] = useState<string | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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

  const registrarAbono = useCallback(
    async (monto: number, formaPago: FormaPagoAbono) => {
      if (!vendedorId) throw new Error('Falta el vendedor.');
      if (!corteId) throw new Error('No hay ningún corte confirmado contra el cual abonar.');
      if (saldo === 0) throw new Error('No hay saldo pendiente.');

      setSubmitting(true);
      try {
        await registrarAbonoSaldoVendedor({
          corteId,
          vendedorId,
          direccion: saldo < 0 ? 'vendedor_a_negocio' : 'negocio_a_vendedor',
          monto,
          forma_pago: formaPago,
        });
        await load();
      } finally {
        setSubmitting(false);
      }
    },
    [vendedorId, corteId, saldo, load]
  );

  return { corteId, saldo, loading, error, submitting, registrarAbono, refresh: load };
}
