-- ============================================================
-- Logiclean Ruta — Reset de base de datos para nuevo ejercicio
-- operativo en producción (2026-07-14)
--
-- Vacía toda la operación transaccional acumulada, conservando:
--   • auth.users / vendedor (usuarios)
--   • producto_base / presentacion (catálogo)
--
-- Un solo TRUNCATE cubre las 20 tablas operativas: todas las FKs
-- entre ellas quedan dentro del mismo statement, así que no hace
-- falta CASCADE (las únicas referencias hacia fuera del conjunto
-- apuntan a vendedor/producto_base/presentacion, que se conservan).
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================

TRUNCATE TABLE
  linea_venta, cobro, pedido_pendiente, venta, visita, cliente,
  gasto, corte_vendedor, liquidacion_movimiento, corte,
  suministro_la_moderna, movimiento_la_moderna,
  envasado_linea, envasado,
  carga_linea, carga_vehiculo,
  devolucion_linea, devolucion_bodega,
  inventario_vehiculo, inventario_bodega_base, inventario_bodega_presentacion;

-- Verificación sugerida tras ejecutar:
--   SELECT count(*) FROM vendedor;      -- sin cambios
--   SELECT count(*) FROM producto_base; -- sin cambios
--   SELECT count(*) FROM presentacion;  -- sin cambios
--   (las 20 tablas truncadas deben regresar 0 filas)
