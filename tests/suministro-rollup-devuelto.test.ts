/**
 * Logiclean Ruta — Tests Inc 6.5: rollup de devolución a La Moderna (ADR-0010)
 *
 * Pruebas de especificación sobre 009_suministro_rollup_devuelto.sql, igual
 * que bodega-rls.test.ts / suministro-rollup.test.ts — NO ejecutan contra
 * Supabase real. El comportamiento (rollup 1:1 de devuelto, idempotencia,
 * que recibido siga funcionando) se verificó manualmente contra un Postgres
 * 16 local antes de abrir el PR — ver descripción del PR.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = readFileSync(
  join(__dirname, '../supabase/migrations/009_suministro_rollup_devuelto.sql'),
  'utf-8'
);

describe('009_suministro_rollup_devuelto.sql', () => {
  it('reemplaza la función existente (mismo nombre) en vez de crear un trigger nuevo', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna_a_suministro/);
    // No debe crear un trigger nuevo — el de 008 ya está enlazado a la función.
    expect(sql).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/);
  });

  it('maneja recibido y devuelto en la misma función', () => {
    expect(sql).toMatch(/IF NEW\.tipo = 'recibido' THEN/);
    expect(sql).toMatch(/ELSIF NEW\.tipo = 'devuelto' THEN/);
  });

  it('devuelto inserta con cantidad_recibida=0 y cantidad_devuelta=NEW.cantidad', () => {
    const bloqueDevuelto = sql.match(/ELSIF NEW\.tipo = 'devuelto' THEN([\s\S]*?)END IF;/)?.[1] ?? '';
    expect(bloqueDevuelto).toMatch(/VALUES \(NEW\.id, NEW\.producto_base_id, NEW\.fecha, 0, NEW\.cantidad\)/);
  });

  it('sigue siendo SECURITY DEFINER', () => {
    expect(sql).toMatch(/SECURITY DEFINER/);
  });
});
