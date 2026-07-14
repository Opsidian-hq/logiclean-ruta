/**
 * Logiclean Ruta — useCorteReparto (H-20, Inc 7.4)
 *
 * Orquesta el stepper de 6 pasos: carga insumos (Dexie), deriva las entradas
 * del motor de dominio (`derivarVendedorEntrada` / `cargarNegocioEntrada`,
 * Inc 7.4) e invoca `calcularCorte` (motor puro, Inc 7.1) **una sola vez**
 * por cada insumo — el resultado (`salida`) es la única fuente de verdad
 * para los pasos 3-6. Este hook no recalcula V, T, posiciones, tope ni
 * arrastre: solo los lee.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../../db/index';
import { calcularCorte } from '../../../domain/corte';
import type { VendedorEntrada, CorteSalida } from '../../../domain/corte';
import { ultimoPeriodoFin } from '../../../lib/corteData';
import {
  cargarVendedoresActivos,
  cargarAperturaVigente,
  derivarVendedorEntrada,
  cargarNegocioEntrada,
  cargarSelladosDisponibles,
  confirmarCorte,
  type NegocioInsumos,
  type SelladoDisponible,
} from '../../../lib/corteReparto';
import { registrarDevolucionLaModerna } from '../../../lib/movimientoLaModerna';
import { abonoFisicoDelCorte, type AbonoFisicoPorVendedor } from '../../../lib/abonoVendedor';
import type { Vendedor, ProductoBase, Corte } from '../../../db/schema';

const hoyISO = () => new Date().toISOString().slice(0, 10);

export const PASOS = [
  'Validar',
  'La Moderna',
  'Obligaciones',
  'Reparto',
  'Liquidación',
  'Cierre',
] as const;

export interface UseCorteRepartoReturn {
  loading: boolean;
  error: string | null;
  paso: number;
  setPaso: (p: number) => void;
  periodoInicio: string;
  periodoFin: string;
  vendedores: Vendedor[];
  vendedoresEntrada: VendedorEntrada[];
  aperturaCorte: Corte | null;
  negocioInsumos: NegocioInsumos | null;
  productos: ProductoBase[];
  salida: CorteSalida | null;
  // Paso 1 — confirmación por vendedor
  confirmaciones: Record<string, boolean>;
  toggleConfirmacion: (vendedorId: string) => void;
  todosConfirmados: boolean;
  // Paso 2 — descuadre + acopio
  reconoceDescuadre: boolean;
  setReconoceDescuadre: (v: boolean) => void;
  selladosDisponibles: SelladoDisponible[];
  acopioSeleccion: Record<string, number>;
  setAcopioCantidad: (productoBaseId: string, cantidad: number) => void;
  totalAcopioSeleccionado: number;
  confirmarAcopio: () => Promise<void>;
  acopioPendiente: boolean;
  // Paso 6 — confirmación de cierre
  cerrando: boolean;
  cerrarCorte: () => Promise<Corte>;
  refrescar: () => Promise<void>;
}

export function useCorteReparto(responsableId: string | null): UseCorteRepartoReturn {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState(0);

  const [periodoInicio, setPeriodoInicio] = useState('');
  const periodoFin = hoyISO();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedoresEntrada, setVendedoresEntrada] = useState<VendedorEntrada[]>([]);
  const [aperturaCorte, setAperturaCorte] = useState<Corte | null>(null);
  const [negocioInsumos, setNegocioInsumos] = useState<NegocioInsumos | null>(null);
  const [productos, setProductos] = useState<ProductoBase[]>([]);
  const [selladosDisponibles, setSelladosDisponibles] = useState<SelladoDisponible[]>([]);

  const [confirmaciones, setConfirmaciones] = useState<Record<string, boolean>>({});
  const [reconoceDescuadre, setReconoceDescuadre] = useState(false);
  const [acopioSeleccion, setAcopioSeleccion] = useState<Record<string, number>>({});
  // Acopio ya confirmado en el Paso 2 pero aún no escrito: se acumula aquí
  // (cantidad por producto) y solo se convierte en escritura real dentro de
  // `cerrarCorte`, junto con el corte — nada de este flujo toca Dexie/la cola
  // de sync antes de que el usuario confirme el cierre en el Paso 6.
  const [acopioConfirmado, setAcopioConfirmado] = useState<Record<string, number>>({});
  const [acopioPendiente, setAcopioPendiente] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [vends, inicio, apertura, todosProductos, sellados] = await Promise.all([
        cargarVendedoresActivos(),
        ultimoPeriodoFin(),
        cargarAperturaVigente(),
        db.producto_base.toArray(),
        cargarSelladosDisponibles(),
      ]);

      setVendedores(vends);
      setPeriodoInicio(inicio);
      setAperturaCorte(apertura.corte);
      setProductos(todosProductos);
      setSelladosDisponibles(sellados);

      // El corte anterior acota el nuevo periodo por su INSTANTE exacto de
      // confirmación (`fecha_generado`), no por su fecha calendario: si se
      // confirman dos cortes el mismo día, comparar solo por día dejaría
      // fuera del nuevo corte cualquier operación de ese mismo día.
      const inicioInstante = apertura.corte?.fecha_generado ?? '';
      const [entradasCrudas, abonoFisico] = await Promise.all([
        Promise.all(
          vends.map((v) =>
            derivarVendedorEntrada(v.id, inicioInstante, periodoFin, apertura.porVendedor.get(v.id) ?? 0)
          )
        ),
        // Física de efectivo (Inc 7.5.2): cuánto de la bolsa cruda de cada
        // vendedor ya no está en su mano por un abono registrado contra el
        // corte que se está abriendo — mismo alcance que `apertura`, pero
        // para las instrucciones de liquidación, no el ledger de saldo.
        apertura.corte ? abonoFisicoDelCorte(apertura.corte.id) : Promise.resolve(new Map<string, AbonoFisicoPorVendedor>()),
      ]);
      const entradas = entradasCrudas.map((e) => {
        const abono = abonoFisico.get(e.vendedor_id);
        return abono
          ? {
              ...e,
              abono_ya_retirado_efectivo: abono.ya_retirado_efectivo,
              abono_ya_retirado_transferencia: abono.ya_retirado_transferencia,
              abono_ya_entregado_efectivo: abono.ya_entregado_efectivo,
              abono_ya_entregado_transferencia: abono.ya_entregado_transferencia,
            }
          : e;
      });
      setVendedoresEntrada(entradas);
      setConfirmaciones(Object.fromEntries(vends.map((v) => [v.id, false])));

      const negocio = await cargarNegocioEntrada(inicioInstante, periodoFin, apertura.moderna);
      setNegocioInsumos(negocio);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
    // periodoFin es la fecha de hoy: estable dentro de la vida de la sesión del stepper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  // El motor de dominio se invoca una sola vez por cada versión de insumos —
  // los pasos 3-6 solo LEEN `salida`, nunca recalculan V/T/posiciones/tope/arrastre.
  const salida = useMemo(() => {
    if (!negocioInsumos || vendedoresEntrada.length === 0) return null;
    return calcularCorte({ vendedores: vendedoresEntrada, negocio: negocioInsumos.negocio });
  }, [vendedoresEntrada, negocioInsumos]);

  const toggleConfirmacion = useCallback((vendedorId: string) => {
    setConfirmaciones((prev) => ({ ...prev, [vendedorId]: !prev[vendedorId] }));
  }, []);

  const todosConfirmados = vendedores.length > 0 && vendedores.every((v) => confirmaciones[v.id]);

  const totalAcopioSeleccionado = useMemo(() => {
    const precioPorId = new Map(productos.map((p) => [p.id, p.precio_preferencial ?? 0]));
    return Object.entries(acopioSeleccion).reduce(
      (sum, [productoBaseId, cantidad]) => sum + cantidad * (precioPorId.get(productoBaseId) ?? 0),
      0
    );
  }, [acopioSeleccion, productos]);

  const setAcopioCantidad = useCallback((productoBaseId: string, cantidad: number) => {
    setAcopioSeleccion((prev) => ({ ...prev, [productoBaseId]: Math.max(0, cantidad) }));
  }, []);

  // Disponible real de bodega para el Paso 2, descontando lo ya confirmado
  // en esta misma sesión (aún sin escribir): sin esto, confirmar el acopio
  // más de una vez seguiría mostrando el disponible original y dejaría
  // seleccionar más de lo que la bodega tiene.
  const selladosDisponiblesEfectivos = useMemo(() => {
    if (Object.keys(acopioConfirmado).length === 0) return selladosDisponibles;
    return selladosDisponibles.map((s) => ({
      ...s,
      disponibles: Math.max(0, s.disponibles - (acopioConfirmado[s.productoBaseId] ?? 0)),
    }));
  }, [selladosDisponibles, acopioConfirmado]);

  const confirmarAcopio = useCallback(async () => {
    if (!responsableId) throw new Error('Falta el responsable.');
    const lineas = Object.entries(acopioSeleccion).filter(([, cantidad]) => cantidad > 0);
    if (lineas.length === 0) return;

    setAcopioPendiente(true);
    try {
      // No se escribe nada todavía (Dexie/cola de sync): se acumula en
      // memoria y se registra de verdad recién en `cerrarCorte`, para que
      // el acopio nunca quede sincronizado sin que el corte se haya
      // confirmado.
      setAcopioConfirmado((prev) => {
        const next = { ...prev };
        for (const [productoBaseId, cantidad] of lineas) {
          next[productoBaseId] = (next[productoBaseId] ?? 0) + cantidad;
        }
        return next;
      });

      // Proyección del impacto en el adeudo (cálculo puro, misma fórmula ya
      // establecida — ADR-0009): no depende de que la escritura ya ocurrió.
      const totalMonto = lineas.reduce((sum, [id, cantidad]) => {
        const precio = productos.find((p) => p.id === id)?.precio_preferencial ?? 0;
        return sum + cantidad * precio;
      }, 0);
      setNegocioInsumos((prev) =>
        prev
          ? {
              ...prev,
              negocio: {
                ...prev.negocio,
                adeudo_la_moderna: Math.max(0, prev.negocio.adeudo_la_moderna - totalMonto),
              },
            }
          : prev
      );
      setAcopioSeleccion({});
    } finally {
      setAcopioPendiente(false);
    }
  }, [acopioSeleccion, productos, responsableId]);

  const cerrarCorte = useCallback(async () => {
    if (!salida || !negocioInsumos) throw new Error('El corte aún no terminó de calcularse.');
    if (!responsableId) throw new Error('Falta el responsable.');
    setCerrando(true);
    try {
      // Única escritura real del acopio: ocurre aquí, junto con el corte,
      // para que ambos se encolen y sincronicen como una sola unidad al
      // confirmar el cierre (Paso 6) — nunca antes.
      for (const [productoBaseId, cantidad] of Object.entries(acopioConfirmado)) {
        if (cantidad > 0) {
          await registrarDevolucionLaModerna({ productoBaseId, cantidad, responsableId });
        }
      }

      const { corte } = await confirmarCorte({
        periodoInicio,
        periodoFin,
        nVendedores: vendedores.length,
        vendedoresEntrada,
        negocio: negocioInsumos.negocio,
        salida,
      });
      setAcopioConfirmado({});
      return corte;
    } finally {
      setCerrando(false);
    }
  }, [
    salida,
    negocioInsumos,
    periodoInicio,
    periodoFin,
    vendedores.length,
    vendedoresEntrada,
    acopioConfirmado,
    responsableId,
  ]);

  return {
    loading,
    error,
    paso,
    setPaso,
    periodoInicio,
    periodoFin,
    vendedores,
    vendedoresEntrada,
    aperturaCorte,
    negocioInsumos,
    productos,
    salida,
    confirmaciones,
    toggleConfirmacion,
    todosConfirmados,
    reconoceDescuadre,
    setReconoceDescuadre,
    selladosDisponibles: selladosDisponiblesEfectivos,
    acopioSeleccion,
    setAcopioCantidad,
    totalAcopioSeleccionado,
    confirmarAcopio,
    acopioPendiente,
    cerrando,
    cerrarCorte,
    refrescar: cargar,
  };
}
