/**
 * Logiclean Ruta — Tests: prospectos y visitas (H-01)
 *
 * Persistencia real en Dexie (fake-indexeddb), motor de sync mockeado.
 *
 * VISITA-001: crearProspecto deja "visita 1 de 4" con fecha y estado prospecto
 * VISITA-002: registrarVisita crea la VISITA con el número de ciclo actual
 * VISITA-003: registrarVisita avanza el ciclo y reprograma la próxima visita
 * VISITA-004: ambos cambios entran a la cola de sync (offline-first)
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: {
    enqueueAndSync: vi.fn(async () => {}),
    refreshPendingCount: vi.fn(async () => {}),
    syncNow: vi.fn(async () => {}),
  },
}));

import { crearProspecto, registrarVisita, visitasDeCliente } from '../src/lib/visitas';
import { db } from '../src/db/index';
import type { Cliente } from '../src/db/schema';

const VENDEDOR = 'vend-1';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('crearProspecto', () => {
  it('VISITA-001: queda en visita 1 de 4, prospecto, con la fecha indicada', async () => {
    const p = await crearProspecto({
      vendedorId: VENDEDOR,
      nombre: 'Tienda Nueva',
      tipo: 'menudeo',
      fecha: '2026-06-15',
    });

    expect(p.estado).toBe('prospecto');
    expect(p.ciclo_visita).toBe(1);
    expect(p.fecha_proxima_visita).toBe('2026-06-15');

    // Persistido y legible por el índice activo (booleano normalizado a 1/0).
    const activos = await db.cliente.where('activo').equals(1).toArray();
    expect(activos.map((c) => c.id)).toContain(p.id);
  });
});

describe('registrarVisita', () => {
  async function seedCliente(): Promise<Cliente> {
    const cliente: Cliente = {
      id: 'cli-1',
      vendedor_id: VENDEDOR,
      nombre: 'Prospecto X',
      tipo: 'mayoreo',
      estado: 'prospecto',
      ciclo_visita: 2,
      dia_ruta: null,
      fecha_proxima_visita: '2026-06-15',
      activo: true,
    };
    await db.cliente.put({ ...cliente, activo: 1 } as unknown as Cliente);
    return cliente;
  }

  it('VISITA-002/003: numera la visita y avanza el ciclo + reprograma', async () => {
    const cliente = await seedCliente();

    const { visita, cliente: actualizado } = await registrarVisita({
      vendedorId: VENDEDOR,
      cliente,
      nota: 'Mostré catálogo',
      siguientePaso: 'Llevar muestra',
      fechaProxima: '2026-06-22',
      fecha: '2026-06-15',
    });

    // La visita lleva el número de ciclo ANTES de avanzar.
    expect(visita.numero_ciclo).toBe(2);
    expect(visita.nota).toBe('Mostré catálogo');

    // El cliente avanzó a 3 y reprogramó su próxima visita.
    expect(actualizado.ciclo_visita).toBe(3);
    expect(actualizado.fecha_proxima_visita).toBe('2026-06-22');

    const enDB = await db.cliente.get('cli-1');
    expect(enDB?.ciclo_visita).toBe(3);
    expect(enDB?.fecha_proxima_visita).toBe('2026-06-22');

    const visitas = await visitasDeCliente('cli-1');
    expect(visitas).toHaveLength(1);
  });

  it('VISITA-004: visita y cliente entran a la cola como pending', async () => {
    const cliente = await seedCliente();
    await registrarVisita({ vendedorId: VENDEDOR, cliente, fechaProxima: '2026-06-22' });

    const pendientes = await db.sync_queue.where('status').equals('pending').toArray();
    const tablas = pendientes.map((p) => p.table_name).sort();
    expect(tablas).toEqual(['cliente', 'visita']);
  });
});
