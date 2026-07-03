/**
 * Logiclean Ruta — useRegistrosNegocio hook (Inc 3, actualizado Inc 6.2)
 *
 * Registros del negocio que alimentan el corte: recepción de La Moderna
 * (bodega, H-16) y gastos de backoffice. Carga productos (para el selector) y
 * las listas recientes; expone los registradores (delegan en las libs puras).
 *
 * Desde Inc 6.2 (ADR-0006), el suministro ya no se captura a mano: el
 * gerente registra la recepción (`movimiento_la_moderna`, tipo=recibido) y el
 * rollup `suministro_la_moderna` se materializa del lado servidor.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarRecepcion } from '../lib/movimientoLaModerna';
import { registrarGasto } from '../lib/gastos';
import type { RegistrarRecepcionInput } from '../lib/movimientoLaModerna';
import type { RegistrarGastoInput } from '../lib/gastos';
import type { ProductoBase, MovimientoLaModerna, Gasto } from '../db/schema';

export interface UseRegistrosNegocioReturn {
  productos: ProductoBase[];
  recepciones: MovimientoLaModerna[];
  gastosBackoffice: Gasto[];
  nombreProducto: (id: string) => string;
  loading: boolean;
  crearRecepcion: (input: Omit<RegistrarRecepcionInput, 'responsableId'>) => Promise<void>;
  crearGastoBackoffice: (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useRegistrosNegocio(responsableId: string | null): UseRegistrosNegocioReturn {
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [recepciones, setRecepciones] = useState<MovimientoLaModerna[]>([]);
  const [gastosBackoffice, setGastosBackoffice] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [prods, movs, gastos] = await Promise.all([
      db.producto_base.where('activo').equals(1).toArray(),
      db.movimiento_la_moderna.where('tipo').equals('recibido').toArray(),
      db.gasto.where('tipo').equals('backoffice').toArray(),
    ]);
    setProductos(prods);
    setRecepciones(movs.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setGastosBackoffice(gastos.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
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

  const crearGastoBackoffice = useCallback(
    async (input: Omit<RegistrarGastoInput, 'tipo' | 'vendedorId'>) => {
      await registrarGasto({ ...input, tipo: 'backoffice' });
      await load();
    },
    [load]
  );

  return {
    productos,
    recepciones,
    gastosBackoffice,
    nombreProducto,
    loading,
    crearRecepcion,
    crearGastoBackoffice,
    refresh: load,
  };
}
