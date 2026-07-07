/**
 * Logiclean Ruta — Dashboard consolidado del gerente (H-15, Inc 4)
 *
 * Modelo derivado del periodo en curso. Agrega los snapshots de corte de cada
 * vendedor (flujo: ventas y caja por bolsa, netos de gastos) con los
 * indicadores de cartera (embudo, adherencia, cartera activa — continuos).
 * Función pura: la composición/IO vive en `useDashboard`.
 */

import type { CorteSnapshot } from './corte';
import type { Embudo, Adherencia } from './prospectos';
import type {
  MovimientoLaModerna,
  Envasado,
  EnvasadoLinea,
  CargaVehiculo,
  CargaLinea,
  DevolucionBodega,
  DevolucionLinea,
} from '../db/schema';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface CajaVendedor {
  vendedorId: string;
  nombre: string;
  ventas: number;
  /** Efectivo neto de gastos de ruta. */
  efectivo: number;
  /** Transferencias netas de gastos de ruta. */
  transferencia: number;
  /** Alguna bolsa quedó negativa. */
  descuadre: boolean;
}

export interface MovimientoLaModernaVista {
  id: string;
  productoNombre: string;
  tipo: 'recibido' | 'devuelto';
  cantidad: number;
  fecha: string;
}

export interface ResumenLaModerna {
  totalRecibido: number;
  totalDevuelto: number;
  movimientos: MovimientoLaModernaVista[];
}

export interface EnvasadoVista {
  id: string;
  productoNombre: string;
  litrosEnvasados: number;
  fecha: string;
  /** "5 × Limpia Vidrios Logiclean 3.75 L" */
  resumenLineas: string;
}

export interface ResumenEnvasado {
  totalLitros: number;
  envasados: EnvasadoVista[];
}

export interface CargaDevolucionVista {
  id: string;
  vendedorNombre: string;
  tipo: 'carga' | 'devolucion';
  fecha: string;
  /** "5 × Bidón 20L · 2 × Garrafa 5L" */
  resumenLineas: string;
}

export interface ResumenCargaDevolucion {
  totalCargas: number;
  totalDevoluciones: number;
  movimientos: CargaDevolucionVista[];
}

export interface DashboardModel {
  // ── Flujo (se reinicia al generar corte) ──
  ventasTotal: number;
  cajaEfectivo: number;
  cajaTransferencia: number;
  porVendedor: CajaVendedor[];
  // ── Cartera (continua) ──
  embudo: Embudo;
  adherencia: Adherencia;
  carteraActiva: number;
  // ── La Moderna (flujo, mismo periodo que ventas) ──
  laModerna: ResumenLaModerna;
  // ── Envasado (flujo, mismo periodo que ventas) ──
  envasados: ResumenEnvasado;
  // ── Carga y devolución de vehículo (flujo, periodo propio de cada vendedor) ──
  cargaDevolucion: ResumenCargaDevolucion;
  // ── Alertas ──
  vencidos: number;
  alertas: string[];
}

export interface SnapshotVendedor {
  vendedorId: string;
  nombre: string;
  snapshot: CorteSnapshot;
}

export interface ConstruirDashboardInput {
  /** Snapshot de corte del periodo en curso, por vendedor. */
  porVendedor: SnapshotVendedor[];
  embudo: Embudo;
  adherencia: Adherencia;
  /** Prospectos con visita vencida (continuo). */
  vencidos: number;
  /** Movimientos de La Moderna ya acotados al periodo (desde useDashboard). */
  laModerna: ResumenLaModerna;
  /** Envasados ya acotados al periodo (desde useDashboard). */
  envasados: ResumenEnvasado;
  /** Cargas/devoluciones ya acotadas al periodo propio de cada vendedor (desde useDashboard). */
  cargaDevolucion: ResumenCargaDevolucion;
}

/** Resumen combinado (recibido + devuelto) de movimientos ya filtrados por periodo. */
export function resumenLaModerna(
  movimientos: MovimientoLaModerna[],
  nombreProducto: (id: string) => string
): ResumenLaModerna {
  const vista: MovimientoLaModernaVista[] = movimientos
    .map((m) => ({
      id: m.id,
      productoNombre: nombreProducto(m.producto_base_id),
      tipo: m.tipo,
      cantidad: m.cantidad,
      fecha: m.fecha,
    }))
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

  const totalRecibido = round2(
    movimientos.filter((m) => m.tipo === 'recibido').reduce((s, m) => s + m.cantidad, 0)
  );
  const totalDevuelto = round2(
    movimientos.filter((m) => m.tipo === 'devuelto').reduce((s, m) => s + m.cantidad, 0)
  );

  return { totalRecibido, totalDevuelto, movimientos: vista };
}

/** Resumen de envasados ya filtrados por periodo. */
export function resumenEnvasado(
  envasados: Envasado[],
  lineas: EnvasadoLinea[],
  nombreProducto: (id: string) => string,
  nombrePresentacion: (id: string) => string
): ResumenEnvasado {
  const lineasPorEnvasado = new Map<string, EnvasadoLinea[]>();
  for (const l of lineas) {
    const arr = lineasPorEnvasado.get(l.envasado_id) ?? [];
    arr.push(l);
    lineasPorEnvasado.set(l.envasado_id, arr);
  }

  const vista: EnvasadoVista[] = envasados
    .map((e) => ({
      id: e.id,
      productoNombre: nombreProducto(e.producto_base_id),
      litrosEnvasados: e.litros_envasados,
      fecha: e.fecha,
      resumenLineas: (lineasPorEnvasado.get(e.id) ?? [])
        .map((l) => `${l.cantidad} × ${nombrePresentacion(l.presentacion_id)}`)
        .join(' · '),
    }))
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

  const totalLitros = round2(envasados.reduce((s, e) => s + e.litros_envasados, 0));

  return { totalLitros, envasados: vista };
}

/** Resumen combinado (cargas + devoluciones) ya filtradas por el periodo propio de cada vendedor. */
export function resumenCargaDevolucion(
  cargas: CargaVehiculo[],
  devoluciones: DevolucionBodega[],
  cargaLineas: CargaLinea[],
  devolucionLineas: DevolucionLinea[],
  nombreVendedor: (id: string) => string,
  nombrePresentacion: (id: string) => string
): ResumenCargaDevolucion {
  const resumenDe = (lineas: { presentacion_id: string; cantidad: number }[]) =>
    lineas.map((l) => `${l.cantidad} × ${nombrePresentacion(l.presentacion_id)}`).join(' · ');

  const vistaCargas: CargaDevolucionVista[] = cargas.map((c) => ({
    id: c.id,
    vendedorNombre: nombreVendedor(c.vendedor_id),
    tipo: 'carga' as const,
    fecha: c.fecha,
    resumenLineas: resumenDe(cargaLineas.filter((l) => l.carga_id === c.id)),
  }));

  const vistaDevoluciones: CargaDevolucionVista[] = devoluciones.map((d) => ({
    id: d.id,
    vendedorNombre: nombreVendedor(d.vendedor_id),
    tipo: 'devolucion' as const,
    fecha: d.fecha,
    resumenLineas: resumenDe(devolucionLineas.filter((l) => l.devolucion_id === d.id)),
  }));

  const movimientos = [...vistaCargas, ...vistaDevoluciones].sort(
    (a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')
  );

  return { totalCargas: cargas.length, totalDevoluciones: devoluciones.length, movimientos };
}

export function construirDashboard(input: ConstruirDashboardInput): DashboardModel {
  const porVendedor: CajaVendedor[] = input.porVendedor.map((v) => {
    const ef = v.snapshot.bolsas.efectivo.neto;
    const tr = v.snapshot.bolsas.transferencia.neto;
    return {
      vendedorId: v.vendedorId,
      nombre: v.nombre,
      ventas: v.snapshot.ventasTotal,
      efectivo: ef,
      transferencia: tr,
      descuadre: ef < 0 || tr < 0,
    };
  });

  const ventasTotal = round2(porVendedor.reduce((s, v) => s + v.ventas, 0));
  const cajaEfectivo = round2(porVendedor.reduce((s, v) => s + v.efectivo, 0));
  const cajaTransferencia = round2(porVendedor.reduce((s, v) => s + v.transferencia, 0));

  const alertas: string[] = [];
  if (input.vencidos > 0) {
    alertas.push(`${input.vencidos} prospecto${input.vencidos !== 1 ? 's' : ''} con visita vencida.`);
  }
  for (const v of porVendedor) {
    if (v.descuadre) alertas.push(`Descuadre en la caja de ${v.nombre}.`);
  }

  return {
    ventasTotal,
    cajaEfectivo,
    cajaTransferencia,
    porVendedor,
    embudo: input.embudo,
    adherencia: input.adherencia,
    carteraActiva: input.embudo.convertidos,
    laModerna: input.laModerna,
    envasados: input.envasados,
    cargaDevolucion: input.cargaDevolucion,
    vencidos: input.vencidos,
    alertas,
  };
}
