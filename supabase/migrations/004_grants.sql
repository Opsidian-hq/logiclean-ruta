-- ============================================================
-- Logiclean Ruta — Migración 004: Privilegios de tabla
--
-- Por qué existe esta migración:
--   RLS (002) es la SEGUNDA reja. La PRIMERA son los privilegios de
--   tabla de Postgres. Sin un GRANT, el motor rechaza la consulta con
--   "permission denied for table ..." ANTES de evaluar cualquier política
--   RLS — incluso para el gerente. Las migraciones 001-003 crean tablas,
--   habilitan RLS y definen políticas, pero nunca otorgan privilegios al
--   rol `authenticated`, así que el catálogo y la administración quedan
--   inaccesibles aunque la RLS sea correcta.
--
-- Decisión de alcance:
--   • Se otorga SOLO a `authenticated`. NO a `anon`: el modelo offline-first
--     (ADR-0001) lee el catálogo con sesión válida y lo cachea en Dexie;
--     nunca se sirve del servidor sin login. La RLS de catálogo ya exige
--     auth.uid() IS NOT NULL (002_rls.sql).
--   • Se otorga SELECT/INSERT/UPDATE/DELETE de forma amplia y se deja que la
--     RLS haga el filtrado fino por fila y por rol. Donde no hay política
--     (p. ej. DELETE en cliente = baja lógica), la RLS sigue bloqueando aunque
--     el privilegio exista.
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated;

-- Privilegios sobre todas las tablas actuales del esquema public.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Que las tablas futuras (incrementos siguientes) hereden el mismo grant
-- sin tener que repetirlo en cada migración.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Nota: las PKs son UUID generadas en cliente (gen_random_uuid / crypto.randomUUID),
-- no hay secuencias que otorgar.
