/**
 * Logiclean Ruta — Tests: gestión de día de visita por el vendedor
 *
 * RUTA-001: cambia sólo el día de ruta sin tocar la fecha próxima ni el ciclo
 * RUTA-002: cambia sólo la fecha próxima sin tocar el día de ruta
 * RUTA-003: quita el día de ruta (null) → sale de la ruta recurrente
 * RUTA-004: encola el cambio del cliente (offline-first)
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { actualizarRutaCliente } from '../src/lib/visitas';
import { esRutaDeHoy, diaSemana } from '../src/lib/ruta';
import { db } from '../src/db/index';
import type { Cliente } from '../src/db/schema';

const cliente: Cliente = {
  id: 'cli-1',
  vendedor_id: 'vend-1',
  nombre: 'Abarrotes Lupita',
  tipo: 'mayoreo',
  estado: 'activo',
  ciclo_visita: 3,
  dia_ruta: 'Lunes',
  fecha_proxima_visita: '2026-06-10',
  activo: true,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('actualizarRutaCliente', () => {
  it('RUTA-001: cambia sólo el día sin tocar fecha ni ciclo', async () => {
    const res = await actualizarRutaCliente({ cliente, diaRuta: 'Miércoles' });
    expect(res.dia_ruta).toBe('Miércoles');
    expect(res.fecha_proxima_visita).toBe('2026-06-10'); // intacto
    expect(res.ciclo_visita).toBe(3); // no avanza
    const enDb = await db.cliente.get('cli-1');
    expect(enDb?.dia_ruta).toBe('Miércoles');
  });

  it('RUTA-002: cambia sólo la fecha sin tocar el día', async () => {
    const res = await actualizarRutaCliente({ cliente, fechaProxima: '2026-06-20' });
    expect(res.fecha_proxima_visita).toBe('2026-06-20');
    expect(res.dia_ruta).toBe('Lunes'); // intacto
  });

  it('RUTA-003: quita el día de ruta (null)', async () => {
    const res = await actualizarRutaCliente({ cliente, diaRuta: null });
    expect(res.dia_ruta).toBeNull();
  });

  it('RUTA-004: encola el cambio del cliente', async () => {
    await actualizarRutaCliente({ cliente, diaRuta: 'Martes' });
    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].table_name).toBe('cliente');
    expect(cola[0].status).toBe('pending');
  });

  it('RUTA-005: asignar el día de hoy lo mete en la ruta del día', async () => {
    // Cliente fuera de la ruta de hoy: sin día y con fecha lejana.
    const fuera: Cliente = { ...cliente, dia_ruta: null, fecha_proxima_visita: '2000-01-01' };
    expect(esRutaDeHoy(fuera)).toBe(false);

    const hoyNombre = diaSemana(new Date()); // normalizado (minúsculas)
    const res = await actualizarRutaCliente({ cliente: fuera, diaRuta: hoyNombre });
    expect(esRutaDeHoy(res)).toBe(true);
  });
});
