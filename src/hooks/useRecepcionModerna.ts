/**
 * Logiclean Ruta — useRecepcionModerna hook (Inc 3, extraído de
 * useRegistrosNegocio en el refactor de Inventario de bodega)
 *
 * Recepción y devolución con La Moderna (bodega, H-16/M-1) — alimenta el
 * corte vía el rollup `suministro_la_moderna`, materializado del lado
 * servidor a partir de los eventos `movimiento_la_moderna` que crea este
 * hook. Ver `lib/movimientoLaModerna.ts`.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarRecepcion, registrarDevolucionLaModerna } from '../lib/movimientoLaModerna';
import type { RegistrarRecepcionInput, RegistrarDevolucionLaModernaInput } from '../lib/movimientoLaModerna';
import type { ProductoBase, MovimientoLaModerna } from '../db/schema';

export interface UseRecepcionModernaReturn {
  productos: ProductoBase[];
  /** producto_base_id → factor_conversion de su presentación 'pieza' (solo productos unidad_compra='docena' con esa presentación en catálogo). */
  factorPiezaPorProducto: Map<string, number>;
  recepciones: MovimientoLaModerna[];
  devolucionesLaModerna: MovimientoLaModerna[];
  nombreProducto: (id: string) => string;
  loading: boolean;
  crearRecepcion: (input: Omit<RegistrarRecepcionInput, 'responsableId'>) => Promise<void>;
  crearDevolucionLaModerna: (input: Omit<RegistrarDevolucionLaModernaInput, 'responsableId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRecepcionModerna(responsableId: string | null): UseRecepcionModernaReturn {
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [factorPiezaPorProducto, setFactorPiezaPorProducto] = useState<Map<string, number>>(new Map());
  const [recepciones, setRecepciones] = useState<MovimientoLaModerna[]>([]);
  const [devolucionesLaModerna, setDevolucionesLaModerna] = useState<MovimientoLaModerna[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prods, movs, presentaciones] = await Promise.all([
      db.producto_base.where('activo').equals(1).toArray(),
      db.movimiento_la_moderna.toArray(),
      db.presentacion.where('activo').equals(1).toArray(),
    ]);
    setProductos(prods);
    setFactorPiezaPorProducto(
      new Map(
        presentaciones
          .filter((p) => p.unidad_venta === 'pieza')
          .map((p) => [p.producto_base_id, p.factor_conversion])
      )
    );
    setRecepciones(
      movs.filter((m) => m.tipo === 'recibido').sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    );
    setDevolucionesLaModerna(
      movs.filter((m) => m.tipo === 'devuelto').sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
    );
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

  const crearRecepcion = useCallback(
    async (input: Omit<RegistrarRecepcionInput, 'responsableId'>) => {
      if (!responsableId) throw new Error('Falta el gerente responsable.');
      await registrarRecepcion({ ...input, responsableId });
      await load();
    },
    [load, responsableId]
  );

  const crearDevolucionLaModerna = useCallback(
    async (input: Omit<RegistrarDevolucionLaModernaInput, 'responsableId'>) => {
      if (!responsableId) throw new Error('Falta el gerente responsable.');
      await registrarDevolucionLaModerna({ ...input, responsableId });
      await load();
    },
    [load, responsableId]
  );

  return {
    productos,
    factorPiezaPorProducto,
    recepciones,
    devolucionesLaModerna,
    nombreProducto,
    loading,
    crearRecepcion,
    crearDevolucionLaModerna,
    refresh: load,
  };
}
