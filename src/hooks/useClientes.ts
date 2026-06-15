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
import { generateUUID } from '../lib/uuid';
import { enqueueOperation } from '../sync/queue';
import { syncEngine } from '../sync/SyncEngine';
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
      const cliente: Cliente = {
        id: data.id ?? generateUUID(),
        vendedor_id: data.vendedor_id,
        nombre: data.nombre,
        tipo: data.tipo,
        estado: data.estado,
        ciclo_visita: data.ciclo_visita ?? 1,
        dia_ruta: data.dia_ruta,
        fecha_proxima_visita: data.fecha_proxima_visita,
        activo: data.activo ?? true,
      };

      await db.cliente.put(cliente);

      const queueItem = await enqueueOperation(
        'cliente',
        'upsert',
        cliente as unknown as Record<string, unknown>
      );
      await syncEngine.enqueueAndSync(queueItem);

      await loadFromLocal();
      return cliente;
    },
    [loadFromLocal]
  );

  const reasignarVendedor = useCallback(
    async (clienteId: string, nuevoVendedorId: string): Promise<void> => {
      await db.cliente.update(clienteId, { vendedor_id: nuevoVendedorId });

      const cliente = await db.cliente.get(clienteId);
      if (cliente) {
        const queueItem = await enqueueOperation(
          'cliente',
          'upsert',
          { ...cliente, vendedor_id: nuevoVendedorId } as unknown as Record<string, unknown>
        );
        await syncEngine.enqueueAndSync(queueItem);
      }

      await loadFromLocal();
    },
    [loadFromLocal]
  );

  const desactivarCliente = useCallback(
    async (id: string): Promise<void> => {
      // Baja lógica: activo = false (nunca DELETE)
      await db.cliente.update(id, { activo: false });

      const cliente = await db.cliente.get(id);
      if (cliente) {
        const queueItem = await enqueueOperation(
          'cliente',
          'upsert',
          { ...cliente, activo: false } as unknown as Record<string, unknown>
        );
        await syncEngine.enqueueAndSync(queueItem);
      }

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
