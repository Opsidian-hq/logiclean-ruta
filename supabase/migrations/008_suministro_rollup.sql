-- ============================================================
-- Logiclean Ruta — Migración 008: Recepción → rollup de suministro (Inc 6.2)
--
-- ADR-0006: la recepción a bodega es la fuente única del suministro con La
-- Moderna. `suministro_la_moderna` deja de capturarse a mano (retirado de
-- /admin/negocio) y pasa a ser un rollup alimentado por los eventos
-- `movimiento_la_moderna`.
--
-- Alcance de 6.2: solo tipo='recibido' (la pantalla de recepción del
-- gerente). tipo='devuelto' (devolución semanal de sellados, M-1/ADR-0010)
-- se conecta en 6.5 junto con la reescritura del corte — no se adelanta aquí
-- (regla de cascada: cada rebanada cubre exactamente lo que su handoff pide).
--
-- Patrón: igual que los triggers de 007 — AFTER INSERT (nunca OR UPDATE),
-- SECURITY DEFINER. Cada `movimiento_la_moderna` reafirma una fila 1:1 en
-- `suministro_la_moderna` (mismo id que el evento): `adeudoLaModerna()` ya
-- suma cantidad_recibida/cantidad_devuelta a través de todas las filas del
-- periodo (src/lib/suministro.ts), así que no hace falta un contador
-- acumulado por producto — un INSERT simple por evento es suficiente y,
-- por ser AFTER INSERT sobre un id único, ya es idempotente (T11).
-- ============================================================

CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna_a_suministro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tipo = 'recibido' THEN
    INSERT INTO suministro_la_moderna (id, producto_base_id, fecha, cantidad_recibida, cantidad_devuelta)
    VALUES (NEW.id, NEW.producto_base_id, NEW.fecha, NEW.cantidad, 0);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_movimiento_la_moderna_suministro
  AFTER INSERT ON movimiento_la_moderna
  FOR EACH ROW EXECUTE FUNCTION aplicar_movimiento_la_moderna_a_suministro();
