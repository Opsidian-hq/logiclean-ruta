-- ============================================================
-- Logiclean Ruta — Migración 015: Abono de saldo vendedor↔negocio
--
-- Cierra el gap: saldo_vendedor_cierre de corte_vendedor (H-20) no tenía
-- forma de saldarse fuera del siguiente corte, ni un lugar visible fuera
-- del wizard. Este ledger permite al vendedor abonar contra el saldo
-- vigente (el del último corte confirmado) sin violar append-only de
-- corte/corte_vendedor: no se reescribe nada, se suma un movimiento más.
-- Espíritu: igual que COBRO salda VENTA sin modificarla.
-- ============================================================

CREATE TABLE IF NOT EXISTS abono_saldo_vendedor (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corte_id    UUID NOT NULL REFERENCES corte(id),
  vendedor_id UUID NOT NULL REFERENCES vendedor(id),
  direccion   TEXT NOT NULL CHECK (direccion IN ('vendedor_a_negocio','negocio_a_vendedor')),
  monto       DECIMAL(12,2) NOT NULL CHECK (monto > 0),
  forma_pago  TEXT NOT NULL CHECK (forma_pago IN ('efectivo','transferencia')),
  fecha       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  nota        TEXT
);

CREATE INDEX IF NOT EXISTS idx_abono_saldo_vendedor_corte    ON abono_saldo_vendedor(corte_id);
CREATE INDEX IF NOT EXISTS idx_abono_saldo_vendedor_vendedor ON abono_saldo_vendedor(vendedor_id);

ALTER TABLE abono_saldo_vendedor ENABLE ROW LEVEL SECURITY;

-- El vendedor ve/registra sus propios abonos; el gerente ve/registra todos.
CREATE POLICY abono_saldo_vendedor_select ON abono_saldo_vendedor
  FOR SELECT USING (vendedor_id = auth.uid() OR es_gerente());

CREATE POLICY abono_saldo_vendedor_insert ON abono_saldo_vendedor
  FOR INSERT WITH CHECK (vendedor_id = auth.uid() OR es_gerente());

-- Append-only — sin UPDATE/DELETE, igual que corte/corte_vendedor/liquidacion_movimiento.

GRANT SELECT, INSERT ON abono_saldo_vendedor TO authenticated;
