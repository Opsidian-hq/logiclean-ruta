-- ============================================================
-- Logiclean Ruta — Reinicio de operación en producción (2026-07-03)
--
-- Borra clientes, historial de ventas y gastos para que el vendedor
-- arranque con la app limpia. NO toca inventario del vehículo ni
-- catálogo de productos (producto_base, presentacion) — quedan
-- exactamente como están. Tampoco toca vendedor ni
-- suministro_la_moderna (historial de abastecimiento del proveedor,
-- no es venta/cliente/gasto).
--
-- Alcance del borrado (físico, no baja lógica):
--   cobro, linea_venta, pedido_pendiente, visita, venta, cliente,
--   gasto, corte.
--
-- corte se incluye porque es un snapshot derivado de ventas/gastos
-- (efectivo/transferencias entregadas por periodo); dejarlo vivo
-- referenciando ventas ya borradas dejaría el histórico inconsistente.
--
-- cliente NO tiene política RLS de DELETE (baja lógica por diseño —
-- ver 001_schema.sql / 002_rls.sql) y corte está documentada como
-- inmutable. Este script debe ejecutarse completo en el SQL Editor
-- de Supabase (conexión con rol postgres, que ignora RLS), igual que
-- 2026-06-25_reemplazo_catalogo.sql.
--
-- IMPORTANTE — Es irreversible. Antes de correrlo, exporta un respaldo
-- (Supabase Dashboard → Table Editor → Export CSV, o pg_dump) de las
-- tablas cliente, venta, linea_venta, cobro, gasto, corte,
-- pedido_pendiente y visita si necesitas conservar el histórico
-- para contabilidad o referencia.
--
-- Orden de borrado: de hijos a padres, respetando FKs (no hay
-- ON DELETE CASCADE declarado en el esquema).
-- ============================================================

BEGIN;

-- 1) Cobros (dependen de venta)
DELETE FROM cobro;

-- 2) Líneas de venta (dependen de venta)
DELETE FROM linea_venta;

-- 3) Pedidos pendientes (dependen de cliente y presentacion)
DELETE FROM pedido_pendiente;

-- 4) Visitas (dependen de cliente)
DELETE FROM visita;

-- 5) Ventas (dependen de cliente)
DELETE FROM venta;

-- 6) Clientes (ya sin referencias pendientes)
DELETE FROM cliente;

-- 7) Gastos (independientes de cliente/venta)
DELETE FROM gasto;

-- 8) Cortes de caja (snapshot derivado de ventas/gastos)
DELETE FROM corte;

COMMIT;

-- Verificación sugerida tras ejecutar (todas deben dar 0):
--   SELECT count(*) FROM cobro;
--   SELECT count(*) FROM linea_venta;
--   SELECT count(*) FROM pedido_pendiente;
--   SELECT count(*) FROM visita;
--   SELECT count(*) FROM venta;
--   SELECT count(*) FROM cliente;
--   SELECT count(*) FROM gasto;
--   SELECT count(*) FROM corte;
--
-- Estas tablas NO se tocan (deben conservar su conteo actual):
--   SELECT count(*) FROM inventario_vehiculo;
--   SELECT count(*) FROM producto_base WHERE activo;
--   SELECT count(*) FROM presentacion  WHERE activo;
--   SELECT count(*) FROM vendedor;
--   SELECT count(*) FROM suministro_la_moderna;
