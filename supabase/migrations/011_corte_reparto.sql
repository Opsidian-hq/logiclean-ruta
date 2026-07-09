-- ============================================================
-- Logiclean Ruta — Migración 011: Corte por reparto (Inc 7.2, H-20)
--
-- Reestructura CORTE de por-vendedor a corte de negocio, y agrega
-- CORTE_VENDEDOR (línea por vendedor) + LIQUIDACION_MOVIMIENTO
-- (instrucciones de liquidación). Ver modelo-datos-v1_4-corte-reparto.md
-- (reglas 1-6) y ADR-0011 (posiciones netas + liquidación + arrastre).
--
-- Contexto seguro (verificado en prod 2026-07-09): `corte` está vacía
-- (0 filas) → reestructura sin migrar datos. `corte_vendedor` y
-- `liquidacion_movimiento` no existen → tablas nuevas. Ningún saldo de
-- arrastre se siembra: el primer corte lee apertura = 0 (ADR-0011).
--
-- Alcance de esta migración (cimiento, sin UI — 7.4 la consume):
--   • Solo agrega el esquema y su RLS/GRANT baseline (SELECT + INSERT).
--   • NO agrega una política de UPDATE para la transición
--     borrador→confirmado: esa transición es parte del flujo de
--     confirmación multi-paso (ADR-0011, "consecuencia estructural") que
--     construye la UI del stepper (7.4) junto con su propia validación.
--     Añadirla aquí, sin el flujo que la use, sería especular.
-- ============================================================

-- ------------------------------------------------------------
-- CORTE: retira columnas de por-vendedor, agrega columnas de negocio.
-- Las políticas viejas referencian `vendedor_id`: se retiran antes de
-- poder soltar la columna.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS corte_vendedor_select ON corte;
DROP POLICY IF EXISTS corte_vendedor_insert ON corte;

ALTER TABLE corte
  DROP COLUMN IF EXISTS vendedor_id,
  DROP COLUMN IF EXISTS efectivo_entregado,
  DROP COLUMN IF EXISTS transferencias_entregadas;

ALTER TABLE corte
  ADD COLUMN estado                 TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','confirmado')),
  ADD COLUMN n_vendedores           INT NOT NULL DEFAULT 0,
  ADD COLUMN ventas_periodo         DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN adeudo_la_moderna      DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN backoffice_pendiente   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN obligaciones_total     DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN pool_liquido           DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN v_remanente            DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN t_por_vendedor         DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN saldo_moderna_apertura DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN saldo_moderna_cierre   DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- CORTE_VENDEDOR — línea por vendedor de un corte de negocio.
-- UNIQUE(corte_id, vendedor_id): el ER es "una línea por vendedor"
-- (modelo-datos-v1_4-corte-reparto.md), no una relación de muchas filas.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS corte_vendedor (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id                 UUID NOT NULL REFERENCES corte(id),
  vendedor_id              UUID NOT NULL REFERENCES vendedor(id),
  efectivo_cobrado_neto    DECIMAL(12,2) NOT NULL DEFAULT 0,
  transfer_cobrado_neto    DECIMAL(12,2) NOT NULL DEFAULT 0,
  cxc_nueva                DECIMAL(12,2) NOT NULL DEFAULT 0,
  cobro_cxc_vieja          DECIMAL(12,2) NOT NULL DEFAULT 0,
  posicion_objetivo        DECIMAL(12,2) NOT NULL DEFAULT 0,
  efectivo_entregado       DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_vendedor_apertura  DECIMAL(12,2) NOT NULL DEFAULT 0,
  saldo_vendedor_cierre    DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE (corte_id, vendedor_id)
);

-- ------------------------------------------------------------
-- LIQUIDACION_MOVIMIENTO — instrucciones concretas de la pasada de
-- liquidación (Paso 5, ADR-0011). Los CHECK de nulidad de
-- origen/destino_vendedor_id materializan la regla del ER: "null si
-- origen=negocio" / "null salvo destino=vendedor".
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS liquidacion_movimiento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id              UUID NOT NULL REFERENCES corte(id),
  origen_tipo           TEXT NOT NULL CHECK (origen_tipo IN ('vendedor','negocio')),
  origen_vendedor_id    UUID REFERENCES vendedor(id),
  destino_tipo          TEXT NOT NULL CHECK (destino_tipo IN ('la_moderna','backoffice','vendedor','negocio')),
  destino_vendedor_id   UUID REFERENCES vendedor(id),
  monto                 DECIMAL(12,2) NOT NULL,
  forma_pago            TEXT NOT NULL CHECK (forma_pago IN ('efectivo','transferencia')),
  nota                  TEXT,
  CHECK ((origen_tipo = 'vendedor')  = (origen_vendedor_id  IS NOT NULL)),
  CHECK ((destino_tipo = 'vendedor') = (destino_vendedor_id IS NOT NULL))
);

-- ------------------------------------------------------------
-- Índices por FK
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_corte_vendedor_corte                    ON corte_vendedor(corte_id);
CREATE INDEX IF NOT EXISTS idx_corte_vendedor_vendedor                 ON corte_vendedor(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_liquidacion_movimiento_corte            ON liquidacion_movimiento(corte_id);
CREATE INDEX IF NOT EXISTS idx_liquidacion_movimiento_origen_vendedor  ON liquidacion_movimiento(origen_vendedor_id);
CREATE INDEX IF NOT EXISTS idx_liquidacion_movimiento_destino_vendedor ON liquidacion_movimiento(destino_vendedor_id);

-- ============================================================
-- RLS
-- CORTE ya tenía RLS habilitada (002_rls.sql); persiste tras el ALTER.
-- ============================================================

ALTER TABLE corte_vendedor        ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidacion_movimiento ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CORTE (de negocio) — reemplaza corte_vendedor_select/insert (por-vendedor).
-- Test T4-CORTE-NEGOCIO-001: cualquier autenticado puede ver el corte de negocio
-- Test T4-CORTE-NEGOCIO-002: solo gerente genera el corte
-- ============================================================

CREATE POLICY corte_all_select ON corte
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY corte_gerente_insert ON corte
  FOR INSERT WITH CHECK (es_gerente());

-- ============================================================
-- CORTE_VENDEDOR
-- Test T4-CORTE-VENDEDOR-001: cualquier autenticado puede ver las líneas del corte
-- Test T4-CORTE-VENDEDOR-002: solo gerente inserta líneas de corte
-- ============================================================

CREATE POLICY corte_vendedor_all_select ON corte_vendedor
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY corte_vendedor_gerente_insert ON corte_vendedor
  FOR INSERT WITH CHECK (es_gerente());

-- ============================================================
-- LIQUIDACION_MOVIMIENTO
-- Test T4-LIQUIDACION-001: cualquier autenticado puede ver las instrucciones de liquidación
-- Test T4-LIQUIDACION-002: solo gerente inserta instrucciones de liquidación
-- ============================================================

CREATE POLICY liquidacion_movimiento_all_select ON liquidacion_movimiento
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY liquidacion_movimiento_gerente_insert ON liquidacion_movimiento
  FOR INSERT WITH CHECK (es_gerente());

-- ============================================================
-- GRANTs — lección ADR-0004: sin esto, "permission denied" antes de
-- evaluar cualquier política RLS, incluso para el gerente. Solo
-- SELECT + INSERT: los tres son eventos append-only (sin UPDATE/DELETE),
-- igual que el resto del historial de cierre (corte, movimiento_la_moderna).
-- ============================================================

GRANT SELECT, INSERT ON corte                  TO authenticated;
GRANT SELECT, INSERT ON corte_vendedor         TO authenticated;
GRANT SELECT, INSERT ON liquidacion_movimiento TO authenticated;
