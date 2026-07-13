-- ============================================================
-- Logiclean Ruta — Migración 012: unidad_compra 'pieza'
--
-- Los 23 productos hoy en unidad_compra='docena' (8 escobas + 3 trapeadores
-- + 3 recogedores + 9 papel_institucional) se cuentan en PIEZAS, no en
-- docenas. 'docena' obligaba a dividir por su factor de conversión (12 para
-- escobas/trapeadores/recogedores, 1 para papel) para volver a la unidad de
-- compra, produciendo saldos fraccionarios sin sentido de negocio en el
-- corte semanal (p. ej. "Saldo 0.08000000000000002"). Esta migración agrega
-- 'pieza' como unidad de compra real: lo que el gerente cuenta físicamente
-- ES la unidad de compra, sin conversión. 'docena' se retira del catálogo
-- de valores (no queda ningún producto en esa unidad tras esta migración).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Constraint (paso 1/2): admite 'pieza' además de 'bidon'/'docena' para
-- poder migrar las filas sin violar el CHECK a mitad de camino.
-- ------------------------------------------------------------

ALTER TABLE producto_base DROP CONSTRAINT IF EXISTS producto_base_unidad_compra_check;
ALTER TABLE producto_base ADD CONSTRAINT producto_base_unidad_compra_check
  CHECK (unidad_compra IN ('bidon','docena','pieza'));

-- ------------------------------------------------------------
-- 2. 23 productos: 8 escobas + 3 trapeadores + 3 recogedores + 9 papel_institucional
-- ------------------------------------------------------------

UPDATE producto_base SET unidad_compra = 'pieza' WHERE unidad_compra = 'docena';

-- ------------------------------------------------------------
-- 3. Constraint (paso 2/2): ya no queda ningún producto en 'docena';
-- se retira del catálogo de valores permitido.
-- ------------------------------------------------------------

ALTER TABLE producto_base DROP CONSTRAINT IF EXISTS producto_base_unidad_compra_check;
ALTER TABLE producto_base ADD CONSTRAINT producto_base_unidad_compra_check
  CHECK (unidad_compra IN ('bidon','pieza'));

-- ------------------------------------------------------------
-- 4. Las 14 presentaciones 'pieza' de escobas/trapeadores/recogedores
-- tenían factor_conversion=12 (12 piezas por docena). Con
-- unidad_compra='pieza' ya no hay conversión que hacer: 1 presentación
-- 'pieza' = 1 unidad de compra. Se deja la fila (no se borra: presentacion
-- también es la unidad vendible/de inventario, la usan
-- carga_linea/devolucion_linea/envasado_linea, independiente de
-- unidad_compra) para que presentacionesAUnidadCompra() siga siendo una
-- llamada válida (identidad) sin tocar sus invocadores.
--
-- Las 9 presentaciones 'paquete' de papel_institucional ya estaban en
-- factor_conversion=1: sin cambio.
-- ------------------------------------------------------------

UPDATE presentacion p
  SET factor_conversion = 1
  FROM producto_base pb
  WHERE p.producto_base_id = pb.id
    AND pb.unidad_compra = 'pieza'
    AND p.unidad_venta = 'pieza'
    AND p.factor_conversion <> 1;

-- ------------------------------------------------------------
-- 5. Trigger de bodega (007_bodega_esquema.sql): agrega 'pieza' a la rama
-- que hoy solo cubre 'docena'. Se reemplaza la función (mismo nombre); el
-- trigger creado en 007 ya apunta a ella y no requiere recrearse.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_unidad_compra TEXT;
  v_presentacion_pieza UUID;
  v_factor DECIMAL;
  v_signo DECIMAL := CASE WHEN NEW.tipo = 'recibido' THEN 1 ELSE -1 END;
BEGIN
  SELECT unidad_compra INTO v_unidad_compra
  FROM producto_base WHERE id = NEW.producto_base_id;

  IF v_unidad_compra = 'bidon' THEN
    PERFORM incrementar_bodega_base(NEW.producto_base_id, v_signo * NEW.cantidad, 0);
  ELSIF v_unidad_compra = 'pieza' THEN
    SELECT id, factor_conversion INTO v_presentacion_pieza, v_factor
    FROM presentacion
    WHERE producto_base_id = NEW.producto_base_id AND unidad_venta = 'pieza'
    LIMIT 1;

    IF v_presentacion_pieza IS NOT NULL THEN
      PERFORM incrementar_bodega_presentacion(v_presentacion_pieza, v_signo * NEW.cantidad * v_factor);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 6. Backfill: 4 movimientos históricos (Escoba de abanico corta y
-- Trapeador microseda bastón largo 300 Gr) capturados bajo semántica de
-- fracción-de-docena antes de esta migración. Sin este ajuste quedarían
-- leídos como piezas sueltas (0.5 pieza, sin sentido) en vez de piezas
-- completas. No hay ningún corte confirmado todavía (tabla `corte` vacía),
-- así que no hay historial financiero cerrado en riesgo.
-- movimiento_la_moderna.id = suministro_la_moderna.id (rollup 1:1 por
-- evento, ver 008/009_suministro_rollup*.sql), así que se corrige ambas
-- tablas por el mismo id.
-- ------------------------------------------------------------

UPDATE movimiento_la_moderna SET cantidad = 6
  WHERE id IN ('4be499d0-3cfd-4a5d-b319-c068227810cf', 'fc0315fd-b1bb-4067-a89e-8c641db0e7c4'); -- recibido 0.5 -> 6 piezas

UPDATE movimiento_la_moderna SET cantidad = 5
  WHERE id IN ('99a9fbc5-d130-4afb-a925-557fc6345f26', 'be907c79-1953-4bb6-9c73-af91fbd0fb9d'); -- devuelto 0.42 -> 5 piezas

UPDATE suministro_la_moderna SET cantidad_recibida = 6
  WHERE id IN ('4be499d0-3cfd-4a5d-b319-c068227810cf', 'fc0315fd-b1bb-4067-a89e-8c641db0e7c4');

UPDATE suministro_la_moderna SET cantidad_devuelta = 5
  WHERE id IN ('99a9fbc5-d130-4afb-a925-557fc6345f26', 'be907c79-1953-4bb6-9c73-af91fbd0fb9d');
