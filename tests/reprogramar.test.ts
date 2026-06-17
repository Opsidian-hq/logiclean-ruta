/**
 * Logiclean Ruta — Tests: reprogramar/insertar visita (H-09)
 *
 * REPROG-001: mueve la próxima visita sin avanzar el ciclo y persiste
 * REPROG-002: encola el cambio del cliente (offline-first)
 * REPROG-003: opcionalmente reasigna el día de ruta
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/supabase', () => ({ supabase: {} }));
vi.mock('../src/sync/SyncEngine', () => ({
  syncEngine: { enqueueAndSync: vi.fn(async () => {}) },
}));

import { reprogramarVisita } from '../src/lib/visitas';
import { esRutaDeHoy, clientesDeHoy, fechaISOLocal } from '../src/lib/ruta';
import { db } from '../src/db/index';
import type { Cliente } from '../src/db/schema';

const cliente: Cliente = {
  id: 'cli-1',
  vendedor_id: 'vend-1',
  nombre: 'Estética Brenda',
  tipo: 'menudeo',
  estado: 'prospecto',
  ciclo_visita: 2,
  dia_ruta: 'Lunes',
  fecha_proxima_visita: '2026-06-10',
  activo: true,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('reprogramarVisita', () => {
  it('REPROG-001: mueve la fecha sin avanzar el ciclo', async () => {
    const res = await reprogramarVisita({ cliente, fechaProxima: '2026-06-16' });
    expect(res.fecha_proxima_visita).toBe('2026-06-16');
    expect(res.ciclo_visita).toBe(2); // no avanza
    const enDb = await db.cliente.get('cli-1');
    expect(enDb?.fecha_proxima_visita).toBe('2026-06-16');
  });

  it('REPROG-002: encola el cambio del cliente', async () => {
    await reprogramarVisita({ cliente, fechaProxima: '2026-06-16' });
    const cola = await db.sync_queue.toArray();
    expect(cola).toHaveLength(1);
    expect(cola[0].table_name).toBe('cliente');
    expect(cola[0].status).toBe('pending');
  });

  it('REPROG-003: reasigna el día de ruta si se indica', async () => {
    const res = await reprogramarVisita({ cliente, fechaProxima: '2026-06-16', diaRuta: 'Miércoles' });
    expect(res.dia_ruta).toBe('Miércoles');
  });
});

// ── [H-09·1] insertar ad-hoc en la jornada (o programar a otra fecha) ──
describe('[H-09·1] insertar un pedido/visita fuera de la ruta planeada', () => {
  // Cliente fuera de la ruta de hoy: sin día de ruta y con fecha lejana.
  const fuera: Cliente = {
    ...cliente,
    dia_ruta: null,
    fecha_proxima_visita: '2000-01-01',
  };
  const hoyISO = fechaISOLocal(new Date());

  it('REPROG-004: insertar para HOY hace que aparezca en la ruta del día', async () => {
    // Precondición: no está en la ruta de hoy.
    expect(esRutaDeHoy(fuera)).toBe(false);

    const res = await reprogramarVisita({ cliente: fuera, fechaProxima: hoyISO });

    expect(res.fecha_proxima_visita).toBe(hoyISO);
    expect(esRutaDeHoy(res)).toBe(true);
    // Entra a la lista de "clientes de hoy".
    expect(clientesDeHoy([res]).map((c) => c.id)).toContain('cli-1');
  });

  it('REPROG-005: programar a otra fecha NO lo mete en la ruta de hoy', async () => {
    const otra = fechaISOLocal(new Date(Date.now() + 9 * 86_400_000)); // +9 días
    const res = await reprogramarVisita({ cliente: fuera, fechaProxima: otra });

    expect(res.fecha_proxima_visita).toBe(otra);
    expect(esRutaDeHoy(res)).toBe(false);
    expect(clientesDeHoy([res])).toHaveLength(0);
  });
});
