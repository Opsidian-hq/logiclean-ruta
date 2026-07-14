-- ============================================================
-- Logiclean Ruta — Migración 014: periodo_inicio nullable en corte
--
-- Bug: el primer corte tras un reset (sin corte previo confirmado)
-- no tiene periodo_inicio real — `ultimoPeriodoFin()` devuelve ''
-- (src/lib/corteData.ts) para representar "sin corte previo", pero
-- esa cadena vacía se escribía tal cual en esta columna DATE NOT NULL,
-- y Postgres la rechaza ("invalid input syntax for type date").
-- El insert de `corte` fallaba (400) y en cascada `corte_vendedor` /
-- `liquidacion_movimiento` fallaban por FK a un corte_id inexistente
-- (409), dejando el corte atorado en la cola de sync.
--
-- Fix: permitir NULL, que es el valor semánticamente correcto para
-- "primer corte / sin corte previo" (mismo concepto que
-- AperturaCorte.corte === null en src/lib/corteReparto.ts).
-- ============================================================

ALTER TABLE corte ALTER COLUMN periodo_inicio DROP NOT NULL;
