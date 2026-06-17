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
import { construirDashboard } from '../lib/dashboard';
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
      const [vendedores, clientes, visitas] = await Promise.all([
        db.vendedor.toArray(),
        db.cliente.where('activo').equals(1).toArray(),
        db.visita.toArray(),
      ]);

      // Snapshot de corte del periodo en curso, por vendedor.
      const porVendedor: SnapshotVendedor[] = [];
      for (const v of vendedores) {
        const inicio = await ultimoPeriodoFin(v.id);
        const insumos = await cargarInsumosCorte(v.id, inicio, hoy);
        porVendedor.push({ vendedorId: v.id, nombre: v.nombre, snapshot: calcularCorte(insumos) });
      }

      const vencidos = clientes.filter(
        (c) => c.estado === 'prospecto' && clasificarVencimiento(c) === 'vencido'
      ).length;

      setDashboard(
        construirDashboard({
          porVendedor,
          embudo: embudoPorEtapa(clientes),
          adherencia: adherencia(visitas),
          vencidos,
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
