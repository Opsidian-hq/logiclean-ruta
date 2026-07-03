-- ============================================================
-- Logiclean Ruta — Migración 007: Inventario de bodega (Inc 6.1)
--
-- Cimiento del subsistema de bodega: tablas de contador y de evento,
-- triggers de aplicación, RLS + GRANTs, índices por FK.
-- Sin pantallas (van en 6.2+) — ver handoff-inc6.1-bodega-esquema-sync.md.
--
-- Patrón de contador (ADR-0007, extiende inventario_vehiculo de 001):
--   • Los eventos son append-only; su INSERT dispara un trigger que
--     aplica el efecto (+= / -=) al contador correspondiente.
--   • El trigger es AFTER INSERT (nunca OR UPDATE): un reintento de sync
--     llega como upsert(id) → ON CONFLICT DO UPDATE, que NO dispara
--     AFTER INSERT. La aplicación queda exactamente-una-vez por UUID de
--     cliente (T11, idempotencia) sin lógica adicional.
--   • El contador se actualiza con `col = col + delta` (fold conmutativo):
--     el orden de llegada de dos eventos concurrentes no altera el
--     resultado final — es la suma de sus efectos.
--   • No hay CHECK >= 0 en los contadores de bodega ni en
--     inventario_vehiculo: un negativo es la señal de sobreventa/alerta
--     de reconciliación (modelo-datos-inc6 §Nota de operación — la carga
--     es online, así que no se espera en operación normal; el dato queda
--     preparado para la alerta que se construye después).
--   • Las funciones de aplicación son SECURITY DEFINER: escriben el
--     contador aunque el rol `authenticated` no tenga privilegio directo
--     de escritura sobre él (ver RLS de contadores más abajo).
-- ============================================================

-- ------------------------------------------------------------
-- Tablas — contadores materializados
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventario_bodega_base (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_base_id        UUID NOT NULL UNIQUE REFERENCES producto_base(id),
  bidones_disponibles     DECIMAL(12,4) NOT NULL DEFAULT 0,
  litros_granel_estimado  DECIMAL(12,4) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inventario_bodega_presentacion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id UUID NOT NULL UNIQUE REFERENCES presentacion(id),
  cantidad        DECIMAL(12,4) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- Tablas — eventos append-only + líneas
-- responsable_id referencia auth.users (no vendedor): un gerente puede
-- ser responsable y no tiene fila en `vendedor` (handle_new_vendedor
-- solo inserta ahí para rol='vendedor', 003_roles.sql).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS movimiento_la_moderna (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_base_id  UUID NOT NULL REFERENCES producto_base(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('recibido','devuelto')),
  fecha             DATE NOT NULL,
  cantidad          DECIMAL(12,4) NOT NULL,
  responsable_id    UUID NOT NULL REFERENCES auth.users(id),
  nota              TEXT
);

CREATE TABLE IF NOT EXISTS envasado (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_base_id          UUID NOT NULL REFERENCES producto_base(id),
  fecha                     DATE NOT NULL,
  origen                    TEXT NOT NULL CHECK (origen IN ('bidon_nuevo','granel')),
  bidones_abiertos          DECIMAL(12,4) NOT NULL DEFAULT 0,
  litros_consumidos_granel  DECIMAL(12,4) NOT NULL DEFAULT 0,
  litros_residuo_estimado   DECIMAL(12,4) NOT NULL DEFAULT 0,
  responsable_id            UUID NOT NULL REFERENCES auth.users(id),
  nota                      TEXT
);

CREATE TABLE IF NOT EXISTS envasado_linea (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envasado_id     UUID NOT NULL REFERENCES envasado(id),
  presentacion_id UUID NOT NULL REFERENCES presentacion(id),
  cantidad        DECIMAL(12,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS carga_vehiculo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID NOT NULL REFERENCES vendedor(id),
  fecha           DATE NOT NULL,
  responsable_id  UUID NOT NULL REFERENCES auth.users(id),
  nota            TEXT
);

CREATE TABLE IF NOT EXISTS carga_linea (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id        UUID NOT NULL REFERENCES carga_vehiculo(id),
  presentacion_id UUID NOT NULL REFERENCES presentacion(id),
  cantidad        DECIMAL(12,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS devolucion_bodega (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID NOT NULL REFERENCES vendedor(id),
  fecha           DATE NOT NULL,
  responsable_id  UUID NOT NULL REFERENCES auth.users(id),
  nota            TEXT
);

CREATE TABLE IF NOT EXISTS devolucion_linea (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id   UUID NOT NULL REFERENCES devolucion_bodega(id),
  presentacion_id UUID NOT NULL REFERENCES presentacion(id),
  cantidad        DECIMAL(12,4) NOT NULL
);

-- ------------------------------------------------------------
-- Índices por FK
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_movimiento_la_moderna_producto  ON movimiento_la_moderna(producto_base_id);
CREATE INDEX IF NOT EXISTS idx_envasado_producto               ON envasado(producto_base_id);
CREATE INDEX IF NOT EXISTS idx_envasado_linea_envasado         ON envasado_linea(envasado_id);
CREATE INDEX IF NOT EXISTS idx_envasado_linea_presentacion     ON envasado_linea(presentacion_id);
CREATE INDEX IF NOT EXISTS idx_carga_vehiculo_vendedor         ON carga_vehiculo(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_carga_linea_carga               ON carga_linea(carga_id);
CREATE INDEX IF NOT EXISTS idx_carga_linea_presentacion        ON carga_linea(presentacion_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_bodega_vendedor      ON devolucion_bodega(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_linea_devolucion     ON devolucion_linea(devolucion_id);
CREATE INDEX IF NOT EXISTS idx_devolucion_linea_presentacion   ON devolucion_linea(presentacion_id);

-- ------------------------------------------------------------
-- inventario_vehiculo: unicidad por (vendedor_id, presentacion_id)
--
-- Requerida para que carga/devolución puedan aplicar su efecto con un
-- UPSERT aditivo (ON CONFLICT ... DO UPDATE SET cantidad = cantidad + delta),
-- igual que los contadores de bodega. La escritura de venta (Inc 0,
-- src/lib/inventario.ts) ya localiza la fila antes de escribir, así que no
-- debería haber duplicados; se consolidan de forma defensiva antes de
-- imponer la restricción, por si el arranque original dejó alguno.
-- ------------------------------------------------------------

-- MIN/MAX no está definido para UUID en Postgres (sin orden natural);
-- se usa array_agg ORDER BY para elegir una fila determinística a conservar.
WITH dup AS (
  SELECT vendedor_id, presentacion_id,
         (array_agg(id ORDER BY id))[1] AS keep_id,
         SUM(cantidad) AS total
  FROM inventario_vehiculo
  GROUP BY vendedor_id, presentacion_id
  HAVING COUNT(*) > 1
)
UPDATE inventario_vehiculo iv SET cantidad = dup.total
FROM dup WHERE iv.id = dup.keep_id;

WITH dup AS (
  SELECT vendedor_id, presentacion_id,
         (array_agg(id ORDER BY id))[1] AS keep_id
  FROM inventario_vehiculo
  GROUP BY vendedor_id, presentacion_id
  HAVING COUNT(*) > 1
)
DELETE FROM inventario_vehiculo iv
USING dup
WHERE iv.vendedor_id = dup.vendedor_id
  AND iv.presentacion_id = dup.presentacion_id
  AND iv.id <> dup.keep_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventario_vehiculo_vendedor_presentacion_key'
  ) THEN
    ALTER TABLE inventario_vehiculo
      ADD CONSTRAINT inventario_vehiculo_vendedor_presentacion_key
      UNIQUE (vendedor_id, presentacion_id);
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Funciones de aplicación (fold conmutativo, SECURITY DEFINER)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION incrementar_bodega_base(
  p_producto_base_id UUID,
  p_delta_bidones DECIMAL,
  p_delta_litros_granel DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO inventario_bodega_base (producto_base_id, bidones_disponibles, litros_granel_estimado)
  VALUES (p_producto_base_id, p_delta_bidones, p_delta_litros_granel)
  ON CONFLICT (producto_base_id) DO UPDATE
    SET bidones_disponibles    = inventario_bodega_base.bidones_disponibles    + EXCLUDED.bidones_disponibles,
        litros_granel_estimado = inventario_bodega_base.litros_granel_estimado + EXCLUDED.litros_granel_estimado;
END;
$$;

CREATE OR REPLACE FUNCTION incrementar_bodega_presentacion(
  p_presentacion_id UUID,
  p_delta DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO inventario_bodega_presentacion (presentacion_id, cantidad)
  VALUES (p_presentacion_id, p_delta)
  ON CONFLICT (presentacion_id) DO UPDATE
    SET cantidad = inventario_bodega_presentacion.cantidad + EXCLUDED.cantidad;
END;
$$;

CREATE OR REPLACE FUNCTION incrementar_inventario_vehiculo(
  p_vendedor_id UUID,
  p_presentacion_id UUID,
  p_delta DECIMAL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO inventario_vehiculo (vendedor_id, presentacion_id, cantidad)
  VALUES (p_vendedor_id, p_presentacion_id, p_delta)
  ON CONFLICT (vendedor_id, presentacion_id) DO UPDATE
    SET cantidad = inventario_vehiculo.cantidad + EXCLUDED.cantidad;
END;
$$;

-- ------------------------------------------------------------
-- Triggers de aplicación
-- ------------------------------------------------------------

-- MOVIMIENTO_LA_MODERNA (recibido/devuelto)
-- Químicos (unidad_compra='bidon'): mueve bidones_disponibles.
-- Escobas/trapeadores/recogedores (unidad_compra='docena'): mueve la
-- presentación 'pieza' del producto, usando su factor_conversion como
-- equivalencia docena→pieza (hoy 12; dato, no constante mágica).
-- Productos 'docena' sin presentación 'pieza' (p. ej. papel_institucional,
-- que usa 'paquete') quedan fuera de la cadena de bodega — es lo esperado:
-- Inc 6 solo cubre químicos y escobas/trapeadores/recogedores (PRD §4).
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
  ELSIF v_unidad_compra = 'docena' THEN
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

CREATE OR REPLACE TRIGGER trg_movimiento_la_moderna_aplicar
  AFTER INSERT ON movimiento_la_moderna
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_la_moderna();

-- ENVASADO: mueve el bidón (bidon_nuevo) o el granel (granel) del producto base.
-- origen=granel NO toca bidones_disponibles (el bidón ya se contó al abrirse).
CREATE OR REPLACE FUNCTION aplicar_envasado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.origen = 'bidon_nuevo' THEN
    PERFORM incrementar_bodega_base(NEW.producto_base_id, -NEW.bidones_abiertos, NEW.litros_residuo_estimado);
  ELSIF NEW.origen = 'granel' THEN
    PERFORM incrementar_bodega_base(NEW.producto_base_id, 0, -NEW.litros_consumidos_granel);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_envasado_aplicar
  AFTER INSERT ON envasado
  FOR EACH ROW EXECUTE FUNCTION aplicar_envasado();

-- ENVASADO_LINEA: cada presentación que salió del envasado sube en bodega.
CREATE OR REPLACE FUNCTION aplicar_envasado_linea()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM incrementar_bodega_presentacion(NEW.presentacion_id, NEW.cantidad);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_envasado_linea_aplicar
  AFTER INSERT ON envasado_linea
  FOR EACH ROW EXECUTE FUNCTION aplicar_envasado_linea();

-- CARGA_LINEA: bodega baja, vehículo del vendedor de la carga sube.
CREATE OR REPLACE FUNCTION aplicar_carga_linea()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendedor_id UUID;
BEGIN
  SELECT vendedor_id INTO v_vendedor_id FROM carga_vehiculo WHERE id = NEW.carga_id;

  PERFORM incrementar_bodega_presentacion(NEW.presentacion_id, -NEW.cantidad);
  PERFORM incrementar_inventario_vehiculo(v_vendedor_id, NEW.presentacion_id, NEW.cantidad);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_carga_linea_aplicar
  AFTER INSERT ON carga_linea
  FOR EACH ROW EXECUTE FUNCTION aplicar_carga_linea();

-- DEVOLUCION_LINEA: vehículo del vendedor de la devolución baja, bodega sube.
CREATE OR REPLACE FUNCTION aplicar_devolucion_linea()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendedor_id UUID;
BEGIN
  SELECT vendedor_id INTO v_vendedor_id FROM devolucion_bodega WHERE id = NEW.devolucion_id;

  PERFORM incrementar_inventario_vehiculo(v_vendedor_id, NEW.presentacion_id, -NEW.cantidad);
  PERFORM incrementar_bodega_presentacion(NEW.presentacion_id, NEW.cantidad);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_devolucion_linea_aplicar
  AFTER INSERT ON devolucion_linea
  FOR EACH ROW EXECUTE FUNCTION aplicar_devolucion_linea();

-- ------------------------------------------------------------
-- Vista de alerta — sobreventa/reconciliación de bodega
-- Sin UI en 6.1 (ver README maestro §Fuera de alcance): solo el estado
-- de dato. Los contadores no tienen CHECK >= 0 a propósito.
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW alerta_sobreventa_bodega AS
  SELECT
    ibp.presentacion_id,
    p.nombre AS presentacion_nombre,
    ibp.cantidad
  FROM inventario_bodega_presentacion ibp
  JOIN presentacion p ON p.id = ibp.presentacion_id
  WHERE ibp.cantidad < 0;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE inventario_bodega_base         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_bodega_presentacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_la_moderna          ENABLE ROW LEVEL SECURITY;
ALTER TABLE envasado                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE envasado_linea                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE carga_vehiculo                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE carga_linea                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_bodega              ENABLE ROW LEVEL SECURITY;
ALTER TABLE devolucion_linea               ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INVENTARIO_BODEGA_BASE / INVENTARIO_BODEGA_PRESENTACION
-- Test T4-BODEGA-CONTADOR-001: lectura para autenticados
-- Test T4-BODEGA-CONTADOR-002: sin política de escritura directa —
--   solo las funciones SECURITY DEFINER (triggers) escriben el contador.
-- ============================================================

CREATE POLICY inventario_bodega_base_all_select ON inventario_bodega_base
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY inventario_bodega_presentacion_all_select ON inventario_bodega_presentacion
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ============================================================
-- MOVIMIENTO_LA_MODERNA
-- Test T4-MOVIMIENTO-001: todos los autenticados pueden SELECT
-- Test T4-MOVIMIENTO-002: solo gerente puede INSERT
-- ============================================================

CREATE POLICY movimiento_la_moderna_all_select ON movimiento_la_moderna
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY movimiento_la_moderna_gerente_insert ON movimiento_la_moderna
  FOR INSERT WITH CHECK (es_gerente());

-- ============================================================
-- ENVASADO / ENVASADO_LINEA
-- Test T4-ENVASADO-001: todos los autenticados pueden SELECT
-- Test T4-ENVASADO-002: solo gerente puede INSERT
-- ============================================================

CREATE POLICY envasado_all_select ON envasado
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY envasado_gerente_insert ON envasado
  FOR INSERT WITH CHECK (es_gerente());

CREATE POLICY envasado_linea_all_select ON envasado_linea
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY envasado_linea_gerente_insert ON envasado_linea
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM envasado e WHERE e.id = envasado_linea.envasado_id)
    AND es_gerente()
  );

-- ============================================================
-- CARGA_VEHICULO / CARGA_LINEA
-- Test T4-CARGA-001: vendedor puede iniciar carga para su propio vehículo
-- Test T4-CARGA-002: vendedor NO puede iniciar carga de otro vehículo
-- Test T4-CARGA-003: gerente puede iniciar carga de cualquier vehículo
-- ============================================================

CREATE POLICY carga_vehiculo_select ON carga_vehiculo
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY carga_vehiculo_insert ON carga_vehiculo
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY carga_linea_select ON carga_linea
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carga_vehiculo c
      WHERE c.id = carga_linea.carga_id
        AND (c.vendedor_id = auth.uid() OR es_gerente())
    )
  );

CREATE POLICY carga_linea_insert ON carga_linea
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carga_vehiculo c
      WHERE c.id = carga_linea.carga_id
        AND (c.vendedor_id = auth.uid() OR es_gerente())
    )
  );

-- ============================================================
-- DEVOLUCION_BODEGA / DEVOLUCION_LINEA
-- Test T4-DEVOLUCION-001: vendedor puede devolver su propio vehículo
-- Test T4-DEVOLUCION-002: vendedor NO puede devolver otro vehículo
-- Test T4-DEVOLUCION-003: gerente puede devolver cualquier vehículo
-- ============================================================

CREATE POLICY devolucion_bodega_select ON devolucion_bodega
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY devolucion_bodega_insert ON devolucion_bodega
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY devolucion_linea_select ON devolucion_linea
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devolucion_bodega d
      WHERE d.id = devolucion_linea.devolucion_id
        AND (d.vendedor_id = auth.uid() OR es_gerente())
    )
  );

CREATE POLICY devolucion_linea_insert ON devolucion_linea
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM devolucion_bodega d
      WHERE d.id = devolucion_linea.devolucion_id
        AND (d.vendedor_id = auth.uid() OR es_gerente())
    )
  );

-- ============================================================
-- GRANTs — lección ADR-0004: sin esto, "permission denied" antes de
-- evaluar cualquier política RLS, incluso para el gerente.
-- inventario_bodega_* no recibe INSERT/UPDATE/DELETE: la escritura del
-- contador es exclusiva de las funciones SECURITY DEFINER de arriba.
-- ============================================================

GRANT SELECT                         ON inventario_bodega_base         TO authenticated;
GRANT SELECT                         ON inventario_bodega_presentacion TO authenticated;
GRANT SELECT, INSERT                 ON movimiento_la_moderna          TO authenticated;
GRANT SELECT, INSERT                 ON envasado                       TO authenticated;
GRANT SELECT, INSERT                 ON envasado_linea                 TO authenticated;
GRANT SELECT, INSERT                 ON carga_vehiculo                 TO authenticated;
GRANT SELECT, INSERT                 ON carga_linea                    TO authenticated;
GRANT SELECT, INSERT                 ON devolucion_bodega              TO authenticated;
GRANT SELECT, INSERT                 ON devolucion_linea               TO authenticated;
GRANT SELECT                         ON alerta_sobreventa_bodega       TO authenticated;
