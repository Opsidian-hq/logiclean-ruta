/**
 * Logiclean Ruta — useSeguimiento hook (H-01, H-02)
 *
 * Seguimiento de prospectos del vendedor: lista de la semana (vencidos + por
 * vencer), alta de prospecto y registro de visita. Lee/escribe en Dexie.
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { prospectosDeLaSemana } from '../lib/prospectos';
import {
  crearProspecto as crearProspectoLib,
  registrarVisita as registrarVisitaLib,
  visitasDeCliente,
} from '../lib/visitas';
import type {
  CrearProspectoInput,
  RegistrarVisitaInput,
  RegistrarVisitaResult,
} from '../lib/visitas';
import { useAuthContext } from '../context/AuthContext';
import type { Cliente, Visita } from '../db/schema';

export type CrearProspectoArgs = Omit<CrearProspectoInput, 'vendedorId'>;
export type RegistrarVisitaArgs = Omit<RegistrarVisitaInput, 'vendedorId'>;

export interface UseSeguimientoReturn {
  prospectos: Cliente[];
  loading: boolean;
  error: string | null;
  crearProspecto: (args: CrearProspectoArgs) => Promise<Cliente>;
  registrarVisita: (args: RegistrarVisitaArgs) => Promise<RegistrarVisitaResult>;
  visitasDeCliente: (clienteId: string) => Promise<Visita[]>;
  refresh: () => Promise<void>;
}

export function useSeguimiento(): UseSeguimientoReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [prospectos, setProspectos] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const todos = await db.cliente.where('activo').equals(1).toArray();
      const propios = vendedorId
        ? todos.filter((c) => c.vendedor_id === vendedorId)
        : todos;
      setProspectos(prospectosDeLaSemana(propios));
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

  return {
    prospectos,
    loading,
    error,
    crearProspecto,
    registrarVisita,
    visitasDeCliente,
    refresh,
  };
}
