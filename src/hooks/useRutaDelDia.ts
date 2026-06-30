/**
 * Logiclean Ruta — useRutaDelDia hook (H-08)
 *
 * Lista de clientes/prospectos a visitar hoy, leída desde Dexie (offline).
 * La lógica de selección vive en lib/ruta.ts (pura y probada).
 *
 * Cada elemento se enriquece con un resumen de lo que está pendiente con ese
 * cliente (cobros, entregas, seguimiento), para que la tarjeta de la ruta
 * muestre las alertas contextuales del rediseño sin abrir el perfil.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { clientesDeHoy, clientesFueraDeRutaConActividad, fechaISOLocal } from '../lib/ruta';
import { desgloseCliente } from '../lib/cobros';
import { pedidosPendientesDeCliente } from '../lib/pedidos';
import { CICLO_OBJETIVO } from '../lib/prospectos';
import { useAuthContext } from '../context/AuthContext';
import type { Cliente } from '../db/schema';

/** Resumen de seguimiento de un prospecto, para la alerta "Visita N de M". */
export interface SeguimientoResumen {
  visita: number;
  objetivo: number;
}

/** Elemento de la ruta del día con sus pendientes resueltos. */
export interface RutaItem {
  cliente: Cliente;
  /** Suma de saldos pendientes (ventas − cobros). 0 si está al corriente. */
  sumCobros: number;
  /** Número de pedidos pendientes de entrega. */
  nEntregas: number;
  /** Ciclo del prospecto (sólo para estado = 'prospecto'); null si no aplica. */
  seguimiento: SeguimientoResumen | null;
  /** Hay al menos una visita registrada hoy para este cliente. */
  visitadoHoy: boolean;
}

export interface UseRutaDelDiaReturn {
  items: RutaItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRutaDelDia(): UseRutaDelDiaReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [items, setItems] = useState<RutaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const todos = await db.cliente.where('activo').equals(1).toArray();
      // RLS ya acota la cartera local del vendedor; si hay sesión, filtramos
      // además por vendedor_id por seguridad ante datos residuales.
      const propios = vendedorId
        ? todos.filter((c) => c.vendedor_id === vendedorId)
        : todos;
      const clientes = clientesDeHoy(propios);

      // Una sola consulta batch para saber qué clientes ya fueron visitados hoy
      // (via visita formal o via venta directa).
      const hoyISO = fechaISOLocal(new Date());
      const visitasHoy = await db.visita.where('fecha').equals(hoyISO).toArray();

      // venta.fecha es timestamptz completo; se busca dentro del día local.
      const inicioDia = new Date();
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date();
      finDia.setHours(23, 59, 59, 999);
      const ventasHoy = await db.venta
        .where('fecha')
        .between(inicioDia.toISOString(), finDia.toISOString(), true, true)
        .toArray();

      const idsVisitadosHoy = new Set([
        ...visitasHoy.map((v) => v.cliente_id),
        ...ventasHoy.map((v) => v.cliente_id),
      ]);

      // Agregar clientes que tuvieron actividad hoy pero no estaban en la
      // ruta programada (ej. venta espontánea a un cliente sin dia_ruta).
      const idsEnRuta = new Set(clientes.map((c) => c.id));
      const extras = clientesFueraDeRutaConActividad(propios, idsEnRuta, idsVisitadosHoy);
      const todosParaProcesar = [...clientes, ...extras];

      // Resolver los pendientes de cada cliente en paralelo (cálculo local).
      const enriquecidos = await Promise.all(
        todosParaProcesar.map(async (cliente): Promise<RutaItem> => {
          const [desglose, pendientes] = await Promise.all([
            desgloseCliente(cliente.id),
            pedidosPendientesDeCliente(cliente.id),
          ]);
          return {
            cliente,
            sumCobros: desglose.saldoTotal,
            nEntregas: pendientes.length,
            seguimiento:
              cliente.estado === 'prospecto'
                ? { visita: Math.min(cliente.ciclo_visita, CICLO_OBJETIVO), objetivo: CICLO_OBJETIVO }
                : null,
            visitadoHoy: idsVisitadosHoy.has(cliente.id),
          };
        })
      );

      setItems(enriquecidos);
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

  return { items, loading, error, refresh };
}
