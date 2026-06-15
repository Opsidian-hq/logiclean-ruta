-- ============================================================
-- Logiclean Ruta — Seed: Catálogo de ejemplo
--
-- Datos representativos para desarrollo y pruebas.
-- Vendedores comentados: requieren usuarios reales en auth.users.
-- UUIDs fijos para reproducibilidad en tests.
-- ============================================================

-- ------------------------------------------------------------
-- Vendedores de ejemplo (COMENTADOS — requieren auth.users reales)
-- Para insertar en producción, primero crear los usuarios via
-- Supabase Auth y luego ejecutar este seed con sus UUIDs reales.
-- ------------------------------------------------------------
-- INSERT INTO vendedor (id, nombre, tipo) VALUES
--   ('11111111-1111-1111-1111-111111111111', 'Carlos Mendoza', 'mayoreo'),
--   ('22222222-2222-2222-2222-222222222222', 'Laura Ruiz',    'menudeo');

-- ------------------------------------------------------------
-- Producto 1: Multiusos concentrado (bidón)
-- ------------------------------------------------------------
INSERT INTO producto_base (id, nombre, unidad_compra, precio_preferencial, activo)
VALUES (
  'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
  'Multiusos concentrado',
  'bidon',
  380.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Presentación 1L
INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo)
VALUES (
  'bbbbbbbb-0001-0001-0001-bbbbbbbbbbbb',
  'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
  'Multiusos 1 L',
  'litro',
  1.0,
  45.00,
  65.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Presentación 3.7L (galón)
INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo)
VALUES (
  'bbbbbbbb-0001-0002-0001-bbbbbbbbbbbb',
  'aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa',
  'Multiusos 3.7 L',
  'litro',
  3.7,
  140.00,
  195.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Producto 2: Desengrasante industrial (bidón)
-- ------------------------------------------------------------
INSERT INTO producto_base (id, nombre, unidad_compra, precio_preferencial, activo)
VALUES (
  'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
  'Desengrasante industrial',
  'bidon',
  420.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Presentación 1L
INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo)
VALUES (
  'bbbbbbbb-0002-0001-0002-bbbbbbbbbbbb',
  'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
  'Desengrasante 1 L',
  'litro',
  1.0,
  55.00,
  75.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Presentación 3.7L (galón)
INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo)
VALUES (
  'bbbbbbbb-0002-0002-0002-bbbbbbbbbbbb',
  'aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa',
  'Desengrasante 3.7 L',
  'litro',
  3.7,
  165.00,
  220.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Producto 3: Escoba standard (docena)
-- ------------------------------------------------------------
INSERT INTO producto_base (id, nombre, unidad_compra, precio_preferencial, activo)
VALUES (
  'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
  'Escoba standard',
  'docena',
  600.00,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Presentación pieza (factor_conversion=12 → 1 docena = 12 piezas)
INSERT INTO presentacion (id, producto_base_id, nombre, unidad_venta, factor_conversion, precio_mayoreo, precio_menudeo, activo)
VALUES (
  'bbbbbbbb-0003-0001-0003-bbbbbbbbbbbb',
  'aaaaaaaa-0003-0003-0003-aaaaaaaaaaaa',
  'Escoba pieza',
  'pieza',
  12.0,
  38.00,
  55.00,
  true
)
ON CONFLICT (id) DO NOTHING;
