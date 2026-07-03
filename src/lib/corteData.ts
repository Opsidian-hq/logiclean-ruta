/**
 * Logiclean Ruta — Carga de insumos del corte (Inc 4, actualizado Inc 6.5)
 *
 * Acota desde Dexie los datos de un vendedor para un periodo [inicio, fin] y
 * los devuelve en la forma que consume `calcularCorte`. Lo comparten la
 * pantalla de corte (`useCorte`) y el dashboard (`useDashboard`) para que el
 * criterio de "qué entra en el periodo" sea uno solo y no se desincronice.
 *
 *  - inicio vacío ('') = periodo abierto hacia atrás (sin corte previo).
 *  - cobros: por su propia fecha, ligados a las ventas del vendedor.
 *  - gastos: de ruta del vendedor + de backoffice (negocio).
 *  - suministros / envasados: nivel negocio (solo por fecha) — igual que
 *    antes de 6.5, la reconciliación con La Moderna y la identidad de
 *    control son de la empresa, no por vendedor.
 *  - bodega (base + presentaciones): estado ACTUAL de la empresa, no se
 *    acota al periodo — el corte muestra "qué hay ahora", no un delta.
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

  const [
    ventasVend, todosCobros, gastos, suministros, envasados,
    bodegaBase, bodegaPresentaciones, presentaciones, productos,
  ] = await Promise.all([
    db.venta.where('vendedor_id').equals(vendedorId).toArray(),
    db.cobro.toArray(),
    db.gasto.toArray(),
    db.suministro_la_moderna.toArray(),
    db.envasado.toArray(),
    db.inventario_bodega_base.toArray(),
    db.inventario_bodega_presentacion.toArray(),
    db.presentacion.toArray(),
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
    suministros: suministros.filter((s) => enRango(s.fecha)),
    envasados: envasados.filter((e) => enRango(e.fecha)),
    bodegaBase,
    bodegaPresentaciones,
    presentaciones,
    productos,
  };
}
