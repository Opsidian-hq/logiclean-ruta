# Runbook de despliegue y entrega — Logiclean Ruta
### Fase 6 · Despliegue y entrega · Opsidian

> **Propósito:** llevar el MVP verificado en Fase 5 a producción y ponerlo en manos
> de los usuarios reales, de forma repetible y reversible. Este documento es el
> procedimiento operativo (runbook): se sigue paso a paso en cada despliegue.
>
> **Estado:** Fase 6 en curso · Empaque de entrega: **PWA** (ADR-0002; APK nativo
> diferido — CP-027 confirmó que iOS offline es viable como PWA).

---

## 1. Alcance y arquitectura de despliegue

**Dentro:** publicar la PWA en hosting estático, configurar el backend Supabase de
producción (esquema, RLS, roles, grants, seed), respaldos y keepalive, rotación de
credenciales, verificación post-deploy y entrega a usuarios.

**Fuera (diferido):** APK Android nativo / tiendas (ADR-0002), CFDI, optimización de
ruta. No se despliegan porque no se construyeron.

```
  Dispositivo (Android gama baja / iPhone Safari)
        │  PWA instalada (Add to Home Screen)
        ▼
  Hosting estático (Vercel)  ── sirve dist/ + service worker (precache offline)
        │  HTTPS · SPA rewrites (vercel.json)
        ▼
  Supabase Cloud (Postgres + Auth + RLS)
        ▲
        └── GitHub Actions: backup.yml (semanal) · keepalive.yml (cada 12 h)
```

| Capa | Producción |
|---|---|
| Frontend | PWA estática (Vite build) en Vercel |
| Backend | Proyecto Supabase Cloud dedicado de **producción** |
| Offline | Service worker (Workbox) precachea shell + chunks de ruta |
| Operación | GitHub Actions (backup + keepalive) |
| Integración | GitHub Actions `ci.yml` (lint + test + build) — gate de merge |

---

## 2. Criterios de entrada (gate de Fase 5 cerrado)

- [x] Gate de Fase 5 CERRADO (`docs/plan-verificacion-manual-qa.md`): 31/31 CPs en verde, 0 críticos.
- [x] 162 tests automatizados en verde (`docs/trazabilidad-qa-fase5.md`).
- [x] `npm run build` limpio y service worker PWA generado.
- [x] Gate de CI (`.github/workflows/ci.yml`) en verde — lint + test + build en cada PR/push a `main`.
- [ ] Proyecto Supabase de **producción** creado (separado del de QA/dev).
- [ ] Cuenta de hosting (Vercel) con acceso al repo.

---

## 3. Variables de entorno de producción

> Fuente: `.env.example`. La `service_role` **nunca** va al cliente ni al repo.

**Cliente (build de Vercel) — prefijo `VITE_`, son públicas por diseño:**

| Variable | Origen | Dónde se configura |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API | Vercel → Project → Environment Variables |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API (anon/public) | Vercel → Environment Variables |

**Solo CI/operación (nunca al cliente) — GitHub → Settings → Secrets:**

| Secreto | Usado por | Origen |
|---|---|---|
| `SUPABASE_DB_URL` | `backup.yml` (pg_dump) | Supabase → Settings → Database → Connection string (URI) |
| `SUPABASE_URL` | `keepalive.yml` | Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | `keepalive.yml` | Supabase → Settings → API |

> La anon key es segura en el cliente **porque la RLS es la frontera de seguridad**
> (ADR-0004). Verificar que la RLS esté activa antes de exponerla (paso 4).

---

## 4. Despliegue del backend (Supabase producción)

Ejecutar en el **SQL editor** del proyecto de producción, **en este orden**:

1. `supabase/migrations/001_schema.sql` — tablas del dominio.
2. `supabase/migrations/002_rls.sql` — políticas RLS (cada una traza un caso `T4-*`).
3. `supabase/migrations/003_roles.sql` — trigger `handle_new_vendedor` (`VENDEDOR.id = auth.users.id`).
4. `supabase/migrations/004_grants.sql` — **GRANTs a `authenticated`** (la RLS no basta sin GRANT; ver commit `883f2de`). ⚠️ *El README histórico omitía este paso; es obligatorio.*
5. `supabase/seed/catalog.sql` — catálogo base (productos, presentaciones, listas de precios).

**Verificación del backend (no avanzar sin esto):**
- [ ] RLS **habilitada** en todas las tablas (Supabase → Authentication → Policies, o `SELECT relrowsecurity FROM pg_class` por tabla).
- [ ] Crear los usuarios de producción en Auth con su `raw_user_meta_data->>'rol'` (`'vendedor'` / `'gerente'`); el trigger crea su `VENDEDOR`.
- [ ] Un `SELECT` con la anon key (sin sesión) **no** devuelve datos de negocio.

---

## 5. Despliegue del frontend (PWA en Vercel)

1. Conectar el repo a Vercel (rama de producción: `main`).
2. Build settings (autodetectados para Vite):
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install: `npm ci`
3. Cargar las variables `VITE_*` del paso 3 (scope: Production).
4. `vercel.json` ya define los **SPA rewrites** (`/(.*) → /index.html`) — necesarios para el routing de Ionic en recarga/deep-link (commit `ccce637`).
5. Deploy. Confirmar HTTPS y que la URL carga el login.

**Nota PWA / offline:** el service worker usa `registerType: 'autoUpdate'` y precachea
todos los chunks (`globPatterns` en `vite.config.ts`), así que la app opera offline
tras la primera carga con señal. Cada deploy nuevo se actualiza automáticamente al
recargar (con limpieza de caches obsoletas, `cleanupOutdatedCaches: true`).

---

## 6. Operación continua (GitHub Actions)

Cargar los secretos del paso 3 en GitHub y verificar:
- [ ] `ci.yml` — gate de integración (lint + test + build) en verde en el PR antes de fusionar a `main`. *(No requiere secretos; se recomienda marcarlo como check requerido en la protección de rama de `main`.)*
- [ ] `backup.yml` — pg_dump semanal (lun 3am UTC), artifact 30 días. Lanzar `workflow_dispatch` una vez para validar.
- [ ] `keepalive.yml` — ping cada 12 h (evita que Supabase free pause el proyecto tras 7 días). Lanzar manual una vez.
- [ ] Descargar y revisar el primer backup (que el `.sql` no esté vacío).

---

## 7. Rotación de credenciales (antes del go-live)

- [ ] Rotar contraseñas de los usuarios de prueba `vendedor@logiclean.mx` / `gerente@logiclean.mx` (o eliminarlos si no son de producción).
- [ ] Confirmar que ninguna credencial real está en el repo (`.env.local` en `.gitignore`).
- [ ] Entregar credenciales a cada usuario por canal seguro (no por chat abierto).

---

## 8. Verificación post-deploy (smoke test en producción)

Recorrido mínimo sobre la URL de producción, en un dispositivo real:

- [ ] Login como vendedor → carga la ruta del día.
- [ ] Registrar una venta con cobro → aparece guardada (reusa CP-001/CP-003).
- [ ] Modo avión → registrar venta → recuperar señal → sincroniza solo (CP-024/CP-026).
- [ ] Login como gerente → la venta aparece en dashboard/corte (CP-018, valida D-004 en prod).
- [ ] Instalar como PWA (Add to Home Screen) y abrir desde el ícono.

---

## 9. Plan de rollback

- **Frontend:** Vercel guarda deploys inmutables → *Promote* el deploy anterior (rollback en segundos). No requiere rebuild.
- **Backend:** las migraciones son la fuente de verdad y **aditivas**; ante un cambio defectuoso, restaurar desde el último artifact de `backup.yml` (`psql < backup_logiclean_*.sql`) sobre un proyecto limpio. Nunca editar la BD a mano (convención de Fase 2).
- **Disparador de rollback:** pérdida de datos, login roto, o RLS que filtre datos entre vendedores.

---

## 10. Entrega a usuarios

- [ ] Instructivo de instalación PWA (Android: menú → "Agregar a pantalla de inicio"; iPhone: Safari → Compartir → "Agregar a inicio").
- [ ] Credenciales entregadas (paso 7).
- [ ] Confirmar con cada usuario que la app abre, instala y registra una venta de prueba.

---

## Criterios de salida (gate de Fase 6)

- [ ] PWA accesible en URL de producción (HTTPS), instalable y operando offline.
- [ ] Backend de producción con esquema + RLS + grants + seed aplicados y verificados.
- [ ] Backups y keepalive corriendo (al menos una ejecución exitosa de cada uno).
- [ ] Credenciales rotadas; sin secretos en el repo.
- [ ] Smoke test post-deploy en verde (paso 8).
- [ ] Usuarios con la app instalada y una venta de prueba registrada.

Con el gate cerrado, el producto queda **entregado y en operación**.

---

*Insumos: ADR-0002 (PWA hoy, nativo mañana) · ADR-0003/0004 (Supabase + RLS) ·
`docs/plan-verificacion-manual-qa.md` (gate F5) · `.env.example` · `vercel.json` ·
`supabase/migrations/*` · workflows `backup.yml` / `keepalive.yml`.*
