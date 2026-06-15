/**
 * Logiclean Ruta — useCatalog hook
 *
 * Gestión del catálogo (PRODUCTO_BASE + PRESENTACION).
 *
 * Estrategia dual:
 *  - Online + gerente: lee/escribe en Supabase, replica en Dexie
 *  - Offline / vendedor: lee solo desde Dexie (solo lectura)
 *
 * Operaciones de escritura siempre pasan por la cola offline
 * para garantizar idempotencia y operación sin conexión.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
import type { ProductoBase, Presentacion } from '../db/schema';

// ── Tipos de retorno ──────────────────────────────────────────

export interface ProductoConPresentaciones extends ProductoBase {
  presentaciones: Presentacion[];
}

export interface UseCatalogReturn {
  productos: ProductoConPresentaciones[];
  loading: boolean;
  error: string | null;
  /** Crear o actualizar producto base (con sus presentaciones iniciales) */
  saveProducto: (
    data: Omit<ProductoBase, 'id'> & { id?: string }
  ) => Promise<ProductoBase>;
  /** Dar de baja lógica un producto base */
  desactivarProducto: (id: string) => Promise<void>;
  /** Crear o actualizar presentación */
  savePresentacion: (
    data: Omit<Presentacion, 'id'> & { id?: string }
  ) => Promise<Presentacion>;
  /** Dar de baja lógica una presentación */
  desactivarPresentacion: (id: string) => Promise<void>;
  /** Refrescar catálogo desde Dexie */
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useCatalog(): UseCatalogReturn {
  const [productos, setProductos] = useState<ProductoConPresentaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Cargar catálogo desde Dexie (funciona offline) */
  const loadFromLocal = useCallback(async () => {
    try {
      const prods = await db.producto_base
        .where('activo')
        .equals(1) // Dexie convierte boolean a 0/1 en IndexedDB
        .toArray();

      // Cargar presentaciones activas para cada producto
      const withPresentaciones = await Promise.all(
        prods.map(async (p) => {
          const presentaciones = await db.presentacion
            .where('producto_base_id')
            .equals(p.id)
            .filter((pr) => pr.activo)
            .toArray();
          return { ...p, presentaciones };
        })
      );

      setProductos(withPresentaciones);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  // Carga inicial desde la BD local (Dexie) al montar y al cambiar deps.
  // El setState ocurre dentro de loadFromLocal tras leer el almacén local.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  // ── Operaciones de escritura ──────────────────────────────

  const saveProducto = useCallback(
    async (data: Omit<ProductoBase, 'id'> & { id?: string }): Promise<ProductoBase> => {
      const producto: ProductoBase = {
        id: data.id ?? generateUUID(),
        nombre: data.nombre,
        unidad_compra: data.unidad_compra,
        precio_preferencial: data.precio_preferencial,
        activo: data.activo ?? true,
      };

      // Guardar en Dexie (local)
      await db.producto_base.put(producto);

      // Encolar para sync al servidor
      const queueItem = await enqueueOperation(
        'producto_base',
        'upsert',
        producto as unknown as Record<string, unknown>
      );
      await syncEngine.enqueueAndSync(queueItem);

      // Refrescar vista
      await loadFromLocal();
      return producto;
    },
    [loadFromLocal]
  );

  const desactivarProducto = useCallback(
    async (id: string): Promise<void> => {
      // Baja lógica: activo = false (nunca DELETE)
      await db.producto_base.update(id, { activo: false });

      const producto = await db.producto_base.get(id);
      if (producto) {
        const queueItem = await enqueueOperation(
          'producto_base',
          'upsert',
          { ...producto, activo: false } as unknown as Record<string, unknown>
        );
        await syncEngine.enqueueAndSync(queueItem);
      }

      await loadFromLocal();
    },
    [loadFromLocal]
  );

  const savePresentacion = useCallback(
    async (data: Omit<Presentacion, 'id'> & { id?: string }): Promise<Presentacion> => {
      const presentacion: Presentacion = {
        id: data.id ?? generateUUID(),
        producto_base_id: data.producto_base_id,
        nombre: data.nombre,
        unidad_venta: data.unidad_venta,
        factor_conversion: data.factor_conversion,
        precio_mayoreo: data.precio_mayoreo,
        precio_menudeo: data.precio_menudeo,
        activo: data.activo ?? true,
      };

      await db.presentacion.put(presentacion);

      const queueItem = await enqueueOperation(
        'presentacion',
        'upsert',
        presentacion as unknown as Record<string, unknown>
      );
      await syncEngine.enqueueAndSync(queueItem);

      await loadFromLocal();
      return presentacion;
    },
    [loadFromLocal]
  );

  const desactivarPresentacion = useCallback(
    async (id: string): Promise<void> => {
      await db.presentacion.update(id, { activo: false });

      const pres = await db.presentacion.get(id);
      if (pres) {
        const queueItem = await enqueueOperation(
          'presentacion',
          'upsert',
          { ...pres, activo: false } as unknown as Record<string, unknown>
        );
        await syncEngine.enqueueAndSync(queueItem);
      }

      await loadFromLocal();
    },
    [loadFromLocal]
  );

  return {
    productos,
    loading,
    error,
    saveProducto,
    desactivarProducto,
    savePresentacion,
    desactivarPresentacion,
    refresh,
  };
}
