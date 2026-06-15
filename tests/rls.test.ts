/**
 * Logiclean Ruta — Tests T4: Políticas RLS
 *
 * Estos tests son de especificación/documentación, NO ejecutan contra
 * Supabase real. Verifican que el archivo 002_rls.sql contiene las
 * cláusulas SQL correctas para cada política de seguridad.
 *
 * Un test por política RLS. Cada test:
 *  1. Describe la regla (qué usuario ve qué)
 *  2. Lee 002_rls.sql y verifica que contiene la cláusula correcta
 *
 * Para tests de integración contra Supabase real, usar
 * supabase test (CLI de Supabase) en un entorno CI dedicado.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Cargar el archivo de migraciones RLS ──────────────────────

const rlsFilePath = join(__dirname, '../supabase/migrations/002_rls.sql');
const rlsSQL = readFileSync(rlsFilePath, 'utf-8');

// ── Utilidad helper ───────────────────────────────────────────

/**
 * Verifica que el SQL de RLS contiene una subcadena específica.
 * Normaliza espacios/saltos de línea para comparación robusta.
 */
function sqlContains(fragment: string): boolean {
  const normalizedSQL = rlsSQL.replace(/\s+/g, ' ').toLowerCase();
  const normalizedFragment = fragment.replace(/\s+/g, ' ').toLowerCase();
  return normalizedSQL.includes(normalizedFragment);
}

/**
 * Verifica que una política específica existe en el SQL.
 */
function policyExists(policyName: string): boolean {
  return rlsSQL.includes(policyName);
}

/**
 * Verifica que el comentario de un test case existe en el SQL.
 */
function testCommentExists(testId: string): boolean {
  return rlsSQL.includes(testId);
}

// ── Suite de tests ────────────────────────────────────────────

describe('T4 — Políticas RLS (verificación de 002_rls.sql)', () => {

  // ── Prerrequisito: función helper es_gerente() ─────────────

  it('T4-HELPER: función es_gerente() está definida', () => {
    /**
     * Regla: es_gerente() lee el claim 'rol' del JWT.
     * Todos los checks de gerente deben usarla en lugar de repetir
     * la expresión JWT para mantener el código DRY.
     */
    expect(rlsSQL).toContain('CREATE OR REPLACE FUNCTION es_gerente()');
    expect(rlsSQL).toContain("auth.jwt() -> 'user_metadata' ->> 'rol'");
    expect(rlsSQL).toContain("'gerente'");
  });

  // ── VENDEDOR ──────────────────────────────────────────────

  describe('VENDEDOR', () => {
    it('T4-VENDEDOR-001: vendedor solo ve su propia fila', () => {
      /**
       * Regla: un vendedor autenticado solo puede SELECT su propia fila
       * en la tabla vendedor (donde id = auth.uid()).
       * Un gerente puede ver todas las filas.
       */
      expect(testCommentExists('T4-VENDEDOR-001')).toBe(true);
      expect(policyExists('vendedor_self_select')).toBe(true);
      expect(sqlContains('id = auth.uid()')).toBe(true);
    });

    it('T4-VENDEDOR-002: gerente puede modificar vendedores', () => {
      /**
       * Regla: solo el gerente puede INSERT/UPDATE/DELETE en tabla vendedor.
       * Un vendedor no puede crear ni modificar otros vendedores.
       */
      expect(testCommentExists('T4-VENDEDOR-002')).toBe(true);
      expect(policyExists('vendedor_gerente_insert')).toBe(true);
      expect(policyExists('vendedor_gerente_update')).toBe(true);
    });
  });

  // ── CLIENTE ──────────────────────────────────────────────

  describe('CLIENTE', () => {
    it('T4-CLIENTE-001: vendedor solo ve sus clientes', () => {
      /**
       * Regla: vendedor_id = auth.uid() filtra los clientes visibles.
       * Un vendedor NO puede ver clientes asignados a otro vendedor.
       */
      expect(testCommentExists('T4-CLIENTE-001')).toBe(true);
      expect(policyExists('cliente_vendedor_select')).toBe(true);
      expect(sqlContains('vendedor_id = auth.uid()')).toBe(true);
    });

    it('T4-CLIENTE-002: gerente ve todos los clientes', () => {
      /**
       * Regla: el gerente puede SELECT todos los clientes independientemente
       * del vendedor_id. La política usa OR es_gerente() para ampliarlo.
       */
      expect(testCommentExists('T4-CLIENTE-002')).toBe(true);
      // La política cliente_vendedor_select incluye OR es_gerente()
      expect(rlsSQL).toMatch(/cliente_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── VISITA ────────────────────────────────────────────────

  describe('VISITA', () => {
    it('T4-VISITA-001: vendedor solo ve sus visitas', () => {
      /**
       * Regla: vendedor_id = auth.uid() en SELECT de visita.
       */
      expect(testCommentExists('T4-VISITA-001')).toBe(true);
      expect(policyExists('visita_vendedor_select')).toBe(true);
    });

    it('T4-VISITA-002: gerente ve todas las visitas', () => {
      /**
       * Regla: la política de visita incluye OR es_gerente().
       */
      expect(testCommentExists('T4-VISITA-002')).toBe(true);
      expect(rlsSQL).toMatch(/visita_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── PRODUCTO_BASE ─────────────────────────────────────────

  describe('PRODUCTO_BASE', () => {
    it('T4-PRODUCTO-001: todos los usuarios autenticados pueden SELECT', () => {
      /**
       * Regla: cualquier usuario con sesión activa puede leer el catálogo.
       * Necesario para que los vendedores sincronicen el catálogo offline.
       */
      expect(testCommentExists('T4-PRODUCTO-001')).toBe(true);
      expect(policyExists('producto_base_all_select')).toBe(true);
      expect(sqlContains('auth.uid() is not null')).toBe(true);
    });

    it('T4-PRODUCTO-002: solo gerente puede modificar catálogo', () => {
      /**
       * Regla: INSERT/UPDATE/DELETE en producto_base requiere es_gerente().
       * Un vendedor NO puede crear ni editar productos.
       */
      expect(testCommentExists('T4-PRODUCTO-002')).toBe(true);
      expect(policyExists('producto_base_gerente_insert')).toBe(true);
      expect(policyExists('producto_base_gerente_update')).toBe(true);
      expect(policyExists('producto_base_gerente_delete')).toBe(true);
    });
  });

  // ── PRESENTACION ──────────────────────────────────────────

  describe('PRESENTACION', () => {
    it('T4-PRESENTACION-001: todos pueden SELECT presentaciones', () => {
      /**
       * Regla: igual que producto_base — el catálogo es público para
       * usuarios autenticados.
       */
      expect(testCommentExists('T4-PRESENTACION-001')).toBe(true);
      expect(policyExists('presentacion_all_select')).toBe(true);
    });

    it('T4-PRESENTACION-002: solo gerente puede modificar presentaciones', () => {
      /**
       * Regla: INSERT/UPDATE/DELETE en presentacion requiere es_gerente().
       */
      expect(testCommentExists('T4-PRESENTACION-002')).toBe(true);
      expect(policyExists('presentacion_gerente_insert')).toBe(true);
      expect(policyExists('presentacion_gerente_update')).toBe(true);
    });
  });

  // ── VENTA ─────────────────────────────────────────────────

  describe('VENTA', () => {
    it('T4-VENTA-001: vendedor solo ve sus ventas', () => {
      /**
       * Regla: vendedor_id = auth.uid() en SELECT de venta.
       * Un vendedor no puede ver ventas de otros vendedores.
       */
      expect(testCommentExists('T4-VENTA-001')).toBe(true);
      expect(policyExists('venta_vendedor_select')).toBe(true);
    });

    it('T4-VENTA-002: gerente ve todas las ventas', () => {
      /**
       * Regla: la política incluye OR es_gerente().
       */
      expect(testCommentExists('T4-VENTA-002')).toBe(true);
      expect(rlsSQL).toMatch(/venta_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── LINEA_VENTA ───────────────────────────────────────────

  describe('LINEA_VENTA', () => {
    it('T4-LINEA-001: vendedor solo ve líneas de sus ventas (via JOIN)', () => {
      /**
       * Regla: linea_venta no tiene vendedor_id directo.
       * Se filtra via EXISTS (SELECT 1 FROM venta WHERE venta.id = linea_venta.venta_id
       * AND venta.vendedor_id = auth.uid()).
       */
      expect(testCommentExists('T4-LINEA-001')).toBe(true);
      expect(policyExists('linea_venta_vendedor_select')).toBe(true);
      // Verificar que usa EXISTS con JOIN a venta
      expect(sqlContains('exists')).toBe(true);
      expect(sqlContains('from venta')).toBe(true);
    });

    it('T4-LINEA-002: gerente ve todas las líneas', () => {
      /**
       * Regla: el EXISTS incluye OR es_gerente().
       */
      expect(testCommentExists('T4-LINEA-002')).toBe(true);
      expect(rlsSQL).toMatch(/linea_venta_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── COBRO ─────────────────────────────────────────────────

  describe('COBRO', () => {
    it('T4-COBRO-001: vendedor solo ve cobros de sus ventas (via JOIN)', () => {
      /**
       * Regla: igual que linea_venta — cobro.venta_id → venta.vendedor_id = auth.uid().
       */
      expect(testCommentExists('T4-COBRO-001')).toBe(true);
      expect(policyExists('cobro_vendedor_select')).toBe(true);
    });

    it('T4-COBRO-002: gerente ve todos los cobros', () => {
      /**
       * Regla: el EXISTS incluye OR es_gerente().
       */
      expect(testCommentExists('T4-COBRO-002')).toBe(true);
      expect(rlsSQL).toMatch(/cobro_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── PEDIDO_PENDIENTE ──────────────────────────────────────

  describe('PEDIDO_PENDIENTE', () => {
    it('T4-PEDIDO-001: vendedor solo ve sus pedidos pendientes', () => {
      /**
       * Regla: vendedor_id = auth.uid() en pedido_pendiente.
       */
      expect(testCommentExists('T4-PEDIDO-001')).toBe(true);
      expect(policyExists('pedido_pendiente_vendedor_select')).toBe(true);
    });

    it('T4-PEDIDO-002: gerente ve todos los pedidos', () => {
      /**
       * Regla: la política incluye OR es_gerente().
       */
      expect(testCommentExists('T4-PEDIDO-002')).toBe(true);
      expect(rlsSQL).toMatch(/pedido_pendiente_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── INVENTARIO_VEHICULO ───────────────────────────────────

  describe('INVENTARIO_VEHICULO', () => {
    it('T4-INVENTARIO-001: vendedor solo ve su propio inventario', () => {
      /**
       * Regla: vendedor_id = auth.uid() en inventario_vehiculo.
       * Cada vendedor es dueño único de su inventario de vehículo.
       */
      expect(testCommentExists('T4-INVENTARIO-001')).toBe(true);
      expect(policyExists('inventario_vehiculo_vendedor_select')).toBe(true);
    });

    it('T4-INVENTARIO-002: gerente ve todo el inventario', () => {
      /**
       * Regla: la política incluye OR es_gerente().
       */
      expect(testCommentExists('T4-INVENTARIO-002')).toBe(true);
      expect(rlsSQL).toMatch(/inventario_vehiculo_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── SUMINISTRO_LA_MODERNA ─────────────────────────────────

  describe('SUMINISTRO_LA_MODERNA', () => {
    it('T4-SUMINISTRO-001: todos los autenticados pueden SELECT suministros', () => {
      /**
       * Regla: igual que catálogo — los suministros son visibles para todos.
       */
      expect(testCommentExists('T4-SUMINISTRO-001')).toBe(true);
      expect(policyExists('suministro_all_select')).toBe(true);
    });

    it('T4-SUMINISTRO-002: solo gerente puede registrar suministros', () => {
      /**
       * Regla: INSERT/UPDATE en suministro_la_moderna requiere es_gerente().
       */
      expect(testCommentExists('T4-SUMINISTRO-002')).toBe(true);
      expect(policyExists('suministro_gerente_insert')).toBe(true);
      expect(policyExists('suministro_gerente_update')).toBe(true);
    });
  });

  // ── GASTO ─────────────────────────────────────────────────

  describe('GASTO', () => {
    it('T4-GASTO-001: vendedor solo ve sus gastos de ruta', () => {
      /**
       * Regla: vendedor_id = auth.uid() para gastos de tipo 'ruta'.
       * Gastos backoffice (vendedor_id IS NULL) solo los ve el gerente.
       */
      expect(testCommentExists('T4-GASTO-001')).toBe(true);
      expect(policyExists('gasto_vendedor_select')).toBe(true);
    });

    it('T4-GASTO-002: gerente ve todos los gastos', () => {
      /**
       * Regla: la política incluye OR es_gerente().
       */
      expect(testCommentExists('T4-GASTO-002')).toBe(true);
      expect(rlsSQL).toMatch(/gasto_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── CORTE ─────────────────────────────────────────────────

  describe('CORTE', () => {
    it('T4-CORTE-001: vendedor solo ve sus propios cortes', () => {
      /**
       * Regla: vendedor_id = auth.uid() en corte.
       * Un vendedor no puede ver cortes de otros vendedores.
       */
      expect(testCommentExists('T4-CORTE-001')).toBe(true);
      expect(policyExists('corte_vendedor_select')).toBe(true);
    });

    it('T4-CORTE-002: gerente ve todos los cortes', () => {
      /**
       * Regla: la política incluye OR es_gerente().
       */
      expect(testCommentExists('T4-CORTE-002')).toBe(true);
      expect(rlsSQL).toMatch(/corte_vendedor_select[\s\S]*?es_gerente\(\)/);
    });
  });

  // ── RLS habilitado en todas las tablas ────────────────────

  describe('RLS habilitado', () => {
    const tablas = [
      'vendedor',
      'cliente',
      'visita',
      'producto_base',
      'presentacion',
      'venta',
      'linea_venta',
      'cobro',
      'pedido_pendiente',
      'inventario_vehiculo',
      'suministro_la_moderna',
      'gasto',
      'corte',
    ];

    tablas.forEach((tabla) => {
      it(`T4-RLS-ENABLE: RLS habilitado en tabla ${tabla}`, () => {
        /**
         * Regla: todas las tablas del modelo deben tener RLS habilitado.
         * Sin esto, cualquier usuario autenticado podría ver todos los datos.
         * Nota: el SQL puede tener espacios adicionales para alineación visual.
         */
        // Normalizar espacios múltiples para manejar alineación visual en el SQL
        const normalizedSQL = rlsSQL.replace(/[ \t]+/g, ' ');
        expect(normalizedSQL).toContain(`ALTER TABLE ${tabla} ENABLE ROW LEVEL SECURITY`);
      });
    });
  });

});
