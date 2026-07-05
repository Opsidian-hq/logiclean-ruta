-- ============================================================
-- Logiclean Ruta — Migración 010: Envasado en litros (H-17, simplificación)
--
-- El gerente ya no captura "origen" (bidón nuevo / granel), ni el residuo
-- estimado, ni el consumo de granel: solo captura qué presentaciones
-- salieron. `envasado.litros_envasados` (calculado client-side como
-- Σ cantidad × factor_conversion — para presentaciones de químicos,
-- factor_conversion ya ES el contenido en litros de la presentación, ver
-- supabase/seed/catalog.sql) es ahora el único dato de entrada.
--
-- Para poder descontar esos litros de la materia prima (bidones sellados +
-- granel abierto) se agrega `producto_base.litros_por_bidon`: cuántos
-- litros trae un bidón sellado completo de ese producto. El trigger
-- `aplicar_envasado()` usa ese dato para decidir cuánto de lo envasado salió
-- de bidones sellados vs. de granel ya abierto.
--
-- Excepción deliberada a ADR-0007: el resto de los contadores de bodega se
-- actualizan con un fold conmutativo (`col = col + delta`), para que dos
-- eventos concurrentes offline converjan sin importar el orden de llegada.
-- La descomposición litros→(bidones, granel) de abajo NO es lineal
-- (floor(a+b) ≠ floor(a)+floor(b)), así que no puede expresarse como un
-- delta puro. Esto es seguro de todos modos porque ningún cliente calcula
-- ni empuja este valor: el 100% de la aritmética ocurre server-side, dentro
-- de este único trigger AFTER INSERT, usando SELECT ... FOR UPDATE para
-- serializar envasados concurrentes del mismo producto_base_id (el segundo
-- espera el lock y lee el estado ya actualizado por el primero).
-- ============================================================

-- ------------------------------------------------------------
-- PRODUCTO_BASE: litros por bidón sellado
-- ------------------------------------------------------------

ALTER TABLE producto_base ADD COLUMN IF NOT EXISTS litros_por_bidon DECIMAL(12,4);

-- Backfill: todo bidón existente se asume de 20 L (tamaño estándar del
-- catálogo actual — cada químico en bidón ya tiene una presentación de 20 L
-- con factor_conversion=20, ver supabase/seed/catalog.sql). 'docena' queda
-- en NULL, no aplica.
UPDATE producto_base
  SET litros_por_bidon = 20
  WHERE unidad_compra = 'bidon' AND litros_por_bidon IS NULL;

ALTER TABLE producto_base DROP CONSTRAINT IF EXISTS producto_base_litros_por_bidon_check;
ALTER TABLE producto_base ADD CONSTRAINT producto_base_litros_por_bidon_check
  CHECK (litros_por_bidon IS NULL OR litros_por_bidon > 0);

-- ------------------------------------------------------------
-- ENVASADO: origen/residuo/consumo → litros_envasados
-- ------------------------------------------------------------

ALTER TABLE envasado ADD COLUMN IF NOT EXISTS litros_envasados DECIMAL(12,4) NOT NULL DEFAULT 0;
ALTER TABLE envasado ALTER COLUMN litros_envasados DROP DEFAULT;

ALTER TABLE envasado DROP CONSTRAINT IF EXISTS envasado_origen_check;
ALTER TABLE envasado DROP COLUMN IF EXISTS origen;
ALTER TABLE envasado DROP COLUMN IF EXISTS litros_consumidos_granel;
ALTER TABLE envasado DROP COLUMN IF EXISTS litros_residuo_estimado;

-- bidones_abiertos se conserva (ADR-0009, lib/corte.ts la usa para la
-- identidad de control recibido−devuelto−bidones_abiertos≈0). Cambia quién
-- la llena: ya no la teclea el gerente, la calcula aplicar_envasado() más
-- abajo y la re-escribe sobre la fila justo después del INSERT.
COMMENT ON COLUMN envasado.bidones_abiertos IS
  'Calculado por aplicar_envasado() (ya no lo captura el gerente): cuántos '
  'bidones sellados se tuvieron que abrir para cubrir litros_envasados. '
  'Alimenta la identidad de control de ADR-0009 (lib/corte.ts).';

-- ------------------------------------------------------------
-- Trigger de aplicación — reescrito para litros
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION aplicar_envasado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_litros_por_bidon DECIMAL;
  v_bidones_actual    DECIMAL;
  v_granel_actual     DECIMAL;
  v_total_disponible  DECIMAL;
  v_resultado         DECIMAL;
  v_bidones_nuevo     DECIMAL;
  v_granel_nuevo      DECIMAL;
BEGIN
  SELECT litros_por_bidon INTO v_litros_por_bidon
  FROM producto_base WHERE id = NEW.producto_base_id;

  IF v_litros_por_bidon IS NULL OR v_litros_por_bidon <= 0 THEN
    RAISE EXCEPTION 'producto_base % no tiene litros_por_bidon configurado', NEW.producto_base_id;
  END IF;

  -- Asegura que exista la fila de contador antes del lock (defensivo: en
  -- operación normal ya existe por movimiento_la_moderna, pero no debe
  -- fallar si un envasado llega antes de cualquier recepción registrada).
  INSERT INTO inventario_bodega_base (producto_base_id, bidones_disponibles, litros_granel_estimado)
  VALUES (NEW.producto_base_id, 0, 0)
  ON CONFLICT (producto_base_id) DO NOTHING;

  SELECT bidones_disponibles, litros_granel_estimado
    INTO v_bidones_actual, v_granel_actual
    FROM inventario_bodega_base
    WHERE producto_base_id = NEW.producto_base_id
    FOR UPDATE;

  v_total_disponible := v_bidones_actual * v_litros_por_bidon + v_granel_actual;
  v_resultado        := v_total_disponible - NEW.litros_envasados;

  -- Descompone el resultado en bidones sellados + residuo a granel. Puede
  -- quedar negativo: sobreventa permitida a propósito (ver cabecera de
  -- 007_bodega_esquema.sql — un negativo es señal de alerta, no un error).
  v_bidones_nuevo := floor(v_resultado / v_litros_por_bidon);
  v_granel_nuevo  := v_resultado - v_bidones_nuevo * v_litros_por_bidon;

  UPDATE inventario_bodega_base
    SET bidones_disponibles    = v_bidones_nuevo,
        litros_granel_estimado = v_granel_nuevo
    WHERE producto_base_id = NEW.producto_base_id;

  -- Repuja hacia el propio evento cuántos bidones se "abrieron" (para la
  -- identidad de control, ADR-0009). No re-dispara este trigger: está
  -- atado solo a AFTER INSERT, no a AFTER UPDATE.
  UPDATE envasado
    SET bidones_abiertos = GREATEST(v_bidones_actual - v_bidones_nuevo, 0)
    WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_envasado_aplicar
  AFTER INSERT ON envasado
  FOR EACH ROW EXECUTE FUNCTION aplicar_envasado();
