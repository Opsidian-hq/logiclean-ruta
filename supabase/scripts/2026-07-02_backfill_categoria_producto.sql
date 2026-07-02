-- ============================================================
-- Logiclean Ruta — Aplicación de la migración 006 en producción (2026-07-02)
--
-- Registro de lo que se corrió manualmente en el SQL Editor de Supabase
-- (proyecto de producción) para aplicar supabase/migrations/006_categoria_producto.sql.
--
-- Incidente durante la aplicación: el SQL Editor corre el bloque pegado como
-- una sola transacción. La migración 006, tal como está escrita, falla en el
-- `ALTER COLUMN categoria SET NOT NULL` porque en producción existen 2 filas
-- de producto_base ajenas al catálogo de supabase/seed/catalog.sql — fixtures
-- de prueba de las primeras pruebas del proyecto (ids con patrón
-- 'aaaaaaaa-000X-000X-000X-aaaaaaaaaaaa'), ambas con activo=false. Al fallar
-- el ALTER al final, se revirtió TODA la transacción, incluyendo el
-- `ADD COLUMN` inicial — la migración 006 quedó sin aplicar en absoluto.
--
-- Se resolvió corriendo los pasos por separado (para que un fallo al final no
-- revierta el trabajo previo) y rellenando esas 2 filas huérfanas con un
-- valor de categoría de relleno ('quimicos'): están inactivas y useCatalog.ts
-- solo carga producto_base activo=true, así que nunca se muestran en la app.
--
-- Este script documenta esa secuencia para trazabilidad; es idempotente
-- (WHERE categoria IS NULL) y seguro de re-ejecutar.
-- ============================================================

-- 1) Columna categoria (si por algún motivo no existe todavía)
ALTER TABLE producto_base ADD COLUMN IF NOT EXISTS categoria TEXT;

-- 2) Fixtures de prueba huérfanas (no pertenecen al catálogo vigente,
--    inactivas, nunca visibles en la app): valor de relleno para poder
--    aplicar el NOT NULL de la migración 006.
UPDATE producto_base
SET categoria = 'quimicos'
WHERE categoria IS NULL AND activo = false;

-- 3) Verificación (ambas deben dar 0 filas / el conteo esperado antes de
--    continuar con el resto de la migración 006 si aún no se aplicó):
--   SELECT count(*) FROM producto_base WHERE categoria IS NULL;  -- 0
--   SELECT count(*) FROM producto_base WHERE activo;             -- 35
