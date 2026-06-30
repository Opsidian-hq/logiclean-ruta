-- Incremento: campo de orden de ruta por vendedor
-- Permite al vendedor arrastrar y reordenar los clientes "por visitar" del día.
-- NULL = sin orden asignado (se muestra al final, ordenado por nombre).
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS orden_ruta INTEGER;
