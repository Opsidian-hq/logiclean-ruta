-- ============================================================
-- Logiclean Ruta — Migración 009: devolución de sellados alimenta el
-- rollup de suministro (Inc 6.5, ADR-0009/ADR-0010)
--
-- M-1 (ADR-0010): los bidones sellados no abiertos se devuelven a La
-- Moderna cada semana. Hasta 6.2, solo movimiento_la_moderna tipo='recibido'
-- alimentaba suministro_la_moderna (tipo='devuelto' se dejó fuera a
-- propósito, ver 008_suministro_rollup.sql, hasta que el corte estuviera
-- listo para usarlo). Con la identidad de control de ADR-0009
-- (recibido − devuelto = bidones abiertos), devuelto ya es necesario.
--
-- Se REEMPLAZA la función (CREATE OR REPLACE, mismo nombre) — el trigger
-- de 008 ya está enlazado a ella, no hace falta recrear el trigger. Sigue
-- siendo AFTER INSERT (idempotente por UUID, T11) e inserta 1:1 por evento
-- (mismo id), igual que antes.
-- ============================================================

CREATE OR REPLACE FUNCTION aplicar_movimiento_la_moderna_a_suministro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tipo = 'recibido' THEN
    INSERT INTO suministro_la_moderna (id, producto_base_id, fecha, cantidad_recibida, cantidad_devuelta)
    VALUES (NEW.id, NEW.producto_base_id, NEW.fecha, NEW.cantidad, 0);
  ELSIF NEW.tipo = 'devuelto' THEN
    INSERT INTO suministro_la_moderna (id, producto_base_id, fecha, cantidad_recibida, cantidad_devuelta)
    VALUES (NEW.id, NEW.producto_base_id, NEW.fecha, 0, NEW.cantidad);
  END IF;

  RETURN NEW;
END;
$$;
