/**
 * Logiclean Ruta — useDashboard hook (H-15, Inc 4)
 *
 * Calcula el dashboard del periodo en curso: por cada vendedor deriva su
 * periodo (desde su último corte) y reusa `calcularCorte`; agrega la caja y
 * las ventas, y añade los indicadores de cartera (continuos). Todo desde Dexie
 * (offline-first); "casi en tiempo real" lo da el ciclo de sync al refrescar.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { calcularCorte } from '../lib/corte';
import { cargarInsumosCorte, ultimoPeriodoFin } from '../lib/corteData';
import { construirDashboard, resumenLaModerna, resumenEnvasado } from '../lib/dashboard';
import { embudoPorEtapa, adherencia, clasificarVencimiento } from '../lib/prospectos';
import type { DashboardModel, SnapshotVendedor } from '../lib/dashboard';

export interface UseDashboardReturn {
  dashboard: DashboardModel | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardReturn {
  const [dashboard, setDashboard] = useState<DashboardModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const [vendedores, clientes, visitas, movimientosLaModerna, productosBase, envasados, envasadoLineas, presentaciones] = await Promise.all([
        db.vendedor.toArray(),
        db.cliente.where('activo').equals(1).toArray(),
        db.visita.toArray(),
        db.movimiento_la_moderna.toArray(),
        db.producto_base.toArray(),
        db.envasado.toArray(),
        db.envasado_linea.toArray(),
        db.presentacion.toArray(),
      ]);

      // Snapshot de corte del periodo en curso, por vendedor.
      const porVendedor: SnapshotVendedor[] = [];
      const iniciosPorVendedor: string[] = [];
      for (const v of vendedores) {
        const inicio = await ultimoPeriodoFin(v.id);
        iniciosPorVendedor.push(inicio);
        const insumos = await cargarInsumosCorte(v.id, inicio, hoy);
        porVendedor.push({ vendedorId: v.id, nombre: v.nombre, snapshot: calcularCorte(insumos) });
      }

      // La Moderna es bodega (sin vendedor_id): se acota al superset de las
      // ventanas "desde el último corte" de todos los vendedores — el
      // inicio más antiguo (o '' si alguno nunca ha cortado), misma
      // semántica que el fallback de `enRango` en corteData.ts.
      const inicioGlobal = iniciosPorVendedor.length ? iniciosPorVendedor.slice().sort()[0] : '';
      const nombreProductoBase = (id: string) => productosBase.find((p) => p.id === id)?.nombre ?? id;
      const nombrePresentacion = (id: string) => presentaciones.find((p) => p.id === id)?.nombre ?? id;
      const movimientosPeriodo = movimientosLaModerna.filter((m) => {
        const f = (m.fecha ?? '').slice(0, 10);
        return (!inicioGlobal || f > inicioGlobal) && f <= hoy;
      });
      // Envasado tampoco tiene vendedor_id (evento de bodega): mismo criterio
      // de ventana que movimientosLaModerna.
      const envasadosPeriodo = envasados.filter((e) => {
        const f = (e.fecha ?? '').slice(0, 10);
        return (!inicioGlobal || f > inicioGlobal) && f <= hoy;
      });

      const vencidos = clientes.filter(
        (c) => c.estado === 'prospecto' && clasificarVencimiento(c) === 'vencido'
      ).length;

      setDashboard(
        construirDashboard({
          porVendedor,
          embudo: embudoPorEtapa(clientes),
          adherencia: adherencia(visitas),
          vencidos,
          laModerna: resumenLaModerna(movimientosPeriodo, nombreProductoBase),
          envasados: resumenEnvasado(envasadosPeriodo, envasadoLineas, nombreProductoBase, nombrePresentacion),
        })
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
    cargar();
  }, [cargar]);

  return { dashboard, loading, error, refresh: cargar };
}
