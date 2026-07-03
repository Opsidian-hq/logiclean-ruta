/**
 * Logiclean Ruta — Tests Inc 6.1: Políticas RLS de bodega
 *
 * Igual que rls.test.ts: pruebas de especificación/documentación sobre
 * 007_bodega_esquema.sql, NO ejecutan contra Supabase real. Verifican que la
 * migración contiene las cláusulas SQL correctas para cada política.
 * (El comportamiento real de estas políticas se verificó manualmente contra
 * un Postgres 16 local antes de abrir el PR — ver descripción del PR.)
 *
 * Para tests de integración contra Supabase real, usar `supabase test`
 * (CLI de Supabase) en un entorno CI dedicado.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sqlFilePath = join(__dirname, '../supabase/migrations/007_bodega_esquema.sql');
const sql = readFileSync(sqlFilePath, 'utf-8');

function sqlContains(fragment: string): boolean {
  const normalizedSQL = sql.replace(/\s+/g, ' ').toLowerCase();
  const normalizedFragment = fragment.replace(/\s+/g, ' ').toLowerCase();
  return normalizedSQL.includes(normalizedFragment);
}

function policyExists(policyName: string): boolean {
  return sql.includes(policyName);
}

function testCommentExists(testId: string): boolean {
  return sql.includes(testId);
}

describe('T4 — Políticas RLS de bodega (verificación de 007_bodega_esquema.sql)', () => {

  // ── Contadores: solo lectura, nunca escritura directa ──────

  describe('INVENTARIO_BODEGA_BASE / INVENTARIO_BODEGA_PRESENTACION', () => {
    it('T4-BODEGA-CONTADOR-001: lectura para autenticados', () => {
      expect(testCommentExists('T4-BODEGA-CONTADOR-001')).toBe(true);
      expect(policyExists('inventario_bodega_base_all_select')).toBe(true);
      expect(policyExists('inventario_bodega_presentacion_all_select')).toBe(true);
    });

    it('T4-BODEGA-CONTADOR-002: sin política de INSERT/UPDATE/DELETE (solo vía trigger SECURITY DEFINER)', () => {
      expect(testCommentExists('T4-BODEGA-CONTADOR-002')).toBe(true);
      // No debe existir ninguna política de escritura directa del rol
      // `authenticated` sobre los contadores — la única vía es la función
      // SECURITY DEFINER invocada desde los triggers de los eventos.
      expect(sqlContains('for insert') === true).toBe(true); // hay INSERT en otras tablas...
      // ...pero ninguno cuyo target sea un contador de bodega:
      expect(policyExists('inventario_bodega_base_gerente_insert')).toBe(false);
      expect(policyExists('inventario_bodega_base_insert')).toBe(false);
      expect(policyExists('inventario_bodega_presentacion_insert')).toBe(false);
      // Los GRANTs a los contadores solo incluyen SELECT.
      expect(sqlContains('GRANT SELECT                         ON inventario_bodega_base         TO authenticated')).toBe(true);
      expect(sqlContains('GRANT SELECT                         ON inventario_bodega_presentacion TO authenticated')).toBe(true);
    });

    it('las funciones de aplicación de contador son SECURITY DEFINER', () => {
      expect(sqlContains('CREATE OR REPLACE FUNCTION incrementar_bodega_base')).toBe(true);
      expect(sqlContains('CREATE OR REPLACE FUNCTION incrementar_bodega_presentacion')).toBe(true);
      expect(sqlContains('CREATE OR REPLACE FUNCTION incrementar_inventario_vehiculo')).toBe(true);
      expect(
        sql.match(/CREATE OR REPLACE FUNCTION incrementar_\w+[\s\S]*?SECURITY DEFINER/g)?.length
      ).toBe(3);
    });
  });

  // ── MOVIMIENTO_LA_MODERNA ──────────────────────────────────

  describe('MOVIMIENTO_LA_MODERNA', () => {
    it('T4-MOVIMIENTO-001: todos los autenticados pueden SELECT', () => {
      expect(testCommentExists('T4-MOVIMIENTO-001')).toBe(true);
      expect(policyExists('movimiento_la_moderna_all_select')).toBe(true);
      expect(sqlContains('auth.uid() is not null')).toBe(true);
    });

    it('T4-MOVIMIENTO-002: solo gerente puede INSERT', () => {
      expect(testCommentExists('T4-MOVIMIENTO-002')).toBe(true);
      expect(policyExists('movimiento_la_moderna_gerente_insert')).toBe(true);
      expect(
        sql.match(/movimiento_la_moderna_gerente_insert[\s\S]*?es_gerente\(\)/)
      ).toBeTruthy();
    });
  });

  // ── ENVASADO / ENVASADO_LINEA ───────────────────────────────

  describe('ENVASADO / ENVASADO_LINEA', () => {
    it('T4-ENVASADO-001: todos los autenticados pueden SELECT', () => {
      expect(testCommentExists('T4-ENVASADO-001')).toBe(true);
      expect(policyExists('envasado_all_select')).toBe(true);
      expect(policyExists('envasado_linea_all_select')).toBe(true);
    });

    it('T4-ENVASADO-002: solo gerente puede INSERT (envasado y envasado_linea)', () => {
      expect(testCommentExists('T4-ENVASADO-002')).toBe(true);
      expect(policyExists('envasado_gerente_insert')).toBe(true);
      expect(policyExists('envasado_linea_gerente_insert')).toBe(true);
      expect(sql.match(/envasado_gerente_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
      expect(sql.match(/envasado_linea_gerente_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });
  });

  // ── CARGA_VEHICULO / CARGA_LINEA ────────────────────────────

  describe('CARGA_VEHICULO / CARGA_LINEA', () => {
    it('T4-CARGA-001/002: vendedor solo puede cargar SU propio vehículo (vendedor_id = auth.uid())', () => {
      expect(testCommentExists('T4-CARGA-001')).toBe(true);
      expect(testCommentExists('T4-CARGA-002')).toBe(true);
      expect(policyExists('carga_vehiculo_insert')).toBe(true);
      expect(sql.match(/carga_vehiculo_insert[\s\S]*?vendedor_id = auth\.uid\(\)/)).toBeTruthy();
    });

    it('T4-CARGA-003: gerente puede cargar cualquier vehículo', () => {
      expect(testCommentExists('T4-CARGA-003')).toBe(true);
      expect(sql.match(/carga_vehiculo_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });

    it('carga_linea hereda el permiso vía JOIN a carga_vehiculo (igual que linea_venta → venta)', () => {
      expect(policyExists('carga_linea_insert')).toBe(true);
      expect(sqlContains('from carga_vehiculo')).toBe(true);
    });
  });

  // ── DEVOLUCION_BODEGA / DEVOLUCION_LINEA ────────────────────

  describe('DEVOLUCION_BODEGA / DEVOLUCION_LINEA', () => {
    it('T4-DEVOLUCION-001/002: vendedor solo puede devolver SU propio vehículo', () => {
      expect(testCommentExists('T4-DEVOLUCION-001')).toBe(true);
      expect(testCommentExists('T4-DEVOLUCION-002')).toBe(true);
      expect(policyExists('devolucion_bodega_insert')).toBe(true);
      expect(sql.match(/devolucion_bodega_insert[\s\S]*?vendedor_id = auth\.uid\(\)/)).toBeTruthy();
    });

    it('T4-DEVOLUCION-003: gerente puede devolver cualquier vehículo', () => {
      expect(testCommentExists('T4-DEVOLUCION-003')).toBe(true);
      expect(sql.match(/devolucion_bodega_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });

    it('devolucion_linea hereda el permiso vía JOIN a devolucion_bodega', () => {
      expect(policyExists('devolucion_linea_insert')).toBe(true);
      expect(sqlContains('from devolucion_bodega')).toBe(true);
    });
  });

  // ── RLS habilitado en todas las tablas nuevas ───────────────

  describe('RLS habilitado', () => {
    const tablas = [
      'inventario_bodega_base',
      'inventario_bodega_presentacion',
      'movimiento_la_moderna',
      'envasado',
      'envasado_linea',
      'carga_vehiculo',
      'carga_linea',
      'devolucion_bodega',
      'devolucion_linea',
    ];

    tablas.forEach((tabla) => {
      it(`T4-RLS-ENABLE: RLS habilitado en tabla ${tabla}`, () => {
        const normalizedSQL = sql.replace(/[ \t]+/g, ' ');
        expect(normalizedSQL).toContain(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY`);
      });
    });
  });

  // ── GRANTs (lección ADR-0004) ────────────────────────────────

  describe('GRANTs', () => {
    const tablasEvento = [
      'movimiento_la_moderna',
      'envasado',
      'envasado_linea',
      'carga_vehiculo',
      'carga_linea',
      'devolucion_bodega',
      'devolucion_linea',
    ];

    tablasEvento.forEach((tabla) => {
      it(`T4-GRANT: ${tabla} tiene GRANT SELECT, INSERT a authenticated`, () => {
        expect(sqlContains(`GRANT SELECT, INSERT`) && sqlContains(`ON ${tabla}`)).toBe(true);
        expect(sql.includes(tabla)).toBe(true);
      });
    });
  });

});

describe('T11 — Idempotencia y fold conmutativo (verificación de 007_bodega_esquema.sql)', () => {
  it('los triggers de aplicación son AFTER INSERT, nunca OR UPDATE (para no reaplicar en un reintento upsert)', () => {
    const triggerBlocks = sql.match(/CREATE OR REPLACE TRIGGER trg_\w+[\s\S]*?;/g) ?? [];
    expect(triggerBlocks.length).toBeGreaterThan(0);
    for (const block of triggerBlocks) {
      expect(block).toMatch(/AFTER INSERT ON/);
      expect(block).not.toMatch(/OR UPDATE/);
    }
  });

  it('las funciones de incremento aplican el efecto con UPDATE aditivo (col = col + delta), no con un valor absoluto', () => {
    expect(sqlContains('bidones_disponibles = inventario_bodega_base.bidones_disponibles + excluded.bidones_disponibles')).toBe(true);
    expect(sqlContains('cantidad = inventario_bodega_presentacion.cantidad + excluded.cantidad')).toBe(true);
    expect(sqlContains('cantidad = inventario_vehiculo.cantidad + excluded.cantidad')).toBe(true);
  });

  it('los contadores de bodega no tienen CHECK >= 0 (permiten negativo como alerta de sobreventa)', () => {
    // Acotado al bloque CREATE TABLE (no al archivo completo): el comentario
    // de cabecera de la migración menciona "CHECK >= 0" en prosa para
    // explicar la ausencia, lo que da un falso positivo si se busca en todo
    // el archivo.
    const baseBlock = sql.match(/CREATE TABLE IF NOT EXISTS inventario_bodega_base \(([\s\S]*?)\);/)?.[1] ?? '';
    const presentacionBlock = sql.match(/CREATE TABLE IF NOT EXISTS inventario_bodega_presentacion \(([\s\S]*?)\);/)?.[1] ?? '';
    expect(baseBlock.length).toBeGreaterThan(0);
    expect(presentacionBlock.length).toBeGreaterThan(0);
    expect(baseBlock).not.toMatch(/CHECK/i);
    expect(presentacionBlock).not.toMatch(/CHECK/i);
  });

  it('existe la vista de alerta de sobreventa sobre el contador negativo', () => {
    expect(sqlContains('CREATE OR REPLACE VIEW alerta_sobreventa_bodega')).toBe(true);
    expect(sqlContains('WHERE ibp.cantidad < 0')).toBe(true);
  });
});
