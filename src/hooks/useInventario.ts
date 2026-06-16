/**
 * Logiclean Ruta — useInventario hook
 *
 * Inventario del vehículo del vendedor actual. Lee desde Dexie (offline) y
 * cruza cada presentación activa con su cantidad cargada (0 si no hay fila),
 * para que el vendedor pueda cargar/ajustar su carga del día.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { setCantidad as setCantidadLib } from '../lib/inventario';
import { useAuthContext } from '../context/AuthContext';
import type { Presentacion } from '../db/schema';

// ── Tipos ─────────────────────────────────────────────────────

export interface InventarioRow {
  presentacion: Presentacion;
  productoNombre: string;
  cantidad: number;
}

export interface UseInventarioReturn {
  rows: InventarioRow[];
  loading: boolean;
  error: string | null;
  /** Fija la cantidad cargada de una presentación. */
  setCantidad: (presentacionId: string, cantidad: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useInventario(): UseInventarioReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [rows, setRows] = useState<InventarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    if (!vendedorId) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const [presentaciones, productos, inventario] = await Promise.all([
        db.presentacion.where('activo').equals(1).toArray(),
        db.producto_base.toArray(),
        db.inventario_vehiculo.where('vendedor_id').equals(vendedorId).toArray(),
      ]);

      const nombrePorProducto = new Map(productos.map((p) => [p.id, p.nombre]));
      const cantidadPorPresentacion = new Map(
        inventario.map((i) => [i.presentacion_id, i.cantidad])
      );

      const merged: InventarioRow[] = presentaciones.map((p) => ({
        presentacion: p,
        productoNombre: nombrePorProducto.get(p.producto_base_id) ?? '—',
        cantidad: cantidadPorPresentacion.get(p.id) ?? 0,
      }));

      setRows(merged);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  const setCantidad = useCallback(
    async (presentacionId: string, cantidad: number) => {
      if (!vendedorId) return;
      await setCantidadLib(vendedorId, presentacionId, cantidad);
      await loadFromLocal();
    },
    [vendedorId, loadFromLocal]
  );

  return { rows, loading, error, setCantidad, refresh };
}
