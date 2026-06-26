/**
 * Logiclean Ruta — useClienteDetalle
 *
 * Consolida todos los récords de un cliente: datos base, visitas, ventas con
 * líneas, pedidos pendientes y desglose de saldo. Todo desde Dexie (offline).
 */

import { useCallback, useEffect, useState } from 'react';
import { db } from '../db/index';
import { visitasDeCliente } from '../lib/visitas';
import { pedidosPendientesVista } from '../lib/pedidos';
import { desgloseCliente } from '../lib/cobros';
import type { Cliente, Visita, Venta, LineaVenta } from '../db/schema';
import type { PedidoPendienteVista } from '../lib/pedidos';
import type { DesgloseCliente } from '../lib/cobros';

export interface LineaVentaDetalle extends LineaVenta {
  nombrePresentacion: string;
}

export interface VentaConLineas {
  venta: Venta;
  lineas: LineaVentaDetalle[];
}

export interface ClienteDetalleData {
  cliente: Cliente | null;
  vendedorNombre: string | null;
  visitas: Visita[];
  ventas: VentaConLineas[];
  pedidosPendientes: PedidoPendienteVista[];
  desglose: DesgloseCliente | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useClienteDetalle(clienteId: string): ClienteDetalleData {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vendedorNombre, setVendedorNombre] = useState<string | null>(null);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [ventas, setVentas] = useState<VentaConLineas[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendienteVista[]>([]);
  const [desglose, setDesglose] = useState<DesgloseCliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, vis, peds, des] = await Promise.all([
        db.cliente.get(clienteId),
        visitasDeCliente(clienteId),
        pedidosPendientesVista(clienteId),
        desgloseCliente(clienteId),
      ]);

      setCliente(c ?? null);
      setVisitas(vis);
      setPedidosPendientes(peds);
      setDesglose(des);

      if (c) {
        const v = await db.vendedor.get(c.vendedor_id);
        setVendedorNombre(v?.nombre ?? null);
      }

      const rawVentas = await db.venta.where('cliente_id').equals(clienteId).toArray();
      rawVentas.sort((a, b) => b.fecha.localeCompare(a.fecha));

      const ventasDetalle: VentaConLineas[] = await Promise.all(
        rawVentas.map(async (venta) => {
          const lineas = await db.linea_venta.where('venta_id').equals(venta.id).toArray();
          const lineasDetalle = await Promise.all(
            lineas.map(async (linea) => {
              const pres = await db.presentacion.get(linea.presentacion_id);
              return { ...linea, nombrePresentacion: pres?.nombre ?? '—' };
            })
          );
          return { venta, lineas: lineasDetalle };
        })
      );

      setVentas(ventasDetalle);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { cliente, vendedorNombre, visitas, ventas, pedidosPendientes, desglose, loading, error, refresh: load };
}
