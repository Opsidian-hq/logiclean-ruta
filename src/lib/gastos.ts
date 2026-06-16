/**
 * Logiclean Ruta — Registro de gastos (H-12)
 *
 * Alcance Inc 1: gastos **de ruta** del vendedor. Los de backoffice y su efecto
 * en el corte (descuento de la bolsa correspondiente) son Inc 3; aquí solo se
 * registran correctamente para que el corte luego cuadre.
 *
 * Escritura local instantánea + cola de sync idempotente (offline-first).
 */

import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { Gasto } from '../db/schema';

/** Categorías sugeridas para gastos de ruta (más "Otro" libre en la UI). */
export const CATEGORIAS_RUTA = [
  'Gasolina',
  'Viáticos',
  'Casetas',
  'Alimentos',
] as const;

/** Categorías sugeridas para gastos de backoffice (más "Otro" libre en la UI). */
export const CATEGORIAS_BACKOFFICE = [
  'Insumos',
  'Etiquetas',
  'Envases',
  'Renta',
  'Servicios',
] as const;

export interface RegistrarGastoInput {
  /** Obligatorio para gastos de ruta; ignorado (null) en backoffice. */
  vendedorId?: string | null;
  categoria: string;
  monto: number;
  forma_pago: 'efectivo' | 'transferencia';
  /** ISO date (YYYY-MM-DD); por defecto hoy. */
  fecha?: string;
  descripcion?: string;
  /** Tipo de gasto. 'ruta' (vendedor) o 'backoffice' (negocio). */
  tipo?: 'ruta' | 'backoffice';
}

export async function registrarGasto(input: RegistrarGastoInput): Promise<Gasto> {
  const {
    vendedorId,
    categoria,
    monto,
    forma_pago,
    fecha = new Date().toISOString().slice(0, 10),
    descripcion,
    tipo = 'ruta',
  } = input;

  if (!categoria.trim()) throw new Error('La categoría es obligatoria.');
  if (!(monto > 0)) throw new Error('El monto debe ser mayor que 0.');
  if (tipo === 'ruta' && !vendedorId) {
    throw new Error('Un gasto de ruta requiere un vendedor.');
  }

  const gasto: Gasto = {
    id: generateUUID(),
    // Backoffice = salida del negocio, sin vendedor (modelo-datos §gastos).
    vendedor_id: tipo === 'backoffice' ? null : vendedorId,
    tipo,
    categoria: categoria.trim(),
    fecha,
    monto,
    forma_pago,
    descripcion: descripcion?.trim() || undefined,
  };

  await db.gasto.put(gasto);
  const item = await enqueueOperation(
    'gasto',
    'upsert',
    gasto as unknown as Record<string, unknown>
  );
  await syncEngine.enqueueAndSync(item);

  return gasto;
}

/** Totales de gastos por bolsa (efectivo / transferencia). */
export function totalesPorBolsa(gastos: Gasto[]): {
  efectivo: number;
  transferencia: number;
} {
  return gastos.reduce(
    (acc, g) => {
      if (g.forma_pago === 'efectivo') acc.efectivo += g.monto;
      else acc.transferencia += g.monto;
      return acc;
    },
    { efectivo: 0, transferencia: 0 }
  );
}
