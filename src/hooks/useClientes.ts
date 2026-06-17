/**
 * Logiclean Ruta — useClientes hook
 *
 * Gestión de clientes.
 *
 * Operaciones soportadas en Inc 0:
 *  - Listar clientes (con filtro por vendedor para gerente)
 *  - Crear/editar cliente
 *  - Reasignar vendedor
 *  - Baja lógica (activo=false)
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/index';
import {
  guardarCliente,
  reasignarCliente,
  desactivarCliente as desactivarClienteLib,
} from '../lib/clientes';
import type { Cliente } from '../db/schema';

// ── Tipos de retorno ──────────────────────────────────────────

export interface UseClientesReturn {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  /** Filtrar por vendedor_id (null = todos) */
  filtroVendedor: string | null;
  setFiltroVendedor: (id: string | null) => void;
  /** Crear o actualizar cliente */
  saveCliente: (
    data: Omit<Cliente, 'id'> & { id?: string }
  ) => Promise<Cliente>;
  /** Reasignar cliente a otro vendedor */
  reasignarVendedor: (clienteId: string, nuevoVendedorId: string) => Promise<void>;
  /** Baja lógica */
  desactivarCliente: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────

export function useClientes(): UseClientesReturn {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroVendedor, setFiltroVendedor] = useState<string | null>(null);

  const loadFromLocal = useCallback(async () => {
    try {
      const query = db.cliente.where('activo').equals(1);

      const results = await query.toArray();

      // Aplicar filtro de vendedor en memoria
      const filtered = filtroVendedor
        ? results.filter((c) => c.vendedor_id === filtroVendedor)
        : results;

      setClientes(filtered);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filtroVendedor]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadFromLocal();
  }, [loadFromLocal]);

  // Carga inicial desde la BD local (Dexie) al montar y al cambiar deps.
  // El setState ocurre dentro de loadFromLocal tras leer el almacén local.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFromLocal();
  }, [loadFromLocal]);

  // ── Operaciones de escritura ──────────────────────────────

  const saveCliente = useCallback(
    async (data: Omit<Cliente, 'id'> & { id?: string }): Promise<Cliente> => {
      const cliente = await guardarCliente(data);
      await loadFromLocal();
      return cliente;
    },
    [loadFromLocal]
  );

  const reasignarVendedor = useCallback(
    async (clienteId: string, nuevoVendedorId: string): Promise<void> => {
      await reasignarCliente(clienteId, nuevoVendedorId);
      await loadFromLocal();
    },
    [loadFromLocal]
  );

  const desactivarCliente = useCallback(
    async (id: string): Promise<void> => {
      await desactivarClienteLib(id);
      await loadFromLocal();
    },
    [loadFromLocal]
  );

  return {
    clientes,
    loading,
    error,
    filtroVendedor,
    setFiltroVendedor,
    saveCliente,
    reasignarVendedor,
    desactivarCliente,
    refresh,
  };
}
