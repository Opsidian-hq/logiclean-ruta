/**
 * Logiclean Ruta — Carga de insumos del corte (Inc 4, actualizado Inc 6.5)
 *
 * Acota desde Dexie los datos de un vendedor para un periodo [inicio, fin] y
 * los devuelve en la forma que consume `calcularCorte`. Lo comparten la
 * el dashboard (`useDashboard`) y el stepper de corte por reparto (Inc 7.4) para que el
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

/**
 * Fecha de fin del último corte confirmado ('' si no hay ninguno).
 *
 * Desde Inc 7.2 (H-20) el CORTE es de negocio, no por vendedor (migración
 * 011): hay un solo periodo vigente para todos los vendedores activos, así
 * que esta función ya no distingue por vendedor.
 */
export async function ultimoPeriodoFin(): Promise<string> {
  const todos = await db.corte.toArray();
  return todos
    .filter((c) => c.estado === 'confirmado')
    .map((c) => c.periodo_fin)
    .sort()
    .at(-1) ?? '';
}

/**
 * Instante exacto (`fecha_generado`) del último corte confirmado ('' si no
 * hay ninguno). A diferencia de `ultimoPeriodoFin` (solo fecha calendario),
 * este valor delimita el periodo en curso al segundo exacto en que se
 * confirmó el corte: una operación registrada el mismo día calendario,
 * después de confirmado el corte, sí entra al periodo en curso. Comparar
 * solo por fecha calendario (con `>` estricto) dejaba esas operaciones
 * fuera para siempre, porque su fecha nunca llegaba a ser "mayor" que la
 * fecha calendario del corte que ya las excluía.
 */
export async function ultimoInstanteCorte(): Promise<string> {
  const todos = await db.corte.toArray();
  return todos
    .filter((c) => c.estado === 'confirmado')
    .map((c) => c.fecha_generado)
    .sort()
    .at(-1) ?? '';
}

/** Carga y acota los insumos del corte de un vendedor para [inicioInstante, fin]. */
export async function cargarInsumosCorte(
  vendedorId: string,
  inicioInstante: string,
  periodoFin: string
): Promise<CalcularCorteInput> {
  const inicioMs = inicioInstante ? new Date(inicioInstante).getTime() : null;
  const enRango = (iso?: string | null) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return (inicioMs === null || t > inicioMs) && soloFecha(iso) <= periodoFin;
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
