/**
 * Logiclean Ruta — Tests Inc 7.2: Políticas RLS del corte por reparto
 *
 * Igual que rls.test.ts / bodega-rls.test.ts: pruebas de especificación/
 * documentación sobre 011_corte_reparto.sql, NO ejecutan contra Supabase
 * real. Verifican que la migración contiene las cláusulas SQL correctas
 * para cada política de seguridad y el GRANT correspondiente (lección
 * ADR-0004: RLS sin GRANT es "permission denied" antes de evaluar la
 * política).
 *
 * Para tests de integración contra Supabase real, usar `supabase test`
 * (CLI de Supabase) en un entorno CI dedicado.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const sqlFilePath = join(__dirname, '../supabase/migrations/011_corte_reparto.sql');
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

describe('T4 — Políticas RLS del corte por reparto (verificación de 011_corte_reparto.sql)', () => {
  describe('CORTE: reestructura de por-vendedor a de-negocio', () => {
    it('retira vendedor_id, efectivo_entregado y transferencias_entregadas', () => {
      expect(sqlContains('DROP COLUMN IF EXISTS vendedor_id')).toBe(true);
      expect(sqlContains('DROP COLUMN IF EXISTS efectivo_entregado')).toBe(true);
      expect(sqlContains('DROP COLUMN IF EXISTS transferencias_entregadas')).toBe(true);
    });

    it('retira las políticas viejas de por-vendedor antes del DROP COLUMN', () => {
      expect(sqlContains('DROP POLICY IF EXISTS corte_vendedor_select ON corte')).toBe(true);
      expect(sqlContains('DROP POLICY IF EXISTS corte_vendedor_insert ON corte')).toBe(true);
    });

    it('agrega las columnas de negocio del modelo delta v1.4', () => {
      for (const columna of [
        'estado', 'n_vendedores', 'ventas_periodo', 'adeudo_la_moderna',
        'backoffice_pendiente', 'obligaciones_total', 'pool_liquido',
        'v_remanente', 't_por_vendedor', 'saldo_moderna_apertura', 'saldo_moderna_cierre',
      ]) {
        expect(sqlContains(`ADD COLUMN ${columna}`)).toBe(true);
      }
    });

    it('T4-CORTE-NEGOCIO-001: cualquier autenticado puede ver el corte de negocio', () => {
      expect(testCommentExists('T4-CORTE-NEGOCIO-001')).toBe(true);
      expect(policyExists('corte_all_select')).toBe(true);
      expect(sql.match(/corte_all_select[\s\S]*?auth\.uid\(\) IS NOT NULL/)).toBeTruthy();
    });

    it('T4-CORTE-NEGOCIO-002: solo gerente genera el corte', () => {
      expect(testCommentExists('T4-CORTE-NEGOCIO-002')).toBe(true);
      expect(policyExists('corte_gerente_insert')).toBe(true);
      expect(sql.match(/corte_gerente_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });
  });

  describe('CORTE_VENDEDOR', () => {
    it('una línea por vendedor por corte (UNIQUE corte_id, vendedor_id)', () => {
      expect(sqlContains('UNIQUE (corte_id, vendedor_id)')).toBe(true);
    });

    it('T4-CORTE-VENDEDOR-001: cualquier autenticado puede ver las líneas del corte', () => {
      expect(testCommentExists('T4-CORTE-VENDEDOR-001')).toBe(true);
      expect(policyExists('corte_vendedor_all_select')).toBe(true);
    });

    it('T4-CORTE-VENDEDOR-002: solo gerente inserta líneas de corte', () => {
      expect(testCommentExists('T4-CORTE-VENDEDOR-002')).toBe(true);
      expect(policyExists('corte_vendedor_gerente_insert')).toBe(true);
      expect(sql.match(/corte_vendedor_gerente_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });
  });

  describe('LIQUIDACION_MOVIMIENTO', () => {
    it('CHECK: origen_vendedor_id es null si y solo si origen_tipo != vendedor', () => {
      expect(sqlContains("CHECK ((origen_tipo = 'vendedor')  = (origen_vendedor_id  IS NOT NULL))")).toBe(true);
    });

    it('CHECK: destino_vendedor_id es null salvo que destino_tipo = vendedor', () => {
      expect(sqlContains("CHECK ((destino_tipo = 'vendedor') = (destino_vendedor_id IS NOT NULL))")).toBe(true);
    });

    it('T4-LIQUIDACION-001: cualquier autenticado puede ver las instrucciones de liquidación', () => {
      expect(testCommentExists('T4-LIQUIDACION-001')).toBe(true);
      expect(policyExists('liquidacion_movimiento_all_select')).toBe(true);
    });

    it('T4-LIQUIDACION-002: solo gerente inserta instrucciones de liquidación', () => {
      expect(testCommentExists('T4-LIQUIDACION-002')).toBe(true);
      expect(policyExists('liquidacion_movimiento_gerente_insert')).toBe(true);
      expect(sql.match(/liquidacion_movimiento_gerente_insert[\s\S]*?es_gerente\(\)/)).toBeTruthy();
    });
  });

  describe('RLS habilitado en las tablas nuevas', () => {
    const tablas = ['corte_vendedor', 'liquidacion_movimiento'];

    tablas.forEach((tabla) => {
      it(`T4-RLS-ENABLE: RLS habilitado en tabla ${tabla}`, () => {
        const normalizedSQL = sql.replace(/[ \t]+/g, ' ');
        expect(normalizedSQL).toContain(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY`);
      });
    });
  });

  describe('GRANTs (lección ADR-0004)', () => {
    it('GRANT SELECT, INSERT en las tres tablas — sin UPDATE/DELETE (append-only)', () => {
      expect(sqlContains('GRANT SELECT, INSERT ON corte                  TO authenticated')).toBe(true);
      expect(sqlContains('GRANT SELECT, INSERT ON corte_vendedor         TO authenticated')).toBe(true);
      expect(sqlContains('GRANT SELECT, INSERT ON liquidacion_movimiento TO authenticated')).toBe(true);
    });
  });
});
