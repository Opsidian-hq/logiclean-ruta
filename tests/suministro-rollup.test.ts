/**
 * Logiclean Ruta — Tests Inc 6.2: rollup de suministro (ADR-0006)
 *
 * Pruebas de especificación/documentación sobre 008_suministro_rollup.sql,
 * igual que rls.test.ts / bodega-rls.test.ts — NO ejecutan contra Supabase
 * real. El comportamiento (rollup 1:1, idempotencia, devuelto fuera de
 * alcance) se verificó manualmente contra un Postgres 16 local antes de
 * abrir el PR — ver descripción del PR.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(__dirname, '../supabase/migrations/008_suministro_rollup.sql'),
  'utf-8'
);

describe('008_suministro_rollup.sql', () => {
  it('el trigger es AFTER INSERT (nunca OR UPDATE) — idempotente por UUID (T11)', () => {
    const triggerBlock = sql.match(/CREATE OR REPLACE TRIGGER trg_movimiento_la_moderna_suministro[\s\S]*?;/)?.[0];
    expect(triggerBlock).toBeTruthy();
    expect(triggerBlock).toMatch(/AFTER INSERT ON movimiento_la_moderna/);
    expect(triggerBlock).not.toMatch(/OR UPDATE/);
  });

  it('la función de aplicación es SECURITY DEFINER (evita permission denied bajo RLS)', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna_a_suministro[\s\S]*?SECURITY DEFINER/);
  });

  it('solo tipo=recibido alimenta el rollup; devuelto queda fuera (Inc 6.5)', () => {
    const fnBody = sql.match(/CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna_a_suministro[\s\S]*?\$\$;/)?.[0] ?? '';
    expect(fnBody).toMatch(/IF NEW\.tipo = 'recibido' THEN/);
    expect(fnBody).not.toMatch(/'devuelto'/);
  });

  it('inserta 1:1 (mismo id del evento) en suministro_la_moderna, sin acumular en una sola fila', () => {
    expect(sql).toMatch(/INSERT INTO suministro_la_moderna \(id, producto_base_id, fecha, cantidad_recibida, cantidad_devuelta\)/);
    expect(sql).toMatch(/VALUES \(NEW\.id, NEW\.producto_base_id, NEW\.fecha, NEW\.cantidad, 0\)/);
    // A diferencia de los contadores de bodega (007), no hay ON CONFLICT
    // aditivo aquí: adeudoLaModerna() ya suma cantidad_recibida/devuelta a
    // través de todas las filas del periodo (src/lib/suministro.ts).
    expect(sql).not.toMatch(/ON CONFLICT/);
  });
});
