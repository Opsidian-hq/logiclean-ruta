# Logiclean Ruta

App de venta en ruta offline-first para Logiclean: registra ventas, pedidos, cobranza y gastos, sostiene el seguimiento de prospectos con recordatorios de visita, y produce un corte semanal confiable. Proyecto Opsidian — *del caos al orden*.

> **Estado:** Incremento 0 (Cimientos) — rama `inc-0/cimientos`.
> El *porqué* de cada decisión vive en `docs/` (PRD, ADRs, modelo, plan). Léelos antes de tocar código.

---

## Stack

| Capa | Tecnología | Razón |
|---|---|---|
| UI | React + Ionic React | ADR-0005: componentes táctiles listos, capacitor-ready |
| Nativo | Capacitor | ADR-0002: PWA hoy, APK mañana sin reescribir |
| Backend | Supabase Cloud (Postgres + Auth + RLS) | ADR-0003 / ADR-0004 |
| Offline | Dexie.js (IndexedDB) | ADR-0001: operación sin conexión garantizada |
| Estado | Context + hooks React | Sin Redux/MobX/Zustand |
| Lenguaje | TypeScript en todo | |
| Tests | Vitest | |

---

## Estructura de carpetas

```
logiclean-ruta/
├─ docs/                         # Línea base congelada Fase 2 (NO editar sin ADR)
│  ├─ prd-logiclean-v1_2.md
│  ├─ modelo-datos-logiclean.md
│  ├─ plan-incrementos-riesgos-logiclean.md
│  ├─ handoff-logiclean-venta-prospectos.md
│  ├─ brief-sistema-diseno-logiclean.md
│  ├─ prompt-arranque-inc0-claude-code.md
│  ├─ adr/                       # ADR-0001 a ADR-0005
│  └─ prototipo/
│
├─ src/
│  ├─ pages/
│  │  ├─ Login.tsx               # Auth pública
│  │  ├─ CatalogoOffline.tsx     # Vendedor: solo lectura desde Dexie
│  │  └─ admin/
│  │     ├─ CatalogoPage.tsx     # H-13: gestión de catálogo (gerente)
│  │     ├─ ClientesPage.tsx     # H-14: gestión de clientes (gerente)
│  │     └─ components/
│  │        ├─ ProductoForm.tsx
│  │        ├─ PresentacionForm.tsx
│  │        └─ ClienteForm.tsx
│  ├─ components/
│  │  ├─ SyncStatusBadge.tsx     # Indicador permanente de sync
│  │  └─ ProtectedRoute.tsx      # Guard de ruta por rol
│  ├─ hooks/
│  │  ├─ useAuth.ts
│  │  ├─ useCatalog.ts
│  │  └─ useClientes.ts
│  ├─ context/
│  │  ├─ AuthContext.tsx
│  │  └─ SyncContext.tsx
│  ├─ db/
│  │  ├─ schema.ts               # Tipos TypeScript + stores Dexie
│  │  └─ index.ts                # Instancia singleton de Dexie
│  ├─ sync/
│  │  ├─ SyncEngine.ts           # Motor offline a servidor
│  │  └─ queue.ts                # Cola de operaciones pendientes
│  ├─ lib/
│  │  ├─ supabase.ts             # Cliente Supabase (anon key)
│  │  └─ uuid.ts                 # Wrapper crypto.randomUUID()
│  ├─ theme/
│  │  └─ variables.css           # Tokens de diseño (ADR-0005)
│  ├─ App.tsx                    # Rutas + IonApp
│  └─ main.tsx                   # Entry point
│
├─ supabase/
│  ├─ config.toml                # Proyecto Supabase CLI (migraciones + seed)
│  ├─ migrations/                # Nombradas <timestamp>_nombre.sql (formato CLI)
│  │  ├─ 20260611100001_schema.sql   # Todas las tablas del modelo
│  │  ├─ 20260611100002_rls.sql      # Políticas RLS por tabla
│  │  ├─ 20260611100003_roles.sql    # Trigger auto-vendedor + vista roles
│  │  └─ 20260615100004_grants.sql   # GRANTs de tabla a `authenticated`
│  └─ seed/
│     └─ catalog.sql             # 3 productos con presentaciones
│
├─ scripts/
│  ├─ backup.sh                  # pg_dump manual
│  └─ keepalive.sh               # Ping HTTP para plan free Supabase
│
├─ .github/
│  └─ workflows/
│     ├─ backup.yml              # Cron lunes 3am — artifact 30 días
│     └─ keepalive.yml           # Cron cada 12h — ping Supabase
│
├─ tests/
│  ├─ sync.test.ts               # T1: duplicados, idempotencia, reconexión
│  └─ rls.test.ts                # T4: un test por política RLS
│
├─ .env.example                  # Plantilla de variables de entorno
└─ index.html                    # PWA-ready
```

---

## Setup de desarrollo

### 1. Prerrequisitos

- Node.js 18+ (recomendado 22)
- npm 10+
- Cuenta en [Supabase](https://supabase.com) (plan free ok)

### 2. Clonar e instalar

```bash
git clone <repo-url>
cd logiclean-ruta
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env.local
# Editar .env.local con tus valores de Supabase
```

Variables requeridas (cliente):
- `VITE_SUPABASE_URL` — URL del proyecto (Settings → API)
- `VITE_SUPABASE_ANON_KEY` — Clave pública anon (Settings → API)

Variables solo para scripts (NUNCA al cliente):
- `SUPABASE_DB_URL` — Connection string para pg_dump
- `SUPABASE_ANON_KEY` — Para keepalive.sh

### 4. Aplicar migraciones en Supabase (CLI — fuente de verdad)

Las migraciones **son la única fuente de verdad del esquema**; nunca se cambia
la BD remota a mano. El esquema se reconstruye idéntico con la Supabase CLI.

Requiere la [Supabase CLI](https://supabase.com/docs/guides/cli) instalada.

```bash
# 1. Enlazar el repo con tu proyecto remoto (pide la DB password)
supabase link --project-ref <tu-project-ref>

# 2. Aplicar las migraciones 001..004 en orden a la BD remota
supabase db push
```

`supabase db push` aplica, en orden de timestamp, las cuatro migraciones de
`supabase/migrations/` y registra cada versión en
`supabase_migrations.schema_migrations`. Un entorno nuevo queda idéntico sin
pasos manuales.

> **Proyecto ya provisionado a mano (one-time).** Si las migraciones 001-004 ya
> se aplicaron por el SQL Editor (como en la verificación del hito de Inc 0), la
> tabla `schema_migrations` está vacía y `db push` intentaría reaplicarlas y
> fallaría (`CREATE POLICY` no es idempotente). Márcalas como aplicadas una sola
> vez antes del primer push:
> ```bash
> supabase migration repair --status applied 20260611100001 20260611100002 \
>   20260611100003 20260615100004
> ```

### 5. Cargar seed de ejemplo

El seed (`supabase/seed/catalog.sql`) está declarado en `config.toml` y se
carga automáticamente al rehacer la BD **local**:

```bash
supabase db reset      # rehace la BD local: migraciones 001..004 + seed
```

Para sembrar un proyecto **remoto**, ejecuta el contenido de
`supabase/seed/catalog.sql` una vez vía `supabase db push` no aplica seeds
(solo migraciones); usa `psql "$SUPABASE_DB_URL" -f supabase/seed/catalog.sql`.

### 6. Desarrollo local

```bash
npm run dev       # Servidor en http://localhost:5173
npm test          # Todos los tests (Vitest)
npm run build     # Build de producción
```

---

## Rutas de la aplicación

| Ruta | Componente | Quién accede |
|---|---|---|
| `/login` | `LoginPage` | Público |
| `/catalogo` | `CatalogoOfflinePage` | Vendedor |
| `/admin` | Redirect a `/admin/catalogo` | Gerente |
| `/admin/catalogo` | `CatalogoPage` | Gerente |
| `/admin/clientes` | `ClientesPage` | Gerente |

El rol se determina por `auth.users.raw_user_meta_data->>'rol'` (valores: `'vendedor'` o `'gerente'`).

---

## Convenciones (decididas en Fase 2 — no se improvisan)

| Convención | Detalle |
|---|---|
| **PKs UUID en cliente** | `crypto.randomUUID()` — sync idempotente sin colisiones |
| **Baja lógica** | `activo = false`, nunca `DELETE` físico en catálogo y clientes |
| **Migraciones = fuente de verdad** | Nunca cambiar la BD remota a mano |
| **Cada política RLS = un caso de prueba** | Comentarios `-- Test T4-XXX` en `20260611100002_rls.sql` |
| **Migraciones con formato CLI** | `<timestamp>_nombre.sql`; aplicar con `supabase db push`, nunca a mano |
| **`service_role` nunca en cliente** | Solo en variables de CI/CD con acceso restringido |
| **`INVENTARIO_VEHICULO.cantidad`** | Contador que se decrementa (no bitácora) |
| **Sin `VISITA_PROGRAMADA`** | Decisión descartada |
| **Crédito** | Venta sin cobro asociado |
| **`COBRO.tipo`** | Solo `'total'` o `'parcial'` |

---

## Motor de sincronización offline

```
Usuario modifica dato
       ↓
Dexie (IndexedDB) — guarda inmediatamente
       ↓
sync_queue — encola { table, operation:'upsert'|'delete', payload, status:'pending' }
       ↓
navigator.onLine == true?
  Sí  → SyncEngine.processQueue() → supabase.upsert({ onConflict:'id' })
  No  → espera evento 'online'
       ↓
status:'synced' o 'error' (reintento en próximo ciclo)
```

`SyncStatusBadge` muestra el estado siempre visible en el toolbar.

---

## Scripts de operación

```bash
# Backup manual
SUPABASE_DB_URL=postgres://... ./scripts/backup.sh

# Keepalive manual
SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... ./scripts/keepalive.sh
```

GitHub Actions secretos requeridos:
- `SUPABASE_DB_URL` — para backup.yml
- `SUPABASE_URL` + `SUPABASE_ANON_KEY` — para keepalive.yml

---

## Tests

```bash
npm test                  # Todos los tests
npm run test:watch        # Modo watch
npm run test:coverage     # Con cobertura
```

- `tests/sync.test.ts` — T1: cola offline, idempotencia, reconexión, retry
- `tests/rls.test.ts` — T4: verificación de cláusulas RLS en `20260611100002_rls.sql` (44 tests)

---

## Flujo de trabajo Git

Una rama / PR por incremento del plan:

```
main
└─ inc-0/cimientos   ← rama actual (Incremento 0)
└─ inc-1/ventas      (futuro — Inc 1)
```

Un PR no se da por listo hasta que el hito del incremento se demuestra de punta a punta.
