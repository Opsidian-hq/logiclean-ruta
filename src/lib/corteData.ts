/**
 * Logiclean Ruta — Carga de insumos del corte (Inc 4)
 *
 * Acota desde Dexie los datos de un vendedor para un periodo [inicio, fin] y
 * los devuelve en la forma que consume `calcularCorte`. Lo comparten la
 * pantalla de corte (`useCorte`) y el dashboard (`useDashboard`) para que el
 * criterio de "qué entra en el periodo" sea uno solo y no se desincronice.
 *
 *  - inicio vacío ('') = periodo abierto hacia atrás (sin corte previo).
 *  - cobros: por su propia fecha, ligados a las ventas del vendedor.
 *  - gastos: de ruta del vendedor + de backoffice (negocio).
 *  - suministros: nivel negocio (solo por fecha).
 */

import { db } from '../db/index';
import type { CalcularCorteInput } from './corte';

const soloFecha = (iso?: string | null) => (iso ?? '').slice(0, 10);

/** Fecha de fin del último corte del vendedor ('' si no tiene cortes). */
export async function ultimoPeriodoFin(vendedorId: string): Promise<string> {
  const previos = await db.corte.where('vendedor_id').equals(vendedorId).toArray();
  return previos.map((c) => c.periodo_fin).sort().at(-1) ?? '';
}

/** Carga y acota los insumos del corte de un vendedor para [inicio, fin]. */
export async function cargarInsumosCorte(
  vendedorId: string,
  periodoInicio: string,
  periodoFin: string
): Promise<CalcularCorteInput> {
  const enRango = (iso?: string | null) => {
    const d = soloFecha(iso);
    return (!periodoInicio || d > periodoInicio) && d <= periodoFin;
  };

  const [ventasVend, todosCobros, gastos, inventario, presentaciones, suministros, productos] =
    await Promise.all([
      db.venta.where('vendedor_id').equals(vendedorId).toArray(),
      db.cobro.toArray(),
      db.gasto.toArray(),
      db.inventario_vehiculo.where('vendedor_id').equals(vendedorId).toArray(),
      db.presentacion.toArray(),
      db.suministro_la_moderna.toArray(),
      db.producto_base.toArray(),
    ]);

  const idsVentasVend = new Set(ventasVend.map((v) => v.id));

  return {
    ventas: ventasVend.filter((v) => enRango(v.fecha)),
    cobros: todosCobros.filter((c) => idsVentasVend.has(c.venta_id) && enRango(c.fecha)),
    gastos: gastos.filter(
      (g) =>
        enRango(g.fecha) &&
        ((g.tipo === 'ruta' && g.vendedor_id === vendedorId) || g.tipo === 'backoffice')
    ),
    inventario,
    presentaciones,
    suministros: suministros.filter((s) => enRango(s.fecha)),
    productos,
  };
}
