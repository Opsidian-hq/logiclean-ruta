/**
 * Logiclean Ruta — useSeguimiento hook (H-01, H-02)
 *
 * Seguimiento de prospectos del vendedor: lista de la semana (vencidos + por
 * vencer), alta de prospecto y registro de visita. Lee/escribe en Dexie.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { seguimientoDeLaSemana } from '../lib/prospectos';
import { pedidosPendientesDeCliente } from '../lib/pedidos';
import {
  crearProspecto as crearProspectoLib,
  registrarVisita as registrarVisitaLib,
  reprogramarVisita as reprogramarVisitaLib,
  actualizarRutaCliente as actualizarRutaClienteLib,
  visitasDeCliente,
} from '../lib/visitas';
import type {
  CrearProspectoInput,
  RegistrarVisitaInput,
  RegistrarVisitaResult,
  ReprogramarVisitaInput,
  ActualizarRutaInput,
} from '../lib/visitas';
import { useAuthContext } from '../context/AuthContext';
import type { Cliente, Visita } from '../db/schema';

export type CrearProspectoArgs = Omit<CrearProspectoInput, 'vendedorId'>;
export type RegistrarVisitaArgs = Omit<RegistrarVisitaInput, 'vendedorId'>;

export interface UseSeguimientoReturn {
  /** Clientes a atender esta semana (prospectos + entregas/visitas agendadas). */
  seguimiento: Cliente[];
  /** Nº de pedidos pendientes por cliente, para etiquetar entregas. */
  entregasPorCliente: Record<string, number>;
  loading: boolean;
  error: string | null;
  crearProspecto: (args: CrearProspectoArgs) => Promise<Cliente>;
  registrarVisita: (args: RegistrarVisitaArgs) => Promise<RegistrarVisitaResult>;
  reprogramarVisita: (args: ReprogramarVisitaInput) => Promise<Cliente>;
  /** Fija/cambia el día de visita y/o la próxima visita del cliente. */
  actualizarRuta: (args: ActualizarRutaInput) => Promise<Cliente>;
  visitasDeCliente: (clienteId: string) => Promise<Visita[]>;
  refresh: () => Promise<void>;
}

export function useSeguimiento(): UseSeguimientoReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [seguimiento, setSeguimiento] = useState<Cliente[]>([]);
  const [entregasPorCliente, setEntregasPorCliente] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const todos = await db.cliente.where('activo').equals(1).toArray();
      const propios = vendedorId
        ? todos.filter((c) => c.vendedor_id === vendedorId)
        : todos;
      const lista = seguimientoDeLaSemana(propios);

      // Nº de pedidos pendientes por cliente listado (para etiquetar entregas).
      const conteos = await Promise.all(
        lista.map(async (c) => [c.id, (await pedidosPendientesDeCliente(c.id)).length] as const)
      );

      setSeguimiento(lista);
      setEntregasPorCliente(Object.fromEntries(conteos));
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

  const crearProspecto = useCallback(
    async (args: CrearProspectoArgs): Promise<Cliente> => {
      if (!vendedorId) throw new Error('No hay vendedor en sesión.');
      const cliente = await crearProspectoLib({ ...args, vendedorId });
      await loadFromLocal();
      return cliente;
    },
    [vendedorId, loadFromLocal]
  );

  const registrarVisita = useCallback(
    async (args: RegistrarVisitaArgs): Promise<RegistrarVisitaResult> => {
      if (!vendedorId) throw new Error('No hay vendedor en sesión.');
      const res = await registrarVisitaLib({ ...args, vendedorId });
      await loadFromLocal();
      return res;
    },
    [vendedorId, loadFromLocal]
  );

  const reprogramarVisita = useCallback(
    async (args: ReprogramarVisitaInput): Promise<Cliente> => {
      const cliente = await reprogramarVisitaLib(args);
      await loadFromLocal();
      return cliente;
    },
    [loadFromLocal]
  );

  const actualizarRuta = useCallback(
    async (args: ActualizarRutaInput): Promise<Cliente> => {
      const cliente = await actualizarRutaClienteLib(args);
      await loadFromLocal();
      return cliente;
    },
    [loadFromLocal]
  );

  return {
    seguimiento,
    entregasPorCliente,
    loading,
    error,
    crearProspecto,
    registrarVisita,
    reprogramarVisita,
    actualizarRuta,
    visitasDeCliente,
    refresh,
  };
}
