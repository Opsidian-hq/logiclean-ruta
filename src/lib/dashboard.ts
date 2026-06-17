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
    vencidos: input.vencidos,
    alertas,
  };
}
