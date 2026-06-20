# Go-live paso a paso — Logiclean Ruta
### Fase 6 · Guion de ejecución · Opsidian

> **Cómo usar este documento:** es la versión ejecutable del `runbook-despliegue-fase6.md`.
> Sigue las secciones **en orden**; cada paso tiene una casilla. No avances a la
> siguiente sección hasta cerrar la actual. Donde dice ⏱️ es una verificación que
> no debes saltarte.
>
> **Tiempo estimado:** 60–90 min · **Empaque:** PWA · **Requisitos:** cuenta Supabase,
> cuenta Vercel, acceso de admin al repo en GitHub.

---

## Sección A — Proyecto Supabase de producción

> Objetivo: un proyecto **nuevo y separado** del de dev/QA, con esquema, seguridad y
> catálogo cargados.

- [ ] **A1.** En https://supabase.com/dashboard → **New project**.
  - Organización: la de Opsidian.
  - Name: `logiclean-ruta-prod`.
  - Database password: genera una **fuerte** y guárdala en el gestor de secretos (la necesitarás en C).
  - Region: la más cercana a la operación (México → `us-east-1` o `us-west-1`).
- [ ] **A2.** Espera a que el proyecto termine de aprovisionar (~2 min).
- [ ] **A3.** Copia y guarda en un lugar seguro (los usarás en B y C):
  - Settings → **API** → `Project URL`  → será `VITE_SUPABASE_URL`.
  - Settings → **API** → `anon` `public` key → será `VITE_SUPABASE_ANON_KEY`.
  - Settings → **Database** → `Connection string` → **URI** → será `SUPABASE_DB_URL`.

### Aplicar migraciones (SQL Editor, EN ORDEN)

> SQL Editor → **New query** → pega el contenido del archivo → **Run**. Uno por uno.

- [ ] **A4.** `supabase/migrations/001_schema.sql` → Run. ⏱️ Sin errores.
- [ ] **A5.** `supabase/migrations/002_rls.sql` → Run. ⏱️ Sin errores.
- [ ] **A6.** `supabase/migrations/003_roles.sql` → Run. ⏱️ Sin errores (crea el trigger `handle_new_vendedor`).
- [ ] **A7.** `supabase/migrations/004_grants.sql` → Run. ⏱️ **Obligatorio** — sin los GRANT a `authenticated`, la app autenticada no ve datos aunque la RLS sea correcta.
- [ ] **A8.** `supabase/seed/catalog.sql` → Run. ⏱️ Carga catálogo (productos, presentaciones, precios).

### Verificación de seguridad (no avanzar sin esto)

- [ ] **A9.** ⏱️ RLS activa en todas las tablas: SQL Editor →
  ```sql
  select relname, relrowsecurity
  from pg_class
  where relnamespace = 'public'::regnamespace and relkind = 'r'
  order by relname;
  ```
  Todas las tablas de negocio deben tener `relrowsecurity = true`.
- [ ] **A10.** ⏱️ La anon key no filtra datos sin sesión: en Settings → API → "Project API",
  o con `curl` (reemplaza `<URL>` y `<ANON>`):
  ```sql
  -- En SQL Editor, simula el rol anon:
  set role anon;
  select * from cliente;     -- debe devolver 0 filas (o error de permiso)
  reset role;
  ```

### Crear los usuarios de producción

> ⚠️ **Importante:** el trigger `handle_new_vendedor` solo crea la fila `vendedor`
> si el metadata `rol='vendedor'` ya existe **en el INSERT** del usuario. Como el
> dashboard crea el usuario sin metadata, el trigger no alcanza a crear la fila;
> por eso aquí asignamos el metadata **y** insertamos la(s) fila(s) de vendedor a
> mano (paso A13). El **gerente no lleva fila en `vendedor`** — es correcto.

- [ ] **A11.** Authentication → **Users** → **Add user** → **Create new user** → crea cada usuario (vendedor[es] y gerente) con email + contraseña temporal + **Auto Confirm User** activado.
- [ ] **A12.** Asignar el rol (y, para vendedores, `nombre` y `tipo`) en `raw_user_meta_data` vía SQL:
  ```sql
  -- Vendedor (tipo: 'mayoreo' o 'menudeo'):
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data,'{}') || '{"rol":"vendedor","nombre":"Laura Ruiz","tipo":"menudeo"}'
  where email = 'vendedor@logiclean.mx';

  -- Gerente:
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data,'{}') || '{"rol":"gerente","nombre":"Gerencia"}'
  where email = 'gerente@logiclean.mx';
  ```
- [ ] **A13.** Crear la(s) fila(s) `vendedor` faltante(s) (idempotente; el trigger no se reejecuta tras un UPDATE de metadata):
  ```sql
  insert into public.vendedor (id, nombre, tipo)
  select u.id,
         coalesce(u.raw_user_meta_data->>'nombre', u.email),
         coalesce(u.raw_user_meta_data->>'tipo', 'menudeo')
  from auth.users u
  where u.raw_user_meta_data->>'rol' = 'vendedor'
  on conflict (id) do nothing;
  ```
- [ ] **A14.** ⏱️ Verifica roles y filas de vendedor:
  ```sql
  -- Todos los usuarios y su rol:
  select email, raw_user_meta_data->>'rol' as rol from auth.users order by rol;
  -- Cada vendedor (NO el gerente) debe tener su fila:
  select v.id, u.email, v.tipo
  from public.vendedor v join auth.users u on u.id = v.id;
  ```

---

## Sección B — Frontend (PWA) en Vercel

- [ ] **B1.** https://vercel.com/new → **Import Git Repository** → selecciona `opsidian-hq/logiclean-ruta`.
- [ ] **B2.** Framework Preset: **Vite** (autodetectado). Build & Output (autodetectados, confirma):
  - Build Command: `npm run build`
  - Output Directory: `dist`
  - Install Command: `npm ci`
- [ ] **B3.** Production Branch: `main` (Project Settings → Git, si no quedó por defecto).
- [ ] **B4.** Environment Variables (scope **Production**):
  - `VITE_SUPABASE_URL` = (Project URL de A3)
  - `VITE_SUPABASE_ANON_KEY` = (anon key de A3)
- [ ] **B5.** **Deploy**. Espera el build (~1–2 min). ⏱️ El build termina en verde.
- [ ] **B6.** ⏱️ Abre la URL de producción → carga la pantalla de **login** sobre HTTPS.
- [ ] **B7.** ⏱️ Recarga estando en una ruta interna (p. ej. `/admin/catalogo`) → **no** da 404 (los SPA rewrites de `vercel.json` funcionan).

---

## Sección C — Secretos de operación en GitHub

> Repo → Settings → **Secrets and variables** → **Actions** → **New repository secret**.

- [ ] **C1.** `SUPABASE_DB_URL` = (Connection string URI de A3) — para `backup.yml`.
- [ ] **C2.** `SUPABASE_URL` = (Project URL de A3) — para `keepalive.yml`.
- [ ] **C3.** `SUPABASE_ANON_KEY` = (anon key de A3) — para `keepalive.yml`.
- [ ] **C4.** Actions → **Database Backup** → **Run workflow** (manual). ⏱️ Verde + artifact `logiclean-backup-*` generado.
- [ ] **C5.** ⏱️ Descarga el artifact y confirma que el `.sql` **no está vacío** (tiene `CREATE TABLE` / `INSERT`).
- [ ] **C6.** Actions → **Supabase Keepalive** → **Run workflow** (manual). ⏱️ Verde.

---

## Sección D — Protección de rama y CI

- [ ] **D1.** Repo → Settings → **Branches** → **Add branch ruleset** (o branch protection) para `main`:
  - Require a pull request before merging.
  - **Require status checks to pass** → selecciona el check **CI** (`ci.yml`: lint·test·build).
- [ ] **D2.** ⏱️ Abre un PR de prueba (o el de esta rama) y confirma que el check **CI** corre y queda en verde antes de poder fusionar.

---

## Sección E — Rotación de credenciales y seguridad final

- [ ] **E1.** Cambia las contraseñas temporales de los usuarios reales (Authentication → User → Reset password, o que el usuario la cambie en primer ingreso).
- [ ] **E2.** Si creaste usuarios de prueba (`vendedor@logiclean.mx` / `gerente@logiclean.mx`) que no son de producción → **elimínalos**.
- [ ] **E3.** ⏱️ Confirma que no hay secretos en el repo: `.env.local` está en `.gitignore` y no hay claves reales commiteadas.
- [ ] **E4.** Entrega las credenciales a cada usuario por **canal seguro** (no chat abierto / no correo en claro).

---

## Sección F — Smoke test en producción (dispositivo real)

> Recorrido mínimo sobre la URL de producción. Reusa los CPs de Fase 5.

- [ ] **F1.** Login como **vendedor** → carga la ruta del día.
- [ ] **F2.** Registrar una venta con cobro en efectivo → queda guardada (CP-001/CP-003).
- [ ] **F3.** **Modo avión** → registrar otra venta → recuperar señal → ⏱️ sincroniza sola, badge a "sincronizado" (CP-024/CP-026).
- [ ] **F4.** Login como **gerente** → ⏱️ la venta aparece en dashboard y en el corte (CP-018; valida D-004 en prod).
- [ ] **F5.** Instalar como PWA (Android: menú → "Agregar a pantalla de inicio"; iPhone: Safari → Compartir → "Agregar a inicio") y abrir desde el ícono.

---

## Sección G — Entrega a usuarios

- [ ] **G1.** Comparte el instructivo de instalación PWA + la URL de producción.
- [ ] **G2.** Acompaña a cada usuario en su primer ingreso y una venta de prueba.
- [ ] **G3.** Confirma con cada uno que la app abre, instala y registra correctamente.

---

## Cierre del gate de Fase 6

Marca el gate en `runbook-despliegue-fase6.md` cuando:
- [ ] PWA en producción (HTTPS), instalable y operando offline (A–B, F).
- [ ] Backend prod con esquema + RLS + grants + seed verificados (A).
- [ ] CI gate requerido en `main`; backup + keepalive con una corrida exitosa (C–D).
- [ ] Credenciales rotadas, sin secretos en el repo (E).
- [ ] Smoke test en verde (F).
- [ ] Usuarios con la app instalada y venta de prueba registrada (G).

**Con esto, Logiclean Ruta queda entregado y en operación.** 🚀

---

## Si algo sale mal (rollback rápido)

- **Frontend roto tras un deploy:** Vercel → Deployments → el deploy anterior → **Promote to Production** (segundos, sin rebuild).
- **Datos corruptos / migración defectuosa:** restaurar el último artifact de `backup.yml` sobre un proyecto limpio (`psql "<SUPABASE_DB_URL>" < backup_logiclean_*.sql`). Nunca editar la BD a mano.
- **RLS filtra datos entre vendedores:** despublicar (pausar tráfico) y revisar políticas en `002_rls.sql` contra los casos `T4-*` antes de reabrir.

---

*Acompaña a `docs/runbook-despliegue-fase6.md`. Insumos: `.env.example`, `vercel.json`,
`supabase/migrations/*`, `supabase/seed/catalog.sql`, workflows `ci.yml` / `backup.yml`
/ `keepalive.yml`.*
