/**
 * Logiclean Ruta — useCargaDevolucion hook (Inc 6.4, H-18/H-19)
 *
 * Vendedores (para el selector del gerente), catálogo, y estado actual de
 * bodega y de cada vehículo (contexto y validación de carga). El registro
 * delega en `lib/cargaDevolucion.ts`. El historial de cargas/devoluciones
 * recientes vive en el Inicio del gerente (`useDashboard`), acotado al
 * periodo desde el último corte.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarCarga, registrarDevolucion } from '../lib/cargaDevolucion';
import type { LineaCantidadInput } from '../lib/cargaDevolucion';
import type { Vendedor, Presentacion, InventarioBodegaPresentacion, InventarioVehiculo } from '../db/schema';

export interface UseCargaDevolucionReturn {
  vendedores: Vendedor[];
  presentaciones: Presentacion[];
  disponibleBodega: (presentacionId: string) => number;
  disponibleVehiculo: (vendedorId: string, presentacionId: string) => number;
  loading: boolean;
  crearCarga: (vendedorId: string, lineas: LineaCantidadInput[], fecha?: string) => Promise<void>;
  crearDevolucion: (vendedorId: string, lineas: LineaCantidadInput[], fecha?: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCargaDevolucion(responsableId: string | null): UseCargaDevolucionReturn {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [bodegaPresentacion, setBodegaPresentacion] = useState<InventarioBodegaPresentacion[]>([]);
  const [inventarioVehiculo, setInventarioVehiculo] = useState<InventarioVehiculo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [vends, pres, bodega, vehiculo] = await Promise.all([
      db.vendedor.toArray(),
      db.presentacion.where('activo').equals(1).toArray(),
      db.inventario_bodega_presentacion.toArray(),
      db.inventario_vehiculo.toArray(),
    ]);
    setVendedores(vends);
    setPresentaciones(pres);
    setBodegaPresentacion(bodega);
    setInventarioVehiculo(vehiculo);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const disponibleBodega = useCallback(
    (presentacionId: string) =>
      bodegaPresentacion.find((b) => b.presentacion_id === presentacionId)?.cantidad ?? 0,
    [bodegaPresentacion]
  );

  const disponibleVehiculo = useCallback(
    (vendedorId: string, presentacionId: string) =>
      inventarioVehiculo.find(
        (i) => i.vendedor_id === vendedorId && i.presentacion_id === presentacionId
      )?.cantidad ?? 0,
    [inventarioVehiculo]
  );

  const crearCarga = useCallback(
    async (vendedorId: string, lineas: LineaCantidadInput[], fecha?: string) => {
      if (!responsableId) throw new Error('Falta el responsable.');
      const disponibleMap = new Map(
        bodegaPresentacion.map((b) => [b.presentacion_id, b.cantidad])
      );
      await registrarCarga({
        vendedorId,
        responsableId,
        lineas,
        disponibleBodega: disponibleMap,
        fecha,
      });
      await load();
    },
    [load, responsableId, bodegaPresentacion]
  );

  const crearDevolucion = useCallback(
    async (vendedorId: string, lineas: LineaCantidadInput[], fecha?: string) => {
      if (!responsableId) throw new Error('Falta el responsable.');
      const disponibleMap = new Map(
        inventarioVehiculo
          .filter((i) => i.vendedor_id === vendedorId)
          .map((i) => [i.presentacion_id, i.cantidad])
      );
      await registrarDevolucion({ vendedorId, responsableId, lineas, disponibleVehiculo: disponibleMap, fecha });
      await load();
    },
    [load, responsableId, inventarioVehiculo]
  );

  return {
    vendedores,
    presentaciones,
    disponibleBodega,
    disponibleVehiculo,
    loading,
    crearCarga,
    crearDevolucion,
    refresh: load,
  };
}
