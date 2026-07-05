/**
 * Logiclean Ruta — useEnvasado hook (Inc 6.3, H-17)
 *
 * Productos base envasables (químicos en bidón) con stock disponible en
 * materia prima, sus presentaciones y el estado actual de bodega (contexto
 * para el gerente). Lee de Dexie (offline); el registro delega en
 * `lib/envasado.ts`. Los envasados recientes viven en el dashboard del
 * gerente (`useDashboard`), no en este hook.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarEnvasado } from '../lib/envasado';
import type { RegistrarEnvasadoInput } from '../lib/envasado';
import type { ProductoBase, Presentacion, InventarioBodegaBase } from '../db/schema';

/** Ruido de punto flotante de contadores DECIMAL acumulados por trigger (ver EPSILON_IDENTIDAD en lib/corte.ts). */
const EPSILON_STOCK = 0.001;

export interface UseEnvasadoReturn {
  /** Productos envasables: químicos en bidón (unidad_compra='bidon') con stock en materia prima. */
  productos: ProductoBase[];
  presentaciones: Presentacion[];
  /** Estado de bodega del producto base (disponibles/granel), si ya se hidrató. */
  bodegaDe: (productoBaseId: string) => InventarioBodegaBase | undefined;
  /** Presentaciones activas de un producto base (para las líneas del formulario). */
  presentacionesDe: (productoBaseId: string) => Presentacion[];
  loading: boolean;
  crearEnvasado: (input: Omit<RegistrarEnvasadoInput, 'responsableId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEnvasado(responsableId: string | null): UseEnvasadoReturn {
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [bodegaBase, setBodegaBase] = useState<InventarioBodegaBase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prodsAll, pres, bodega] = await Promise.all([
      db.producto_base
        .where('activo').equals(1)
        .filter((p) => p.unidad_compra === 'bidon')
        .toArray(),
      db.presentacion.where('activo').equals(1).toArray(),
      db.inventario_bodega_base.toArray(),
    ]);

    // Solo se ofrecen productos con stock real en materia prima (bidones
    // sellados + granel abierto, expresado en litros con litros_por_bidon).
    const bodegaPorProducto = new Map(bodega.map((b) => [b.producto_base_id, b]));
    const prods = prodsAll.filter((p) => {
      const b = bodegaPorProducto.get(p.id);
      if (!b) return false;
      const litrosDisponibles = b.bidones_disponibles * (p.litros_por_bidon ?? 0) + b.litros_granel_estimado;
      return litrosDisponibles > EPSILON_STOCK;
    });
    setProductos(prods);
    setPresentaciones(pres);
    setBodegaBase(bodega);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const bodegaDe = useCallback(
    (productoBaseId: string) => bodegaBase.find((b) => b.producto_base_id === productoBaseId),
    [bodegaBase]
  );

  const presentacionesDe = useCallback(
    (productoBaseId: string) => presentaciones.filter((p) => p.producto_base_id === productoBaseId),
    [presentaciones]
  );

  const crearEnvasado = useCallback(
    async (input: Omit<RegistrarEnvasadoInput, 'responsableId'>) => {
      if (!responsableId) throw new Error('Falta el gerente responsable.');
      await registrarEnvasado({ ...input, responsableId });
      await load();
    },
    [load, responsableId]
  );

  return {
    productos,
    presentaciones,
    bodegaDe,
    presentacionesDe,
    loading,
    crearEnvasado,
    refresh: load,
  };
}
