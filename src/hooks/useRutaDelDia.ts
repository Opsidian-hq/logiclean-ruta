/**
 * Logiclean Ruta — useRutaDelDia hook (H-08)
 *
 * Lista de clientes/prospectos a visitar hoy, leída desde Dexie (offline).
 * La lógica de selección vive en lib/ruta.ts (pura y probada).
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import { clientesDeHoy } from '../lib/ruta';
import { useAuthContext } from '../context/AuthContext';
import type { Cliente } from '../db/schema';

export interface UseRutaDelDiaReturn {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRutaDelDia(): UseRutaDelDiaReturn {
  const { user } = useAuthContext();
  const vendedorId = user?.id ?? null;

  const [clientes, setClientes] = useState<Cliente[]>([]);
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
      setClientes(clientesDeHoy(propios));
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

  return { clientes, loading, error, refresh };
}
