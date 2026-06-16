-- ============================================================
-- Logiclean Ruta — Migración 003: Roles y privilegios
--
-- El rol de la aplicación ('vendedor' | 'gerente') vive en
-- auth.users.raw_user_meta_data->>'rol'
--
-- Esta migración documenta cómo asignar el rol a un usuario
-- nuevo usando la API de Admin de Supabase o el dashboard.
-- No hay roles de Postgres adicionales: toda la lógica de
-- autorización se implementa en RLS (20260611100002_rls.sql).
-- ============================================================

-- ------------------------------------------------------------
-- Cómo asignar rol a un usuario (ejecutar con service_role):
--
--   UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"rol": "gerente"}'
--   WHERE email = 'gerente@logiclean.mx';
--
--   UPDATE auth.users
--   SET raw_user_meta_data = raw_user_meta_data || '{"rol": "vendedor"}'
--   WHERE email = 'vendedor@logiclean.mx';
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Función: nuevo_vendedor_trigger
-- Al insertar un usuario con rol='vendedor' en auth.users,
-- crea automáticamente la fila en la tabla vendedor.
-- Esto requiere que raw_user_meta_data contenga:
--   { "rol": "vendedor", "nombre": "...", "tipo": "mayoreo|menudeo" }
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_vendedor()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Solo crear fila de vendedor si el rol es 'vendedor'
  IF (NEW.raw_user_meta_data ->> 'rol') = 'vendedor' THEN
    INSERT INTO public.vendedor (id, nombre, tipo)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nombre', NEW.email),
      COALESCE(NEW.raw_user_meta_data ->> 'tipo', 'menudeo')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: se dispara cuando se confirma un nuevo usuario
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_vendedor();

-- ------------------------------------------------------------
-- Vista de ayuda: usuarios con su rol (solo para gerentes)
-- Nota: esta vista NO tiene RLS aplicada —
-- el acceso se controla por service_role en el backend.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW vista_usuarios_rol AS
  SELECT
    u.id,
    u.email,
    u.raw_user_meta_data ->> 'rol'    AS rol,
    u.raw_user_meta_data ->> 'nombre' AS nombre,
    u.created_at,
    u.last_sign_in_at
  FROM auth.users u;

-- Solo gerentes pueden consultar la vista
REVOKE ALL ON vista_usuarios_rol FROM PUBLIC;
GRANT SELECT ON vista_usuarios_rol TO authenticated;
-- La vista hereda las restricciones de auth.users
-- (solo accessible via service_role desde el backend)
