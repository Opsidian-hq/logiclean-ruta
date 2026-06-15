-- ============================================================
-- Logiclean Ruta — Migración 002: Row Level Security (RLS)
--
-- Identidad: el rol se guarda en
--   auth.users.raw_user_meta_data->>'rol'
--   valores posibles: 'vendedor' | 'gerente'
--
-- Cada política lleva comentario con el caso de prueba que cubre (T4).
-- ============================================================

-- ------------------------------------------------------------
-- Función helper: es_gerente()
-- Evita repetir la expresión JWT en cada política.
-- SECURITY DEFINER para lectura segura del claim.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION es_gerente()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'rol') = 'gerente'
$$;

-- ============================================================
-- Habilitar RLS en todas las tablas
-- ============================================================
ALTER TABLE vendedor              ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente               ENABLE ROW LEVEL SECURITY;
ALTER TABLE visita                ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_base         ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentacion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE linea_venta           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobro                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_pendiente      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_vehiculo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE suministro_la_moderna ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasto                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE corte                 ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VENDEDOR
-- Test T4-VENDEDOR-001: vendedor solo ve su propia fila
-- Test T4-VENDEDOR-002: gerente ve todas las filas
-- ============================================================

-- Test T4-VENDEDOR-001: vendedor solo ve su propia fila
CREATE POLICY vendedor_self_select ON vendedor
  FOR SELECT USING (id = auth.uid() OR es_gerente());

-- Test T4-VENDEDOR-002: gerente puede modificar vendedores
CREATE POLICY vendedor_gerente_insert ON vendedor
  FOR INSERT WITH CHECK (es_gerente());

CREATE POLICY vendedor_gerente_update ON vendedor
  FOR UPDATE USING (es_gerente());

CREATE POLICY vendedor_gerente_delete ON vendedor
  FOR DELETE USING (es_gerente());

-- ============================================================
-- CLIENTE
-- Test T4-CLIENTE-001: vendedor solo ve sus clientes
-- Test T4-CLIENTE-002: gerente ve todos los clientes
-- ============================================================

-- Test T4-CLIENTE-001: vendedor solo ve sus clientes
CREATE POLICY cliente_vendedor_select ON cliente
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

-- Test T4-CLIENTE-002: gerente puede insertar/actualizar clientes
CREATE POLICY cliente_gerente_insert ON cliente
  FOR INSERT WITH CHECK (es_gerente() OR vendedor_id = auth.uid());

CREATE POLICY cliente_vendedor_update ON cliente
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- Baja lógica — no se permite DELETE físico
-- (no se crea política DELETE → operación bloqueada por RLS)

-- ============================================================
-- VISITA
-- Test T4-VISITA-001: vendedor solo ve sus visitas
-- Test T4-VISITA-002: gerente ve todas las visitas
-- ============================================================

-- Test T4-VISITA-001: vendedor solo ve sus visitas
CREATE POLICY visita_vendedor_select ON visita
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY visita_vendedor_insert ON visita
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY visita_vendedor_update ON visita
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- ============================================================
-- PRODUCTO_BASE
-- Test T4-PRODUCTO-001: todos pueden SELECT
-- Test T4-PRODUCTO-002: solo gerente puede INSERT/UPDATE/DELETE
-- ============================================================

-- Test T4-PRODUCTO-001: todos los usuarios autenticados pueden SELECT
CREATE POLICY producto_base_all_select ON producto_base
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Test T4-PRODUCTO-002: solo gerente puede modificar catálogo
CREATE POLICY producto_base_gerente_insert ON producto_base
  FOR INSERT WITH CHECK (es_gerente());

CREATE POLICY producto_base_gerente_update ON producto_base
  FOR UPDATE USING (es_gerente());

CREATE POLICY producto_base_gerente_delete ON producto_base
  FOR DELETE USING (es_gerente());

-- ============================================================
-- PRESENTACION
-- Test T4-PRESENTACION-001: todos pueden SELECT
-- Test T4-PRESENTACION-002: solo gerente puede INSERT/UPDATE/DELETE
-- ============================================================

-- Test T4-PRESENTACION-001: todos los usuarios autenticados pueden SELECT
CREATE POLICY presentacion_all_select ON presentacion
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Test T4-PRESENTACION-002: solo gerente puede modificar presentaciones
CREATE POLICY presentacion_gerente_insert ON presentacion
  FOR INSERT WITH CHECK (es_gerente());

CREATE POLICY presentacion_gerente_update ON presentacion
  FOR UPDATE USING (es_gerente());

CREATE POLICY presentacion_gerente_delete ON presentacion
  FOR DELETE USING (es_gerente());

-- ============================================================
-- VENTA
-- Test T4-VENTA-001: vendedor solo ve sus ventas
-- Test T4-VENTA-002: gerente ve todas las ventas
-- ============================================================

-- Test T4-VENTA-001: vendedor solo ve sus ventas
CREATE POLICY venta_vendedor_select ON venta
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY venta_vendedor_insert ON venta
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY venta_vendedor_update ON venta
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- ============================================================
-- LINEA_VENTA
-- Test T4-LINEA-001: vendedor solo ve líneas de sus ventas
-- Test T4-LINEA-002: gerente ve todas las líneas
-- ============================================================

-- Test T4-LINEA-001: vendedor solo ve líneas de sus ventas (via JOIN con venta)
CREATE POLICY linea_venta_vendedor_select ON linea_venta
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venta v
      WHERE v.id = linea_venta.venta_id
        AND (v.vendedor_id = auth.uid() OR es_gerente())
    )
  );

CREATE POLICY linea_venta_vendedor_insert ON linea_venta
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM venta v
      WHERE v.id = linea_venta.venta_id
        AND (v.vendedor_id = auth.uid() OR es_gerente())
    )
  );

-- ============================================================
-- COBRO
-- Test T4-COBRO-001: vendedor solo ve cobros de sus ventas
-- Test T4-COBRO-002: gerente ve todos los cobros
-- ============================================================

-- Test T4-COBRO-001: vendedor solo ve cobros de sus ventas (via JOIN)
CREATE POLICY cobro_vendedor_select ON cobro
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venta v
      WHERE v.id = cobro.venta_id
        AND (v.vendedor_id = auth.uid() OR es_gerente())
    )
  );

CREATE POLICY cobro_vendedor_insert ON cobro
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM venta v
      WHERE v.id = cobro.venta_id
        AND (v.vendedor_id = auth.uid() OR es_gerente())
    )
  );

-- ============================================================
-- PEDIDO_PENDIENTE
-- Test T4-PEDIDO-001: vendedor solo ve sus pedidos pendientes
-- Test T4-PEDIDO-002: gerente ve todos los pedidos
-- ============================================================

-- Test T4-PEDIDO-001: vendedor solo ve sus pedidos pendientes
CREATE POLICY pedido_pendiente_vendedor_select ON pedido_pendiente
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY pedido_pendiente_vendedor_insert ON pedido_pendiente
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY pedido_pendiente_vendedor_update ON pedido_pendiente
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- ============================================================
-- INVENTARIO_VEHICULO
-- Test T4-INVENTARIO-001: vendedor solo ve su propio inventario
-- Test T4-INVENTARIO-002: gerente ve todo el inventario
-- ============================================================

-- Test T4-INVENTARIO-001: vendedor solo ve su propio inventario de vehículo
CREATE POLICY inventario_vehiculo_vendedor_select ON inventario_vehiculo
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY inventario_vehiculo_vendedor_insert ON inventario_vehiculo
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY inventario_vehiculo_vendedor_update ON inventario_vehiculo
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- ============================================================
-- SUMINISTRO_LA_MODERNA
-- Test T4-SUMINISTRO-001: todos pueden SELECT
-- Test T4-SUMINISTRO-002: solo gerente puede INSERT/UPDATE
-- ============================================================

-- Test T4-SUMINISTRO-001: todos los usuarios autenticados pueden SELECT suministros
CREATE POLICY suministro_all_select ON suministro_la_moderna
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Test T4-SUMINISTRO-002: solo gerente puede registrar suministros
CREATE POLICY suministro_gerente_insert ON suministro_la_moderna
  FOR INSERT WITH CHECK (es_gerente());

CREATE POLICY suministro_gerente_update ON suministro_la_moderna
  FOR UPDATE USING (es_gerente());

-- ============================================================
-- GASTO
-- Test T4-GASTO-001: vendedor solo ve sus gastos de ruta
-- Test T4-GASTO-002: gerente ve todos los gastos
-- ============================================================

-- Test T4-GASTO-001: vendedor solo ve sus propios gastos (o backoffice sin vendedor)
CREATE POLICY gasto_vendedor_select ON gasto
  FOR SELECT USING (
    (vendedor_id = auth.uid()) OR
    (vendedor_id IS NULL AND es_gerente()) OR
    es_gerente()
  );

CREATE POLICY gasto_vendedor_insert ON gasto
  FOR INSERT WITH CHECK (
    (vendedor_id = auth.uid()) OR
    (vendedor_id IS NULL AND es_gerente()) OR
    es_gerente()
  );

CREATE POLICY gasto_vendedor_update ON gasto
  FOR UPDATE USING (vendedor_id = auth.uid() OR es_gerente());

-- ============================================================
-- CORTE
-- Test T4-CORTE-001: vendedor solo ve sus propios cortes
-- Test T4-CORTE-002: gerente ve todos los cortes
-- ============================================================

-- Test T4-CORTE-001: vendedor solo ve sus propios cortes
CREATE POLICY corte_vendedor_select ON corte
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY corte_vendedor_insert ON corte
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

-- Cortes son inmutables una vez generados (no UPDATE ni DELETE)
