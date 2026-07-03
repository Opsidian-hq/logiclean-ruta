/**
 * Logiclean Ruta — useCargaDevolucion hook (Inc 6.4, H-18/H-19)
 *
 * Vendedores (para el selector del gerente), catálogo, estado actual de
 * bodega y de cada vehículo (contexto y validación de carga), y las cargas/
 * devoluciones recientes. El registro delega en `lib/cargaDevolucion.ts`.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { registrarCarga, registrarDevolucion } from '../lib/cargaDevolucion';
import type { LineaCantidadInput } from '../lib/cargaDevolucion';
import type {
  Vendedor,
  Presentacion,
  CargaVehiculo,
  CargaLinea,
  DevolucionBodega,
  DevolucionLinea,
  InventarioBodegaPresentacion,
  InventarioVehiculo,
} from '../db/schema';

export interface UseCargaDevolucionReturn {
  vendedores: Vendedor[];
  presentaciones: Presentacion[];
  nombrePresentacion: (id: string) => string;
  disponibleBodega: (presentacionId: string) => number;
  disponibleVehiculo: (vendedorId: string, presentacionId: string) => number;
  cargasRecientes: CargaVehiculo[];
  devolucionesRecientes: DevolucionBodega[];
  lineasCargaDe: (cargaId: string) => CargaLinea[];
  lineasDevolucionDe: (devolucionId: string) => DevolucionLinea[];
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
  const [cargasRecientes, setCargasRecientes] = useState<CargaVehiculo[]>([]);
  const [cargaLineas, setCargaLineas] = useState<CargaLinea[]>([]);
  const [devolucionesRecientes, setDevolucionesRecientes] = useState<DevolucionBodega[]>([]);
  const [devolucionLineas, setDevolucionLineas] = useState<DevolucionLinea[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [
      vends, pres, bodega, vehiculo, cargas, cLineas, devoluciones, dLineas,
    ] = await Promise.all([
      db.vendedor.toArray(),
      db.presentacion.where('activo').equals(1).toArray(),
      db.inventario_bodega_presentacion.toArray(),
      db.inventario_vehiculo.toArray(),
      db.carga_vehiculo.toArray(),
      db.carga_linea.toArray(),
      db.devolucion_bodega.toArray(),
      db.devolucion_linea.toArray(),
    ]);
    setVendedores(vends);
    setPresentaciones(pres);
    setBodegaPresentacion(bodega);
    setInventarioVehiculo(vehiculo);
    setCargasRecientes(cargas.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setCargaLineas(cLineas);
    setDevolucionesRecientes(devoluciones.sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')));
    setDevolucionLineas(dLineas);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const nombrePresentacion = useCallback(
    (id: string) => presentaciones.find((p) => p.id === id)?.nombre ?? id,
    [presentaciones]
  );

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

  const lineasCargaDe = useCallback(
    (cargaId: string) => cargaLineas.filter((l) => l.carga_id === cargaId),
    [cargaLineas]
  );

  const lineasDevolucionDe = useCallback(
    (devolucionId: string) => devolucionLineas.filter((l) => l.devolucion_id === devolucionId),
    [devolucionLineas]
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
      await registrarDevolucion({ vendedorId, responsableId, lineas, fecha });
      await load();
    },
    [load, responsableId]
  );

  return {
    vendedores,
    presentaciones,
    nombrePresentacion,
    disponibleBodega,
    disponibleVehiculo,
    cargasRecientes,
    devolucionesRecientes,
    lineasCargaDe,
    lineasDevolucionDe,
    loading,
    crearCarga,
    crearDevolucion,
    refresh: load,
  };
}
