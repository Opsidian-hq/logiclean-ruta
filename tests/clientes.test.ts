/**
 * Logiclean Ruta — Tests: administración de clientes (H-14)
 *
 * Trazabilidad con el PRD v1.2, H-14:
 *  - Editar un cliente → se actualizan sus datos → CLI-101
 *  - Reasignar a otro vendedor → pasa a la cartera del nuevo y deja de verse en
 *    la del anterior → CLI-102, CLI-103
 *  - Baja lógica: se desactiva, no se borra → CLI-104
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { guardarCliente, reasignarCliente, desactivarCliente } from '../src/lib/clientes';
import { db } from '../src/db/index';
import type { Cliente } from '../src/db/schema';

const base = (over: Partial<Cliente> = {}): Omit<Cliente, 'id'> & { id?: string } => ({
  vendedor_id: 'vend-A',
  nombre: 'Tienda Doña Mary',
  tipo: 'menudeo',
  estado: 'activo',
  ciclo_visita: 1,
  activo: true,
  ...over,
});

/** Lee los activos de un vendedor como lo hace el hook (.where('activo').equals(1)). */
async function carteraDe(vendedorId: string): Promise<Cliente[]> {
  const activos = await db.cliente.where('activo').equals(1).toArray();
  return activos.filter((c) => c.vendedor_id === vendedorId);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('[H-14] administración de clientes', () => {
  it('CLI-101: editar un cliente actualiza sus datos (mismo id)', async () => {
    const c = await guardarCliente(base({ nombre: 'Nombre viejo' }));
    await guardarCliente(base({ id: c.id, nombre: 'Nombre nuevo', tipo: 'mayoreo' }));

    const db1 = await db.cliente.get(c.id);
    expect(db1?.nombre).toBe('Nombre nuevo');
    expect(db1?.tipo).toBe('mayoreo');
  });

  it('CLI-102: reasignar mueve el cliente a la cartera del nuevo vendedor', async () => {
    const c = await guardarCliente(base({ vendedor_id: 'vend-A' }));

    expect(await carteraDe('vend-A')).toHaveLength(1);
    expect(await carteraDe('vend-B')).toHaveLength(0);

    await reasignarCliente(c.id, 'vend-B');

    // Pasa al nuevo y deja de verse en el anterior (dueño exclusivo).
    expect(await carteraDe('vend-A')).toHaveLength(0);
    const nuevaCartera = await carteraDe('vend-B');
    expect(nuevaCartera).toHaveLength(1);
    expect(nuevaCartera[0].id).toBe(c.id);
  });

  it('CLI-103: reasignar conserva el resto de los datos y encola el cambio', async () => {
    const c = await guardarCliente(base({ nombre: 'Cliente X', ciclo_visita: 3 }));
    await reasignarCliente(c.id, 'vend-B');

    const db1 = await db.cliente.get(c.id);
    expect(db1?.nombre).toBe('Cliente X');
    expect(db1?.ciclo_visita).toBe(3);

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    expect(pendientes.some((p) => p.table_name === 'cliente')).toBe(true);
  });

  it('CLI-104: baja lógica desactiva (no borra) y lo saca de la cartera', async () => {
    const c = await guardarCliente(base());
    await desactivarCliente(c.id);

    const db1 = await db.cliente.get(c.id);
    expect(db1).toBeTruthy(); // sigue existiendo
    expect(await carteraDe('vend-A')).toHaveLength(0); // pero ya no está activo
  });

  it('CLI-105: reasignar un cliente inexistente es rechazado', async () => {
    await expect(reasignarCliente('nope', 'vend-B')).rejects.toThrow(/No existe el cliente/);
  });
});
