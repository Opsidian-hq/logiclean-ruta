-- ============================================================
-- Logiclean Ruta — Migración 001: Esquema base
-- Convenciones:
--   • PKs: uuid, DEFAULT gen_random_uuid()  (NO autoincrementales)
--   • Baja lógica: activo = false  (nunca DELETE en catálogo ni clientes)
--   • VENDEDOR.id = auth.users.id  (FK a auth.users)
-- ============================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- VENDEDOR
-- Un usuario de Supabase Auth puede ser vendedor o gerente.
-- El rol vive en auth.users.raw_user_meta_data->>'rol'.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendedor (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('mayoreo','menudeo'))
);

-- ------------------------------------------------------------
-- CLIENTE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id           UUID NOT NULL REFERENCES vendedor(id),
  nombre                TEXT NOT NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('mayoreo','menudeo')),
  estado                TEXT NOT NULL CHECK (estado IN ('prospecto','activo')),
  ciclo_visita          INTEGER NOT NULL DEFAULT 1,
  dia_ruta              TEXT,
  fecha_proxima_visita  DATE,
  activo                BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- VISITA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visita (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES cliente(id),
  vendedor_id     UUID NOT NULL REFERENCES vendedor(id),
  fecha           DATE NOT NULL,
  numero_ciclo    INTEGER NOT NULL,
  nota            TEXT,
  siguiente_paso  TEXT,
  fecha_proxima   DATE
);

-- ------------------------------------------------------------
-- PRODUCTO_BASE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_base (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               TEXT NOT NULL,
  unidad_compra        TEXT NOT NULL CHECK (unidad_compra IN ('bidon','docena')),
  precio_preferencial  DECIMAL(12,2),
  activo               BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- PRESENTACION
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS presentacion (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_base_id    UUID NOT NULL REFERENCES producto_base(id),
  nombre              TEXT NOT NULL,
  unidad_venta        TEXT NOT NULL,
  factor_conversion   DECIMAL(12,4) NOT NULL,
  precio_mayoreo      DECIMAL(12,2) NOT NULL,
  precio_menudeo      DECIMAL(12,2) NOT NULL,
  activo              BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- VENTA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venta (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id       UUID NOT NULL REFERENCES vendedor(id),
  cliente_id        UUID NOT NULL REFERENCES cliente(id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  requiere_factura  BOOLEAN NOT NULL DEFAULT FALSE,
  total             DECIMAL(12,2) NOT NULL
);

-- ------------------------------------------------------------
-- LINEA_VENTA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS linea_venta (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id          UUID NOT NULL REFERENCES venta(id),
  presentacion_id   UUID NOT NULL REFERENCES presentacion(id),
  cantidad          DECIMAL(12,4) NOT NULL,
  precio_unitario   DECIMAL(12,2) NOT NULL
);

-- ------------------------------------------------------------
-- COBRO
-- crédito = venta sin cobro asociado
-- tipo: 'total' | 'parcial'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cobro (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id    UUID NOT NULL REFERENCES venta(id),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  monto       DECIMAL(12,2) NOT NULL,
  forma_pago  TEXT NOT NULL CHECK (forma_pago IN ('efectivo','transferencia')),
  tipo        TEXT NOT NULL CHECK (tipo IN ('total','parcial'))
);

-- ------------------------------------------------------------
-- PEDIDO_PENDIENTE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedido_pendiente (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID NOT NULL REFERENCES cliente(id),
  vendedor_id       UUID NOT NULL REFERENCES vendedor(id),
  presentacion_id   UUID NOT NULL REFERENCES presentacion(id),
  cantidad          DECIMAL(12,4) NOT NULL,
  fecha_compromiso  DATE,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
);

-- ------------------------------------------------------------
-- INVENTARIO_VEHICULO
-- cantidad = contador que se decrementa al vender
-- cada vendedor es dueño único de su dispositivo (sin colisión)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario_vehiculo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     UUID NOT NULL REFERENCES vendedor(id),
  presentacion_id UUID NOT NULL REFERENCES presentacion(id),
  cantidad        DECIMAL(12,4) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- SUMINISTRO_LA_MODERNA
-- Registro de recepción de producto desde proveedor
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suministro_la_moderna (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_base_id    UUID NOT NULL REFERENCES producto_base(id),
  fecha               DATE NOT NULL,
  cantidad_recibida   DECIMAL(12,4) NOT NULL,
  cantidad_devuelta   DECIMAL(12,4) NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- GASTO
-- vendedor_id nullable: backoffice no tiene vendedor asignado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gasto (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id   UUID REFERENCES vendedor(id),
  tipo          TEXT NOT NULL CHECK (tipo IN ('ruta','backoffice')),
  categoria     TEXT NOT NULL,
  fecha         DATE NOT NULL,
  monto         DECIMAL(12,2) NOT NULL,
  forma_pago    TEXT NOT NULL CHECK (forma_pago IN ('efectivo','transferencia')),
  descripcion   TEXT
);

-- ------------------------------------------------------------
-- CORTE
-- snapshot JSONB guarda totales del período para histórico inmutable
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS corte (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id                UUID NOT NULL REFERENCES vendedor(id),
  periodo_inicio             DATE NOT NULL,
  periodo_fin                DATE NOT NULL,
  fecha_generado             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  efectivo_entregado         DECIMAL(12,2) NOT NULL DEFAULT 0,
  transferencias_entregadas  DECIMAL(12,2) NOT NULL DEFAULT 0,
  snapshot                   JSONB NOT NULL DEFAULT '{}'
);
