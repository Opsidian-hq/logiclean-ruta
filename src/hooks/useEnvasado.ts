/**
 * Logiclean Ruta — useEnvasado hook (Inc 6.3, H-17)
 *
 * Productos base envasables (químicos en bidón), sus presentaciones, el
 * estado actual de bodega (contexto para el gerente) y los envasados
 * recientes. Lee de Dexie (offline); el registro delega en `lib/envasado.ts`.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarEnvasado } from '../lib/envasado';
import type { RegistrarEnvasadoInput } from '../lib/envasado';
import type {
  ProductoBase,
  Presentacion,
  Envasado,
  EnvasadoLinea,
  InventarioBodegaBase,
} from '../db/schema';

export interface UseEnvasadoReturn {
  /** Productos envasables: químicos en bidón (unidad_compra='bidon'). */
  productos: ProductoBase[];
  presentaciones: Presentacion[];
  envasadosRecientes: Envasado[];
  nombreProducto: (id: string) => string;
  nombrePresentacion: (id: string) => string;
  /** Estado de bodega del producto base (disponibles/granel), si ya se hidrató. */
  bodegaDe: (productoBaseId: string) => InventarioBodegaBase | undefined;
  /** Presentaciones activas de un producto base (para las líneas del formulario). */
  presentacionesDe: (productoBaseId: string) => Presentacion[];
  /** Líneas envasadas de un envasado ya registrado (para el resumen de recientes). */
  lineasDe: (envasadoId: string) => EnvasadoLinea[];
  loading: boolean;
  crearEnvasado: (input: Omit<RegistrarEnvasadoInput, 'responsableId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useEnvasado(responsableId: string | null): UseEnvasadoReturn {
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [envasadosRecientes, setEnvasadosRecientes] = useState<Envasado[]>([]);
  const [envasadoLineas, setEnvasadoLineas] = useState<EnvasadoLinea[]>([]);
  const [bodegaBase, setBodegaBase] = useState<InventarioBodegaBase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prods, pres, envs, lineas, bodega] = await Promise.all([
      db.producto_base
        .where('activo').equals(1)
        .filter((p) => p.unidad_compra === 'bidon')
        .toArray(),
      db.presentacion.where('activo').equals(1).toArray(),
      db.envasado.toArray(),
      db.envasado_linea.toArray(),
      db.inventario_bodega_base.toArray(),
    ]);
    setProductos(prods);
    setPresentaciones(pres);
    setEnvasadosRecientes(envs.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setEnvasadoLineas(lineas);
    setBodegaBase(bodega);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const nombreProducto = useCallback(
    (id: string) => productos.find((p) => p.id === id)?.nombre ?? id,
    [productos]
  );

  const nombrePresentacion = useCallback(
    (id: string) => presentaciones.find((p) => p.id === id)?.nombre ?? id,
    [presentaciones]
  );

  const bodegaDe = useCallback(
    (productoBaseId: string) => bodegaBase.find((b) => b.producto_base_id === productoBaseId),
    [bodegaBase]
  );

  const presentacionesDe = useCallback(
    (productoBaseId: string) => presentaciones.filter((p) => p.producto_base_id === productoBaseId),
    [presentaciones]
  );

  const lineasDe = useCallback(
    (envasadoId: string) => envasadoLineas.filter((l) => l.envasado_id === envasadoId),
    [envasadoLineas]
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
    envasadosRecientes,
    nombreProducto,
    nombrePresentacion,
    bodegaDe,
    presentacionesDe,
    lineasDe,
    loading,
    crearEnvasado,
    refresh: load,
  };
}
