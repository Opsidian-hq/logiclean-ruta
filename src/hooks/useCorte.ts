/**
 * Logiclean Ruta — useCorte hook (H-10, Inc 3)
 *
 * Orquesta la previsualización y el registro del corte semanal del gerente.
 * NO contiene lógica de dinero: acota los datos de Dexie por vendedor y periodo
 * y delega el cálculo a `calcularCorte` / `generarCorte` (lib pura y testeada).
 *
 *  - `periodo_inicio` se deriva del último corte del vendedor (o queda abierto
 *    si aún no hay corte previo).
 *  - Backoffice y La Moderna son a nivel negocio: se acotan solo por fecha.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { calcularCorte, generarCorte } from '../lib/corte';
import type { CorteSnapshot } from '../lib/corte';
import type { Vendedor } from '../db/schema';

export interface EntregaInput {
  efectivo?: number;
  transferencias?: number;
}

export interface UseCorteReturn {
  vendedores: Vendedor[];
  vendedorId: string;
  setVendedorId: (id: string) => void;
  /** Inicio del periodo (derivado del último corte; '' = sin corte previo). */
  periodoInicio: string;
  periodoFin: string;
  setPeriodoFin: (d: string) => void;
  snapshot: CorteSnapshot | null;
  /** Nombre de producto base por id (para la vista de inventario en bidones). */
  nombresProducto: Record<string, string>;
  loading: boolean;
  error: string | null;
  registrar: (entrega?: EntregaInput) => Promise<void>;
  refresh: () => Promise<void>;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const soloFecha = (iso?: string | null) => (iso ?? '').slice(0, 10);

export function useCorte(): UseCorteReturn {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFin, setPeriodoFin] = useState(hoyISO());
  const [snapshot, setSnapshot] = useState<CorteSnapshot | null>(null);
  const [nombresProducto, setNombresProducto] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lista de vendedores para el selector.
  useEffect(() => {
    db.vendedor.toArray().then(setVendedores);
  }, []);

  const cargar = useCallback(async () => {
    if (!vendedorId) {
      setSnapshot(null);
      setPeriodoInicio('');
      return;
    }
    setLoading(true);
    try {
      // Inicio del periodo = fin del último corte del vendedor (si hay).
      const cortesPrevios = await db.corte.where('vendedor_id').equals(vendedorId).toArray();
      const inicio = cortesPrevios
        .map((c) => c.periodo_fin)
        .sort()
        .at(-1) ?? '';
      setPeriodoInicio(inicio);

      const enRango = (iso?: string | null) => {
        const d = soloFecha(iso);
        return (!inicio || d > inicio) && d <= periodoFin;
      };

      const [
        ventasVend,
        todosCobros,
        gastos,
        inventario,
        presentaciones,
        suministros,
        productos,
      ] = await Promise.all([
        db.venta.where('vendedor_id').equals(vendedorId).toArray(),
        db.cobro.toArray(),
        db.gasto.toArray(),
        db.inventario_vehiculo.where('vendedor_id').equals(vendedorId).toArray(),
        db.presentacion.toArray(),
        db.suministro_la_moderna.toArray(),
        db.producto_base.toArray(),
      ]);

      // Ventas del vendedor dentro del periodo.
      const ventas = ventasVend.filter((v) => enRango(v.fecha));

      // Cobros del periodo cuyas ventas son de este vendedor.
      const idsVentasVend = new Set(ventasVend.map((v) => v.id));
      const cobros = todosCobros.filter(
        (c) => idsVentasVend.has(c.venta_id) && enRango(c.fecha)
      );

      // Gastos: de ruta del vendedor + de backoffice (negocio), dentro del periodo.
      const gastosCorte = gastos.filter(
        (g) =>
          enRango(g.fecha) &&
          ((g.tipo === 'ruta' && g.vendedor_id === vendedorId) || g.tipo === 'backoffice')
      );

      // Suministros del periodo (nivel negocio).
      const suministrosCorte = suministros.filter((s) => enRango(s.fecha));

      const snap = calcularCorte({
        ventas,
        cobros,
        gastos: gastosCorte,
        inventario,
        presentaciones,
        suministros: suministrosCorte,
        productos,
      });
      setSnapshot(snap);
      setNombresProducto(Object.fromEntries(productos.map((p) => [p.id, p.nombre])));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [vendedorId, periodoFin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const registrar = useCallback(
    async (entrega?: EntregaInput) => {
      if (!vendedorId) throw new Error('Selecciona un vendedor.');
      // Inicio concreto requerido por el cierre: usa el del último corte o,
      // si no hay, el propio fin (periodo de un solo día / arranque).
      const inicioConcreto = periodoInicio || periodoFin;

      // Re-acota igual que la previsualización para no depender del estado.
      const ventasVend = await db.venta.where('vendedor_id').equals(vendedorId).toArray();
      const enRango = (iso?: string | null) => {
        const d = soloFecha(iso);
        return (!periodoInicio || d > periodoInicio) && d <= periodoFin;
      };
      const [todosCobros, gastos, inventario, presentaciones, suministros, productos] =
        await Promise.all([
          db.cobro.toArray(),
          db.gasto.toArray(),
          db.inventario_vehiculo.where('vendedor_id').equals(vendedorId).toArray(),
          db.presentacion.toArray(),
          db.suministro_la_moderna.toArray(),
          db.producto_base.toArray(),
        ]);
      const idsVentasVend = new Set(ventasVend.map((v) => v.id));

      await generarCorte({
        vendedorId,
        periodoInicio: inicioConcreto,
        periodoFin,
        efectivoEntregado: entrega?.efectivo,
        transferenciasEntregadas: entrega?.transferencias,
        ventas: ventasVend.filter((v) => enRango(v.fecha)),
        cobros: todosCobros.filter((c) => idsVentasVend.has(c.venta_id) && enRango(c.fecha)),
        gastos: gastos.filter(
          (g) =>
            enRango(g.fecha) &&
            ((g.tipo === 'ruta' && g.vendedor_id === vendedorId) || g.tipo === 'backoffice')
        ),
        inventario,
        presentaciones,
        suministros: suministros.filter((s) => enRango(s.fecha)),
        productos,
      });

      // El periodo avanzó: recalcular (la previsualización quedará vacía).
      await cargar();
    },
    [vendedorId, periodoInicio, periodoFin, cargar]
  );

  return {
    vendedores,
    vendedorId,
    setVendedorId,
    periodoInicio,
    periodoFin,
    setPeriodoFin,
    snapshot,
    nombresProducto,
    loading,
    error,
    registrar,
    refresh: cargar,
  };
}
