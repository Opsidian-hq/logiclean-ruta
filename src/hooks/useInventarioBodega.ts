/**
 * Logiclean Ruta — useInventarioBodega hook
 *
 * Inventario de bodega (global, no por vendedor): cruza cada presentación
 * activa con su cantidad disponible en `inventario_bodega_presentacion` (0 si
 * no hay fila). De solo lectura — ese contador se materializa del lado
 * servidor por trigger (ADR-0007); el cliente nunca empuja un valor absoluto
 * de bodega, a diferencia de `inventario_vehiculo`.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import type { Presentacion, ProductoBase } from '../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

export interface InventarioBodegaRow {
  presentacion: Presentacion;
  productoNombre: string;
  cantidad: number;
}

export interface InventarioBodegaBaseRow {
  productoBase: ProductoBase;
  bidonesDisponibles: number;
  litrosGranelEstimado: number;
  /** bidonesDisponibles × litros_por_bidon + litrosGranelEstimado. */
  litrosDisponibles: number;
}

export interface UseInventarioBodegaReturn {
  rows: InventarioBodegaRow[];
  /** Materia prima (bidones sellados / granel abierto) aún sin envasar. */
  bodegaBaseRows: InventarioBodegaBaseRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useInventarioBodega(): UseInventarioBodegaReturn {
  const [rows, setRows] = useState<InventarioBodegaRow[]>([]);
  const [bodegaBaseRows, setBodegaBaseRows] = useState<InventarioBodegaBaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const [presentaciones, productos, inventario, productosBidon, inventarioBase] = await Promise.all([
        db.presentacion.where('activo').equals(1).toArray(),
        db.producto_base.toArray(),
        db.inventario_bodega_presentacion.toArray(),
        db.producto_base
          .where('activo').equals(1)
          .filter((p) => p.unidad_compra === 'bidon')
          .toArray(),
        db.inventario_bodega_base.toArray(),
      ]);

      const nombrePorProducto = new Map(productos.map((p) => [p.id, p.nombre]));
      const cantidadPorPresentacion = new Map(
        inventario.map((i) => [i.presentacion_id, i.cantidad])
      );

      const merged: InventarioBodegaRow[] = presentaciones.map((p) => ({
        presentacion: p,
        productoNombre: nombrePorProducto.get(p.producto_base_id) ?? '—',
        cantidad: cantidadPorPresentacion.get(p.id) ?? 0,
      }));

      const basePorProducto = new Map(inventarioBase.map((i) => [i.producto_base_id, i]));
      const mergedBase: InventarioBodegaBaseRow[] = productosBidon.map((productoBase) => {
        const base = basePorProducto.get(productoBase.id);
        const bidonesDisponibles = base?.bidones_disponibles ?? 0;
        const litrosGranelEstimado = base?.litros_granel_estimado ?? 0;
        return {
          productoBase,
          bidonesDisponibles,
          litrosGranelEstimado,
          litrosDisponibles: bidonesDisponibles * (productoBase.litros_por_bidon ?? 0) + litrosGranelEstimado,
        };
      });

      setRows(merged);
      setBodegaBaseRows(mergedBase);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  return { rows, bodegaBaseRows, loading, error, refresh };
}
