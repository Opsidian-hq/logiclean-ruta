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
import { cargarInsumosCorte, ultimoInstanteCorte } from '../lib/corteData';
import { construirDashboard, resumenLaModerna, resumenEnvasado, resumenCargaDevolucion, resumenGastosBackoffice } from '../lib/dashboard';
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
      const [
        vendedores, clientes, visitas, movimientosLaModerna, productosBase,
        envasados, envasadoLineas, presentaciones, cargas, cargaLineas,
        devoluciones, devolucionLineas, gastosBackoffice,
      ] = await Promise.all([
        db.vendedor.toArray(),
        db.cliente.where('activo').equals(1).toArray(),
        db.visita.toArray(),
        db.movimiento_la_moderna.toArray(),
        db.producto_base.toArray(),
        db.envasado.toArray(),
        db.envasado_linea.toArray(),
        db.presentacion.toArray(),
        db.carga_vehiculo.toArray(),
        db.carga_linea.toArray(),
        db.devolucion_bodega.toArray(),
        db.devolucion_linea.toArray(),
        db.gasto.where('tipo').equals('backoffice').toArray(),
      ]);

      // Desde Inc 7.2 (H-20) el corte es de negocio: un solo periodo vigente
      // para todos los vendedores activos (ya no por-vendedor).
      //
      // El corte de negocio se acota por el INSTANTE exacto de confirmación
      // (`fecha_generado`), no por la fecha calendario (`periodo_fin`): comparar
      // solo por día con `>` estricto dejaba fuera para siempre cualquier venta
      // (u otro insumo) registrado el mismo día en que se confirmó el corte,
      // aunque fuera después de esa confirmación.
      const inicioInstante = await ultimoInstanteCorte();
      const inicioInstantePorVendedor = new Map<string, string>(vendedores.map((v) => [v.id, inicioInstante]));

      const porVendedor: SnapshotVendedor[] = [];
      for (const v of vendedores) {
        const insumos = await cargarInsumosCorte(v.id, inicioInstante, hoy);
        porVendedor.push({ vendedorId: v.id, nombre: v.nombre, snapshot: calcularCorte(insumos) });
      }

      const nombreProductoBase = (id: string) => productosBase.find((p) => p.id === id)?.nombre ?? id;
      const nombrePresentacion = (id: string) => presentaciones.find((p) => p.id === id)?.nombre ?? id;
      const nombreVendedor = (id: string) => vendedores.find((v) => v.id === id)?.nombre ?? id;
      const enPeriodo = (fecha: string | null | undefined, inicio: string) => {
        const t = fecha ? new Date(fecha).getTime() : NaN;
        return (!inicio || t > new Date(inicio).getTime()) && (fecha ?? '').slice(0, 10) <= hoy;
      };
      const movimientosPeriodo = movimientosLaModerna.filter((m) => enPeriodo(m.fecha, inicioInstante));
      // Envasado tampoco tiene vendedor_id (evento de bodega): mismo criterio
      // de ventana que movimientosLaModerna.
      const envasadosPeriodo = envasados.filter((e) => enPeriodo(e.fecha, inicioInstante));
      // Los gastos de backoffice tampoco tienen vendedor_id (salida del
      // negocio): mismo criterio de ventana que movimientosLaModerna.
      const gastosBackofficePeriodo = gastosBackoffice.filter((g) => enPeriodo(g.fecha, inicioInstante));

      // Cargas/devoluciones sí tienen vendedor_id: cada una se acota a la
      // ventana propia de SU vendedor (mismo criterio que ventas/gastos en
      // `cargarInsumosCorte`), no al superset global.
      const cargasPeriodo = cargas.filter((c) => enPeriodo(c.fecha, inicioInstantePorVendedor.get(c.vendedor_id) ?? ''));
      const devolucionesPeriodo = devoluciones.filter((d) => enPeriodo(d.fecha, inicioInstantePorVendedor.get(d.vendedor_id) ?? ''));

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
          cargaDevolucion: resumenCargaDevolucion(cargasPeriodo, devolucionesPeriodo, cargaLineas, devolucionLineas, nombreVendedor, nombrePresentacion),
          gastosBackoffice: resumenGastosBackoffice(gastosBackofficePeriodo),
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
