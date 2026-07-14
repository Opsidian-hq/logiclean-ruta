# Dossier de evidencia de ejecución — Logiclean Ruta

> **Propósito:** insumo de solo lectura para una retrospectiva crítica que alimenta el reframe de la
> metodología Opsidian. No es un reporte de calidad del producto — es una extracción de evidencia dura
> (git/PR/archivos) distinguida explícitamente de narrativa reconstruida.
>
> **Método:** auditoría combinada de git local + API de GitHub sobre `Opsidian-hq/logiclean-ruta`. El
> repo se auditó con historia completa (`git fetch --unshallow`; el clon de trabajo llegaba truncado en
> el PR #67 — evidencia en sí misma de que un clon superficial habría ocultado más de la mitad de los
> incrementos). Se instaló `node_modules` y se corrió la suite de pruebas y coverage localmente
> (`npm ci && npm test && npm run test:coverage`) para obtener cifras verificadas en vez de estimadas.
> Adicionalmente se consultó la API de GitHub (`list_pull_requests`, `search_pull_requests`,
> `pull_request_read` en sus métodos `get`/`get_files`/`get_reviews`/`get_review_comments`/`get_comments`/
> `get_check_runs`) para los 120 números de PR del repo, confirmando que **los 120 son PRs reales y
> mergeados** (no hay huecos por PRs cerrados sin mergear) — esto corrige una estimación inicial basada
> solo en commits de merge locales, que subcontaba por no capturar PRs fusionados por squash/rebase sin
> commit de merge de dos padres. No se modificó ningún archivo de código, migración, configuración, ni se
> comentó/aprobó/mergeó ningún PR; este documento es el único artefacto nuevo.
> **Ventana temporal:** 2026-06-15 (primer commit, Inc 0) → 2026-07-14 (hoy) = **29 días corridos** para
> Inc 0 a Inc 7 (parcial).
> **Cuando un dato no se pudo verificar con evidencia dura, se marca explícitamente `NO DISPONIBLE`** —
> no se estima ni se rellena por inferencia.

---

## A. Mapa de ejecución por incremento (Inc 0 → 7)

### A.0 Nota sobre la fuente

Confirmado vía API de GitHub (`search_pull_requests`, `is:pr is:merged` → `total_count=120`): **los 120
números de PR del repo son PRs reales y mergeados**, todos con base `main` salvo **#75, #76, #77**, que
son una cadena apilada (`inc-6.2`→`inc-6.1`, `inc-6.3`→`inc-6.2`, `inc-6.4`→`inc-6.3`) fusionada a `main`
en conjunto por **PR #78**. Autor de los 120: `Opsidian-hq` (operador único — no hay coautoría humana
distinta en el propio PR, aunque los commits sí llevan `Co-Authored-By: Claude ...`). Rango de fechas:
2026-06-15 → 2026-07-14. **Total agregado de los 120 PRs: +51,066/−7,833 líneas, 173 commits.**

Los incrementos 0–5, tal como describe `docs/plan-incrementos-riesgos-logiclean.md`, no tienen límites
de PR documentados formalmente; el mapeo de abajo se reconstruyó cruzando las etiquetas explícitas en
mensajes de commit (`feat(inc3)`, `[T-inc6.5-...]`, etc.) con las fechas. Se marca cada fila con el nivel
de confianza.

### A.1 Tabla por incremento

| Incremento | PR(s) | Fecha(s) de merge | Líneas +/- (suma) | Archivos tocados (aprox.) | Commits | Confianza del mapeo |
|---|---|---|---|---|---|---|
| **Inc 0** — Cimientos técnicos | #1, #2 | 2026-06-15 | +10,406/-25 (PR#1) · +326/-5 (PR#2) | 51 (PR#1) + 9 (PR#2) | 13 (PR#1, un solo PR con 13 commits internos) + 1 | Alta — commit `7970a94` dice literalmente "Incremento 0" |
| **Inc 1** — Venta/inventario/ruta/gastos | #3, #4, #6 | 2026-06-15/16 | +1,332/-4 · +858/-5 · +331/-190 | 11+13+27 | 1+1+3 | Alta — `feat(venta)...(Inc 1)`, `...cierre Inc 1` en el mensaje |
| **Inc 2** — Prospectos + panel gerente | #5 | 2026-06-15 | +1,388/-135 | 16 | 1 | Alta — `feat(prospectos)...(Inc 2)` |
| *(cross-cutting)* Fix de fidelidad visual | #7 | 2026-06-16 | +1,342/-677 | 22 | 5 | — ver Sección C |
| **Inc 3** — Corte semanal (H-10/H-11) | #8 | 2026-06-16 | +1,865/-3 | 20 | 4 | Alta — `feat(inc3)...` |
| **Inc 4** — Dashboard gerente | #9 | 2026-06-16 | +540/-254 | 8 | 1 | Alta — `feat(inc4)...` |
| **Inc 5** — Cobranza en ruta (H-07) | `b7e9e4d` (sin PR asociado detectable) | 2026-06-17 | +1,050/-4 (commit único) | 12 | 1 | Media — el commit dice `feat(inc-5)` pero **no está enlazado a un merge de PR**; ver Sección F |
| Fase 5 — QA / defectos | #10–#21 | 2026-06-17/18 | ver tabla de defectos (Sección C) | — | 12 PRs, mayormente 1 commit c/u | Alta — rama `qa-phase5-*`, doc `trazabilidad-qa-fase5.md` |
| Fase 6 (prep/despliegue) + polish post-QA | #22, #23–#26, #27–#73 (con huecos: #23-26,29-33,39,41-58,62,68-70 son mezcla de squash/gap) | 2026-06-19 → 2026-07-02 | +45,854/-14,579 acumulado en todo el rango #1–101 con merge commit (cifra agregada, no aislable por incremento sin más trabajo) | — | — | Baja para desglose fino — es una cola larga de ~50 PRs pequeños de ajuste UI/UX pedidos directamente por el PM/cliente (nombres de rama: `vendedor-fixes`, `customer-profile-ui`, `route-day-dropdown`, `expenses-period-view`, etc.), no mapeados 1:1 a una historia del PRD |
| **Inc 6** (6.1–6.6) — Bodega + corte por consumo real (ADR-0008/9/10) | #74, #78 (trae 75-77), #79, #80 | 2026-07-03 | +1,023/-2 · +1,818/-158 · +728/-107 · +273/-0 | 6+18+13+4 | 1+3+1+1 | Alta — ramas `inc-6.N/*` explícitas |
| Inc 6 cola (ajustes menores) | #82, #85–#101 | 2026-07-03 → 2026-07-08 | suma ~+3,000/-1,300 (17 PRs pequeños, 1 commit c/u salvo excepciones) | — | 17 | Media |
| **Inc 7** — Corte por reparto/liquidación (ADR-0011, H-20) | #102 (docs), #103 (dominio), #104 (esquema), #105 (UI, squash) | 2026-07-08/09 | +0/-0 doc-only · +513/-0 · +283/-0 · +2,398/-612 | 0+4+2+25 | 1+1+1+2 (feat+fix interno, ver Sección C) | Alta — ramas `docs/corte-reparto-v1-4`, `feat/corte-dominio`, `feat/corte-esquema`, mensajes `Inc 7.1/7.2/7.4` explícitos |
| Inc 7 — hotfixes post-cierre | #106–#111 | 2026-07-09/10/13 | ver Sección C | — | 6 | Alta |
| Post-Inc7 / Fase 7 operación (saldo vendedor-negocio, honorario retenido) | #111–#120 | 2026-07-13/14 | suma ~+1,000/-300 (10 PRs) | — | 10 | Media — no está en ningún doc de incrementos; es trabajo de Fase 7 no versionado en el plan |

**Días desde primer commit a "prod":** el proyecto no tiene entorno de staging (ver Sección D), así que
cada merge a `main` es funcionalmente el despliegue (Vercel se dispara sobre `main`). Por incremento:

| Incremento | Primer commit | Último commit del incremento | Días |
|---|---|---|---|
| Inc 0 | 2026-06-15 | 2026-06-15 | 0 (mismo día) |
| Inc 1–4 | 2026-06-15 | 2026-06-17 | 2 |
| Inc 5 | 2026-06-16 (prototipo/handoff) | 2026-06-17 | 1 |
| Inc 6 (6.1–6.6) | 2026-07-03 | 2026-07-03 | 0 (mismo día — 6 sub-incrementos en 24h) |
| Inc 7 (motor+esquema+UI) | 2026-07-08 | 2026-07-09 | 1 |
| Inc 7 — estabilización | 2026-07-09 | 2026-07-14 | 5 |

**Lectura de forma de entrega:** Inc 0–5 se entregaron como **PRs monolíticos** (uno o pocos PRs por
incremento completo, ej. PR #1 = 10,406 líneas para todo Inc 0 en un solo PR). Inc 6–7 se entregaron
como **decenas de PRs pequeños de una sola tarea** (`[T-nombre-tarea]`), la mayoría de un solo commit.

**Rondas de revisión — dato duro, verificado vía API sobre los 120 PRs (no estimado):**
- **0 reviews formales** (`APPROVE`/`REQUEST_CHANGES`/`COMMENT` vía el endpoint de reviews de GitHub) en
  **los 120 PRs**, sin excepción. Nunca hubo un botón de "Approve" ni un "Request changes" en todo el
  repo.
- **0 comentarios de revisión en línea sobre código** (`review_comments`) en **119 de 120 PRs**.
- **La única excepción real es PR #105**, donde SÍ existe el patrón completo feat → comentario de
  revisión → fix → confirmación → merge, con **25 minutos** entre el comentario y el commit de arreglo
  (detalle completo en Sección C.2). Es, literalmente, **la única ronda de revisión de código con
  comentarios de texto reconstruible en todo el historial del proyecto.**
- La segunda excepción parcial es **PR #1**, que tiene un comentario sustantivo — pero es un reporte de
  auto-verificación del propio autor corriendo el script de hito (`verify-hito-inc0.mjs`), no una
  revisión de un tercero; aun así, revela 2 defectos reales corregidos antes del merge (Sección C.1a).
- El resto de los 118 PRs con `comments=1` solo tiene el comentario automático del bot de despliegue de
  Vercel (preview deployment) — no es actividad de revisión.

**Conclusión de esta subsección:** el proyecto no tuvo, en la práctica registrada por GitHub, un proceso
de revisión de código por pares — ni una sola vez en 120 PRs se usó el mecanismo de "Request changes" de
GitHub. Cuando el diseño/handoff exigía una verificación de calidad, ocurrió **dentro** de la sesión de
Claude Code (auto-verificación antes de abrir el PR, como en #1 y #105), no como una revisión externa
posterior. Ver Sección F para la lectura de qué implica esto sobre el mecanismo real de control de
calidad del proyecto.

---

## B. Reprocesamiento y churn (foco: el motor de dinero)

### B.1 Linaje del motor de corte

```
Inc 3 (2026-06-16, commit 74aa154)
  └─ src/lib/corte.ts + src/pages/admin/CortePage.tsx (360 líneas) + src/hooks/useCorte.ts
     Motor: factor_conversion gobierna el cuadre (H-11); inventario del VEHÍCULO traducido a bidones.
        │
        │  ADR-0008/0009/0010 (sin doc formal — ver Sección E)
        ▼
Inc 6.5 (2026-07-03, commit 582a7d2, PR #79) — REESCRITURA del motor existente, código en producción
  └─ src/lib/corte.ts: +202/-29 líneas netas dentro del mismo archivo
     - Se RETIRA `inventarioBidones` (todo el bloque que traducía por factor_conversion) — prohibido
       por ADR-0008.
     - Se AGREGA snapshot de inventario de BODEGA (litros + presentaciones) — H-10 real.
     - Se AGREGA "identidad de control" (ADR-0009): recibido−devuelto = bidones abiertos.
     - `lib/conversion.ts` queda huérfano de facto (91 líneas) — "se conserva intacto para
       planeación (Inc 7)" según el propio mensaje de commit, pero deja de invocarse desde el corte.
        │
        │  ADR-0011 (2026-07-08/09, doc formal sí existe)
        ▼
Inc 7.1/7.2/7.4 (2026-07-08→10, commits c494c67+e9f7870+cfaf6ae+db8edcf, PRs #102-105) —
REEMPLAZO COMPLETO de la UI y del modelo de datos del corte
  - src/domain/corte/motor.ts (231 líneas, nuevo, puro) + types.ts (102) + index.ts (13) = 513 líneas
    nuevo motor de dominio (Inc 7.1, PR #103).
  - supabase/migrations/011_corte_reparto.sql (155 líneas): reestructura CORTE de por-vendedor a
    corte de negocio; tablas nuevas CORTE_VENDEDOR y LIQUIDACION_MOVIMIENTO (Inc 7.2, PR #104).
  - src/pages/admin/corteReparto/* (12 archivos nuevos, ~1,700 líneas) + src/lib/corteReparto.ts
    (324 líneas nuevas) reemplazan la pantalla de corte (Inc 7.4, PR #105).
  - BORRADO COMPLETO: src/pages/admin/CortePage.tsx (-376 líneas, la pantalla de Inc 3, con 24 días
    de vida en producción) y src/hooks/useCorte.ts (-107 líneas).
  - src/lib/corte.ts pierde 66 líneas (la función `generarCorte` que escribía el CORTE por vendedor)
    pero **no se borra entero**: `calcularCorte` sigue viva y reutilizada por el nuevo stepper
    (comentario explícito en el propio archivo: "sigue vigente como pieza pura reutilizada").
```

### B.2 Diff-stat agregado del cutover Inc 3 → Inc 7

| Métrica | Valor |
|---|---|
| Código nuevo construido para el motor de corte por reparto (domain/corte + migración 011 + UI stepper) | **+3,137 líneas** (513 + 283 con tests incluidos de esas dos + 2,341 del commit de UI) |
| Código de Inc 3 borrado en el cutover (commit `cfaf6ae`, un solo commit) | **-612 líneas** (incluye `CortePage.tsx` completo, `useCorte.ts` completo, 66 líneas de `corte.ts`, y recortes en `dashboard.ts`/`useDashboard.ts`/`useGastos.ts`) |
| Vida útil de `CortePage.tsx` (creada Inc 3, borrada en el cutover de Inc 7) | 2026-06-16 → 2026-07-10 = **24 días** en producción antes de reemplazo total |
| `src/lib/conversion.ts` (factor_conversion, H-11) | 91 líneas: sigue en el repo, **sin llamadas desde el motor de corte desde el 2026-07-03** (ADR-0008 lo prohibió ahí); el propio código dice que se conserva "para planeación (Inc 7)" — no se verificó si esa reutilización para planeación llegó a construirse (**NO DISPONIBLE** sin grep adicional de consumidores fuera de corte — ver nota abajo) |

Nota de verificación: `grep` sobre `src/` no encontró importadores de `conversion.ts` fuera de
`tests/conversion.test.ts` y el propio `corte.ts` (que ya no la invoca desde Inc 6.5). Es decir, **hay
código de producción (91 líneas + su suite de tests) que quedó sin ningún llamador activo** desde hace
al menos 11 días (2026-07-03 → 2026-07-14) — código muerto de facto, no borrado.

### B.3 Otras features con reescritura significativa

- **Registro de gastos**: `docs/prd-logiclean-v1_4-delta-corte-reparto.md` documenta que H-10 pierde su
  "criterio 4" (traducción por factor) pero conserva desglose de gastos — no hubo reescritura de
  `lib/gastos.ts` en sí (el archivo no aparece en el diff del cutover Inc 7).
- **Envasado** (`src/lib/envasado.ts`): migración 010 (2026-07-05) "simplifica formulario de envasado" —
  el gerente deja de capturar origen/residuo/consumo de granel, dos días después de que Inc 6.3 (PR
  #87, 2026-07-03) lo introdujera. Simplificación rápida, no reescritura completa — **NO DISPONIBLE**
  diff-stat exacto sin aislar el commit puntual (`85bf892`, 2026-07-05, -212/+321 en el rango de PR #93,
  que mezcla otros archivos; no se pudo aislar el archivo individual con certeza en el tiempo disponible).

### B.4 Migraciones: total y correctivas

**Total: 15 migraciones** (`001`–`015`) + **2 scripts SQL de operación manual en producción**
(`supabase/scripts/`).

| # | Migración | Corrige a | Tipo de corrección | Evidencia |
|---|---|---|---|---|
| 004 | `004_grants.sql` | 001–003 (mismo día, 2026-06-15) | **GRANT faltante** — RLS sin privilegios de tabla produce "permission denied for table" antes de evaluar cualquier política | Mensaje de commit: `fix(db): otorgar privilegios de tabla a authenticated (RLS necesita GRANT)`; comentario en el propio SQL explica el mecanismo |
| 014 | `014_corte_periodo_inicio_nullable.sql` | 011 (`corte_reparto`, 2026-07-08) | **Tipo equivocado** — columna `DATE NOT NULL` rechazaba el valor sentinela de "sin corte previo", el INSERT fallaba (400) y en cascada `corte_vendedor`/`liquidacion_movimiento` fallaban por FK (409), **dejando el corte atorado en la cola de sync** | Comentario del propio SQL cita el error de Postgres textual; commit `[T-error-sync-corte] fix:` (2026-07-14, 6 días después de 011) |

**2 de 15 migraciones (13%) son correctivas de una anterior.** Ninguna migración documenta un rollback
ejecutado (no se encontró ningún `DROP`/reversión de una migración ya aplicada en producción).

**Incidente de aplicación en producción (no es una migración con número, pero es corrección de facto):**
`supabase/scripts/2026-07-02_backfill_categoria_producto.sql` documenta que la migración 006, tal como
estaba escrita, **falló al aplicarse en el SQL Editor de producción** (el `ALTER COLUMN ... SET NOT NULL`
chocó con 2 filas huérfanas de fixtures de prueba, y Postgres revirtió toda la transacción, incluido el
`ADD COLUMN` inicial). Se resolvió corriendo los pasos por separado directamente contra producción. Esto
es evidencia dura de que **no hay entorno de staging que hubiera atrapado esto antes de tocar la base de
datos real** (ver Sección D).

---

## C. Dónde se cacharon los defectos realmente

### C.0 PR #1 — auto-verificación de hito (Inc 0), no revisión externa

El comentario en PR #1 (el propio autor corriendo `scripts/verify-hito-inc0.mjs` contra un proyecto
Supabase real, 15/15 checks) documenta **dos defectos reales encontrados y corregidos antes del merge**,
ambos en el subsistema de identidad/seguridad — el de mayor riesgo declarado del proyecto (T4/T1):

1. **bug-de-lógica**: el propio script de verificación leía el catálogo con el cliente Supabase
   **anónimo**, contradiciendo el modelo offline-first/RLS (que exige `auth.uid() IS NOT NULL`) —
   corregido en `a65c005`.
2. **seguridad/RLS**: confirma exactamente lo descrito en la Sección B.4/E — **las migraciones 001-003
   habilitaron RLS pero nunca otorgaron privilegios de tabla a `authenticated`**, así que *toda* consulta
   (incluida la del gerente) se rechazaba con `permission denied` antes de que RLS evaluara nada. El
   propio comentario admite que esto significaba que "el test de RLS bloqueando al vendedor" (paso 8)
   **pasaba por la razón equivocada** (todo estaba bloqueado, no solo lo que debía). Corregido con la
   migración `004_grants.sql` (`883f2de`).
3. Un tercer punto queda anotado como **pendiente abierto en el propio comentario**: `004_grants.sql` se
   había aplicado a mano en el SQL Editor de Supabase en vez de vía el flujo de migraciones del CLI,
   violando la convención propia del proyecto de que las migraciones son la única fuente de verdad. No
   se pudo confirmar si esto se resolvió antes del merge — el PR igualmente se fusionó. **NO DISPONIBLE**
   si quedó resuelto o quedó como deuda operativa desde el día 1 del proyecto.

Este hallazgo es relevante para la Sección E: la garantía "RLS + GRANT en cada tabla" **no nació correcta
— nació rota y se auto-corrigió dentro de la misma sesión que la introdujo**, antes de llegar a
`main`. Es la explicación completa detrás de la migración correctiva 004 (Sección B.4).

### C.1 Defectos de QA manual — Fase 5 (fuente: `docs/plan-verificacion-manual-qa.md`, tabla explícita)

| ID | Caso | Descripción | Severidad | Clasificación (este dossier) | PR(s) | ¿Reabierto? |
|---|---|---|---|---|---|---|
| D-004 | CP-015/018 | Ventas no se reflejaban en dashboard ni corte: faltaban `venta`/`linea_venta`/`cobro` en `PULL_TABLES` — la BD local del gerente no se hidrataba | **Crítico** | **sync/T1** (hidratación de pull, no de push) | #16 | No |
| D-005 | CP-020 | Alta de producto no persistía / sin feedback. 1ª causa: faltaba toast. Causa raíz real: `<form>` anidado disparaba submit prematuro | Mayor | **bug-de-lógica** (con síntoma de estado-faltante en el primer intento) | #17 → **#19 (reabierto)** | **Sí, 1 vez** |
| D-002 | CP-006 | Sin acceso a cobrar saldo de un cliente fuera de visita agendada | Mayor | **estado-faltante** (flujo faltante, no vacío/error, sino ruta de navegación) | #17 | No |
| D-001 | CP-004 | Monto mostraba `362.5` en vez de `362.50` | Menor | **cosmético/fidelidad** | #18 | No |
| D-003 | CP-010 | Campo "Día de ruta" no marcado obligatorio | Menor | **bug-de-lógica** (validación) | #18 | No |
| D-006 | CP-022 | Swipe en catálogo sin pista visual descubrible | Menor | **fidelidad/visual** | #18 | No |
| D-007 | CP-012 | Contraste bajo en tabs sobre navy bajo luz solar | Menor | **fidelidad/visual** | #18 → **#20 → #21 (reabierto 2×)** | **Sí, 2 veces** |

**2 de 7 defectos (29%) se reabrieron** al menos una vez antes del cierre real. **D-007 requirió 3
intentos** (`#18→#20→#21`) — causa raíz fue que `--color` no heredaba al `ion-segment-button` correcto;
se blindó después con fitness functions (`UIFIT-004/005`).

**¿El gate de fidelidad de Fase 3/4 debió atraparlo?**
- **D-001, D-006, D-007 son defectos puramente visuales/de fidelidad** (formato de moneda, affordance de
  swipe, contraste) — exactamente el tipo de hallazgo que un gate de fidelidad visual pre-Code debería
  detectar contra el prototipo aprobado, y en cambio se detectaron en **QA manual de Fase 5**, dos
  incrementos y varios días después de construidos.
- Refuerza esta lectura el propio **PR #7** (`fix/fidelidad-visual`, 2026-06-16, +1,342/-677 líneas,
  fusionado *inmediatamente después* de Inc 0-2): un PR dedicado exclusivamente a alinear pantallas del
  gerente al lenguaje visual (chip de sync, franjas de conectividad, CTAs de 58px) que en teoría ya
  debían venir correctas desde el prototipo de Fase 3. Es evidencia de que **el gap de fidelidad viajó
  a Code al menos dos veces**: una vez de forma masiva justo tras Inc 0-2 (PR #7), y otra vez en los
  defectos D-001/006/007 de Fase 5.

### C.2 Hallazgo de revisión — PR #105 (corte por reparto, Inc 7.4) — la única ronda de revisión real del proyecto

PR #105 se fusionó por squash (`c5253c0`, "(#105)"). La API de GitHub confirma la cronología exacta —
**el único caso en 120 PRs con un comentario de revisión real seguido de un commit de arreglo**:

`cfaf6ae` feat (05:00:53 UTC) → **comentario de revisión** (05:23:36) → `db8edcf` fix (05:25:58, **2
minutos** después del comentario) → comentario de confirmación (05:26:07) → merge (05:37:35). Ventana
total feat-a-merge: 37 minutos.

**Hallazgo 1 — estado-faltante, marcado explícitamente "bloqueante" en el comentario, y es exactamente
el banner de micro-estado de sync que el brief de esta auditoría pedía localizar:**
`DevolucionBodegaModal.tsx` (Paso 1 del wizard) sí encolaba la escritura offline correctamente
(`registrarDevolucion` → `enqueueOperation`), pero la UI solo mostraba un `IonToast` genérico de 3
segundos en caso de error — sin estado persistente de "pendiente" ni "error". El comentario cita
textualmente el NFR del PRD ("ambas mutaciones —devolución y acopio— deben mostrar los dos estados") y
contrasta con `PasoLaModerna.tsx`, que en ese momento **sí** tenía el banner con botón "Reintentar
ahora". Dato adicional de contexto que conecta con otra parte de la historia del repo: los PRs **#38,
#39 y #45** (2026-06-27/29) habían *retirado* deliberadamente el `ConnectivityStrip` por-vista en favor
de un único `SyncStatusBadge` de header global — esa consolidación nunca cubrió los banners locales de
pendiente/error *por mutación*, que es exactamente el tipo de estado que #105 dejó descubierto en uno de
dos pasos gemelos del wizard. Es decir: **el patrón ya se había caído una vez antes (global banner vs.
banner local) y volvió a caer aquí, sin que existiera una fitness function que lo blindara** (a
diferencia de D-005/D-007, que sí quedaron blindados con `UIFIT-*` tras su segunda reapertura).
Clasificación: **estado-faltante**.

**Hallazgo 2 — bug de lógica de borde:** en `PasoCierre.tsx` línea 149, `borderBottom: i <
salida.por_vendedor.length ? ... : 'none'` — la condición nunca es falsa (compara el índice contra la
longitud sin `-1`), así que la última fila de "Saldos de cierre → apertura del próximo" siempre dibuja
un borde, duplicando la línea divisoria antes de la fila de La Moderna. El comentario señala que el
patrón correcto ya existía 11 líneas antes en el mismo archivo (`i < ... .length - 1`). Clasificación:
**bug-de-lógica** (causa) con síntoma **cosmético** (efecto visible).

El comentario deja constancia explícita de que **no hubo objeciones al motor de dominio, al esquema, ni
a 3 de los 4 estados de borde obligatorios** (descuadre de identidad de control, La Moderna topada,
vendedor en negativo) — el bloqueo fue exclusivamente por estos dos hallazgos. El commit de arreglo
(`db8edcf`) los resuelve ambos y se confirma con `tsc --noEmit` limpio + 326/326 tests antes del merge.

### C.3 Commits de hotfix a `main` DESPUÉS de dar un incremento por "cerrado"

**Caso principal — motor de corte por reparto (Inc 7).** El PRD delta v1.4 declara Inc 7 "aprobado" y
"código mergeado" el 2026-07-08/09 (PRs #102-105, PR #105 con verificación manual **explícitamente
diferida** — el propio cuerpo del PR dice "no se pudo completar la pasada manual en navegador,
recomiendo una pasada antes de aprobar el merge"). Los siguientes 4 días acumulan una cadena de 5 PRs de
arreglo sobre el mismo motor:

| PR feat | PR/commit fix | Gap | Qué rompía |
|---|---|---|---|
| #105 (corte-reparto UI) | **#106** `T-corte-paso-2-layout` | 12.6 h | Problemas de layout/datos en el Paso 2 del wizard |
| #105 | **#109** "allow null periodo_inicio" (commit `b1ee8c0`, migración 014) | 92.6 h (3.9 d) | `periodo_inicio` en `''` sobre columna `DATE NOT NULL` → INSERT rechazado (400), cascada de 409 en `corte_vendedor`/`liquidacion_movimiento`, **corte atorado en la cola de sync** |
| #105 | **#110** "Defer acopio write until corte closure" (commit `589b7ce`) | 93.4 h (3.9 d) | El acopio a La Moderna podía registrarse sin un corte correspondiente — rompía la atomicidad que el diseño append-only asumía |
| #105 | **#111** "Use exact timestamp for period cutoff, not calendar date" (commit `8d47f71`) | 94.0 h (3.9 d) | Una venta del mismo día pero después de un corte confirmado (03:06:57) quedaba excluida del periodo por comparar fechas de calendario en vez de instante exacto — el corte confirmado a las 03:01:43 del mismo día calendario ya la dejaba fuera |
| #112 (feature de saldo, no Inc 7) | **#119** "la liquidación del corte no descontaba el efectivo ya retirado por abono" (commit `870b964`) | — | El motor de dominio (`domain/corte/motor.ts`) no conocía `abono_saldo_vendedor` — podía instruir al vendedor a entregar efectivo que ya se había retirado físicamente, **enmascarando un faltante real con La Moderna** |

Los 5 tocan directamente el **motor de dinero** (corte/liquidación). Ninguno se detectó en una revisión
de PR — todos llegan como `fix:`/PR de corrección después del hecho, en un subsistema que el propio
PRD ya había declarado "no pendiente".

**Caso de mayor escala — "Mi saldo" vendedor-negocio (#112→#120), 9 PRs en 16.45 horas, un solo día
(2026-07-14, el último día de actividad registrada del proyecto).** Cada PR cita explícitamente al
anterior en su propio cuerpo, y varios nombran al vendedor real de producción cuyo caso disparó el
hallazgo ("Eduardo"):

| PR | Qué corrige | Cita explícita del anterior |
|---|---|---|
| #112 | Ships "Saldo vendedor-negocio: visibilidad y abono" (feature nueva) | — |
| #113 (+0.34h) | Pantalla mostraba "Estás al corriente" a un vendedor con **$855 de cartera pendiente real** (`cxc_nueva`) — solo trackeaba el saldo vendedor-negocio, no la deuda de clientes | *"Follow-up al PR #112. En producción se detectó..."* |
| #114 (+0.15h) | El fix de #113 usaba `useVendedorResumen`, que solo calcula cartera **desde el último corte confirmado** — la venta de $855 era anterior al corte y seguía sin verse | *"Follow-up al PR #113. Tras fusionarlo, Eduardo seguía viendo..."* |
| #117 (+11.0h) | El estado "al corriente" ignoraba el honorario retenido reclamable, ocultando un saldo pendiente real | — |
| #118 (+0.44h) | Reclamar el honorario vía el FAB generaba una **deuda transitoria** en vez de saldar a $0 — `cxc_nueva` nunca se registraba como crédito en `saldo_vendedor_cierre` | — |
| #119 (+14.25h) | Ver tabla de arriba (liquidación no descontaba abono ya retirado) | *"Sigue a los fixes de #117/#118 (mismo caso real: retiro de honorario de Eduardo)"* |
| #120 (+16.45h) | Un retiro real era invisible para el gerente cuando el saldo neto contra un cobro compensatorio daba $0 — ocultaba un movimiento de caja auditable | — |

Esta cadena es la evidencia más concentrada de "reprocesamiento contra datos reales de producción,
después del cierre declarado" de todo el dossier: 9 PRs, un solo caso real de un vendedor con nombre,
en menos de 17 horas, todos sobre una feature que había salido apenas horas antes.

**Otros hotfixes post-cierre documentados:**

| Feat | Fix | Gap | Qué rompía |
|---|---|---|---|
| #17 (feedback alta de producto) | **#19** (`D-005` reabierto — Sección C.1) | 1.75 h | Causa raíz distinta a la de #17: `<form>` anidado |
| #18 (contraste tabs, intento 1) | **#20** → **#21** (`D-007` reabierto 2×) | 1.75 h / 0.87 h | `--color` se fijaba en el `ion-segment` padre; Ionic lo espera en `ion-segment-button` — el primer "fix" no tuvo efecto |
| **#22** ("Fase 6: despliegue, runbook, **CI gate**") | **#23** `fix(backup)` | 0.57 h | Los arreglos finales del script de backup se subieron a la rama **después** de que #22 ya se había mergeado — `main` quedó brevemente con un workflow de respaldo que fallaría cada lunes (evidencia de CI en Sección D.3: el check `pg_dump → artifact` de #22 estaba en `failure` en el momento del merge) |
| #71 (categorías de catálogo) | **#72** "catálogo en blanco cuando categoria no está backfillada" | 0.79 h | La migración 006 requería un backfill manual nunca corrido en producción; filas legacy con `categoria: undefined` se caían silenciosamente del agrupador — **catálogo completo en blanco en producción**, sin mensaje de estado vacío |
| #91 (carrito de recepción La Moderna) | **#101** "captura en piezas para productos por docena" | 86.3 h (3.6 d) | Campo de cantidad sin etiquetar la unidad de compra: un gerente tecleando "6" (piezas) registraba 6 docenas = **72 piezas** en el inventario de bodega — error de captura silencioso de una orden de magnitud |
| #41 (divide tab Hoy) | **#42** | 1.69 h | Una venta directa no se contaba como "visita" del día |

**Caso de proceso — PRs #75/#76/#77 (Inc 6.2-6.4):** el commit `bd45571` (PR #78, 2026-07-03) dice
textualmente: *"Corrige el destino de #75/#76/#77: sus merges habían quedado en ramas intermedias
(inc-6.1/inc-6.2/inc-6.3) en vez de main."* — no es un bug de código, es un **error de flujo git**: tres
PRs se fusionaron contra la rama incorrecta y tuvieron que volver a traerse a `main` explícitamente. Mismo
día, sin impacto documentado en producción porque se corrigió antes de que esas ramas se consideraran
"live".

### C.4 Incidentes en producción / fixes de emergencia

- **Migración 006 / backfill de categoría** (2026-07-02): incidente de aplicación en producción, ya
  descrito en B.4 — transacción revertida en el SQL Editor real, corregida con intervención manual
  documentada.
- **`4f5ae39` — `fix(pwa): recarga real ante fallo de chunk por deploy obsoleto` (PR #25, 2026-06-20)**:
  corrige un fallo de carga en producción causado por code-splitting + deploy (chunk hash obsoleto en el
  Service Worker) — clase de incidente típica de PWA con cache agresivo. Es la razón de ser de
  `ChunkErrorBoundary.tsx`.
- **`7ebd0b4` — `fix(auth): denegar sesiones sin rol válido` (PR #24, 2026-06-20)**: clasificación
  **seguridad/RLS** — una sesión autenticada sin rol asignado no se rechazaba explícitamente.
- No se encontró evidencia de un incidente de pérdida de datos, ni de un rollback de despliegue en
  Vercel — **NO DISPONIBLE** (no hay acceso al dashboard de Vercel/Supabase desde este entorno de
  auditoría; esta sección se limita a lo reconstruible desde el repo).

---

## D. Realidad de pruebas y CI

### D.1 Suite de pruebas (verificado ejecutando la suite, no solo leyendo config)

- **Framework:** Vitest 4.1.9 (`@vitest/coverage-v8` para cobertura).
- **Ejecución real (`npm ci && npm test`):** **37 archivos de test, 349 tests, todos en verde**, 5.46s.
- **Cobertura real (`npm run test:coverage`):**

  | Ámbito | % Statements | % Branch | % Funcs | % Lines |
  |---|---|---|---|---|
  | Global (archivos alcanzados por algún test) | 82.5% | 70.36% | 82.41% | 83.36% |
  | `src/domain/corte/motor.ts` (motor de dominio del corte) | **97.18%** | 86.84% | **100%** | 98.48% |
  | `src/lib/corte.ts` | 96.55% | 82.35% | 94.11% | 97.36% |
  | `src/lib/corteReparto.ts` | 97.84% | 83.01% | 95.12% | 98.14% |
  | `src/sync/queue.ts` | 41.66% | 0% | 42.85% | 45.45% |
  | `src/lib/dashboard.ts` | 32.2% | 25% | 20% | 29.78% |

  **Importante:** vitest/v8 solo instrumenta archivos que algún test importa — no hay `coverage.all:
  true` en `vite.config.ts`. Esto significa que el 82.5% es cobertura **de la capa de lógica pura
  (`src/lib`, `src/domain`, `src/sync`)**, no del proyecto completo. **No existe una sola prueba de
  componente React** (no hay `@testing-library/react` ni equivalente en `package.json`, y ningún test
  importa un archivo `.tsx` salvo `tests/corte-reparto-ui.test.ts` y `tests/ui-fitness.test.ts`, que
  hacen aserciones estructurales/estáticas sobre el código fuente en texto, no renderizado). **0% de
  cobertura de ejecución real en `src/pages`, `src/hooks` (salvo lo re-exportado) y `src/components`.**

- **¿La capa de dominio del corte es testeable sin UI?** **Sí, cumple.** `src/domain/corte/motor.ts` y
  `types.ts` no importan nada de `src/db`, `src/pages`, `@supabase` ni React (`grep` confirma que el
  único `import` en `motor.ts` es un `import type`). El NFR de "testeable sin UI" para la capa de corte
  **se cumple literalmente**, y su cobertura (97-100%) lo confirma con evidencia de ejecución, no solo de
  diseño.

### D.2 Test-first vs. test-after

Verificado por commit (no solo por fecha) para una muestra: en **todos los casos verificados**, el
archivo de test se creó **en el mismo commit** que el archivo de lógica que prueba:

| Feature | Commit | Fecha |
|---|---|---|
| `lib/cobros.ts` + `tests/cobros.test.ts` | `b7e9e4d` | 2026-06-17 |
| `lib/ventas.ts` + `tests/ventas.test.ts` | `9a7f63b` | 2026-06-16 |
| `domain/corte/motor.ts` + `tests/corte-reparto.test.ts` | `c494c67` | 2026-07-09 |

**No hay evidencia de un lote de tests escrito después, en Fase 5, para código ya construido antes.** Lo
que sí ocurrió en Fase 5 fue la adición de **fitness functions nuevas** (`UIFIT-001…006`) específicamente
para blindar contra la reaparición de D-005/D-007 — eso es test-after, pero de regresión sobre defectos
ya encontrados, no relleno de cobertura retroactivo de features viejas.

### D.3 CI (`.github/workflows/ci.yml`)

```yaml
on: pull_request, push a main
jobs: lint → test → build   (npm run lint / npm test / npm run build)
```

- **Corre en cada PR y en cada push a `main`.** El comentario del propio workflow dice "Debe quedar en
  verde para fusionar — protege la rama de producción".
- **Sí corre lint y test.** El "typecheck" no es un paso separado: `npm run build` es `tsc -b && vite
  build`, así que un error de tipos rompe el build y por tanto el CI.
- **¿Bloquea el merge? — evidencia dura vía API, no solo lectura del YAML.** El CI **no existió desde el
  día 1**: PRs #1, #5, #10, #15 (2026-06-15 a 17) tienen **0 check runs** — no había ningún gate. El
  workflow `lint · test · build` se introduce recién en **PR #22** ("Fase 6: despliegue, runbook, CI
  gate", 2026-06-20) — es decir, **los primeros ~21 PRs (Inc 0 a 5 completos + toda la Fase 5 de QA) se
  mergearon sin CI de ningún tipo.** Y el propio PR #22, el que introduce el gate, **se fusionó con uno
  de sus 4 checks en estado `failure`** (`pg_dump → artifact`, el workflow de respaldo) — 37 segundos
  después de que ese check reportara el fallo. Esto es la causa raíz directa del hotfix #23 (Sección
  C.3).
  A partir de PR #23 el patrón se estabiliza: en una muestra de los 15 PRs más recientes (#106-#120,
  2026-07-10 a 14) los 2 checks (`lint · test · build` + Vercel) están en `success` en el 100% de los
  casos, y el timestamp de finalización del check **siempre precede al merge** (11-65 segundos antes),
  con ventanas de apertura-a-merge de **0.82 a 14.18 minutos** — consistente con "el operador espera a
  que CI cierre en verde y mergea de inmediato", no con revisión humana intermedia.
  **Si `lint · test · build` es un *required status check* configurado en la protección de rama de
  GitHub no se pudo confirmar** — la consulta a `branches/main/protection` devolvió `403 Resource not
  accessible by integration` con el token disponible en esta auditoría. **NO DISPONIBLE** para la
  configuración formal; la evidencia *comportamental* (verde antes de cada merge, sin excepciones desde
  #23) es la de arriba.
- **No corre `test:coverage`** en CI — el script existe en `package.json` pero no aparece en
  `ci.yml`. No hay umbral de cobertura enforced.
- Otros workflows: `backup.yml` (pg_dump semanal) y `keepalive.yml` (ping cada 12h contra la pausa del
  plan free de Supabase) — ambos operativos, no de calidad de código.

### D.4 Monitoreo, observabilidad y staging

- **Sin servicio de error-tracking/monitoreo** (no hay Sentry, LogRocket ni equivalente en
  `package.json` ni en `src/main.tsx`). Existe `ChunkErrorBoundary.tsx`, pero solo hace
  `console.error(...)` — no reporta a ningún servicio externo.
- **Sin entorno de staging.** `vercel.json` no define entornos; no hay segundo proyecto Supabase
  referenciado en ningún doc (`.env.example` solo tiene un juego de variables). El incidente de la
  migración 006 (Sección B.4/C.4) es la prueba directa de esto: la única forma de detectar el problema
  fue aplicando contra producción real.
- Vercel probablemente genera preview deployments automáticos por PR (comportamiento por defecto de la
  plataforma), pero **no hay confirmación de que esos previews apunten a un Supabase separado** — dado
  que solo existe un juego de credenciales documentado, es más probable que los previews (si se usan)
  compartan la base de producción. **NO DISPONIBLE** sin acceso al dashboard de Vercel.

---

## E. Adherencia arquitectura ↔ implementación

| Decisión arquitectónica | Estado | Evidencia |
|---|---|---|
| **Sync idempotente con UUID generado en cliente** | ✅ **Cumple** | `src/lib/uuid.ts` usa `crypto.randomUUID()` para toda PK; `src/sync/SyncEngine.ts:205` hace `.upsert(payload, { onConflict: 'id' })`; comentarios explícitos en `queue.ts`/`pull.ts` confirman el patrón upsert-por-id en ambas direcciones (push y pull) |
| **RLS + GRANT explícito en cada tabla** | ✅ **Cumple (con una lección aprendida documentada)** | Migración 004 tuvo que corregir que 001-003 nunca otorgaron GRANT (Sección B.4) — pero las migraciones posteriores que crean tablas nuevas (007, 011, 015) **incluyen GRANT + RLS en el mismo archivo** y citan explícitamente "lección ADR-0004" en el comentario del SQL. El patrón se corrigió y se institucionalizó. |
| **`service_role` nunca en cliente ni repo** | ✅ **Cumple** | `grep -r "service_role"` en todo el repo solo encuentra comentarios/documentación que *advierten* no usarla ahí, y una mención en `003_roles.sql` sobre cómo asignar rol *desde* service_role (uso server-side legítimo). `.env.example` no contiene ninguna clave real, solo placeholders. El script `seed-inc6-relanzamiento.mjs` sí requiere `SUPABASE_SERVICE_ROLE_KEY` mencionado en su comentario, pero como variable de entorno esperada en ejecución local del PM, no hardcodeada. |
| **Precio congelado al momento de la venta** | ✅ **Cumple** | Esquema: `linea_venta.precio_unitario DECIMAL(12,2) NOT NULL` (columna propia, no solo FK a `presentacion`). Código: `precio_unitario: precioUnitario(l.presentacion, cliente.tipo)` se calcula y **se escribe** al momento de `registrarVenta`. Confirmado también por QA: `docs/trazabilidad-qa-fase5.md` fila H-13 anota explícitamente "precio se congela al vender desde el nuevo valor" con test `CAT-103`. |
| **Chip de estado de sync presente en toda pantalla operativa** | ⚠️ **Parcial** | NFR textual: *"Chip de estado de sincronización... presente de forma permanente en toda pantalla operativa"* (`docs/handoff-logiclean-venta-prospectos.md`). 26 pantallas/componentes usan `SyncStatusBadge`. Pero **`src/pages/clientes/ClienteDetallePage.tsx`** — el perfil unificado del cliente, con FAB "VENDER" siempre disponible y secciones de cobro/entrega/seguimiento, descrito en su propio docstring como pantalla operativa central del vendedor — **no importa `SyncStatusBadge`**. Además, el propio historial confirma que este NFR ya había fallado una vez y se corrigió reactivamente (PR #105 / `db8edcf`, Sección C.2), lo que sugiere que no hay una verificación estructural (fitness function) que impida la regresión, a diferencia de D-005/D-007 que sí la tienen. |

### E.1 Marcadores de deuda técnica (TODO / FIXME / HACK)

**0 ocurrencias** de `TODO`, `FIXME` o `HACK` como marcador de código en `src/`. (Dos falsos positivos
de `grep` son la palabra española "TODOS" dentro de comentarios, no marcadores de deuda.) Esto puede
leerse de dos formas, y ambas son plausibles sin poder distinguirlas con la evidencia disponible:
(a) disciplina real de no dejar deuda marcada sin resolver, o (b) la deuda no se marca explícitamente y
en su lugar se gestiona fuera del código (Notion, conversación con el PM) — **NO DISPONIBLE** para
determinar cuál explica el 0.

### E.2 ADRs referenciados sin documento propio

`docs/adr/` solo contiene **ADR-0001 a ADR-0005 y ADR-0011** (6 archivos). Sin embargo, el código y los
docs **citan ADR-0006 a ADR-0010 como decisiones ya tomadas y vigentes** (ej. "ADR-0008 prohíbe el
factor en el cuadre del corte", "ADR-0006: la recepción a bodega es la fuente única del suministro"),
sin que exista un archivo `docs/adr/ADR-0006-*.md` … `ADR-0010-*.md`. **5 de 11 decisiones arquitectónicas
referenciadas por número (45%) nunca se formalizaron como documento ADR**, a diferencia de ADR-0011 que
sí tiene su documento completo con contexto/alternativas/consecuencias. Esto es un hueco de trazabilidad
del propio proceso, no del código.

---

## F. Narrativa de ejecución ("cómo se llevó el desarrollo")

> **Advertencia de fuente:** esta sección se reconstruyó **exclusivamente desde metadata de git y PR**
> (mensajes de commit, diffs, nombres de rama, docs versionados). **No se tuvo acceso a transcripciones
> de sesión de Claude Code previas** — no hay forma de verificar desde este entorno qué se conversó con
> el PM fuera de lo que quedó escrito en un commit o en un doc versionado. Todo lo que sigue es
> inferencia razonable a partir de artefactos escritos, no un relato verificado de la sesión real.

### F.0 El control de calidad real fue auto-verificación dentro de la sesión, no revisión externa

Dato duro de la Sección A.1/C.0/C.2: **0 reviews formales en 120 PRs**, y solo 1 PR con un intercambio de
revisión real. Esto no significa que no hubo control de calidad — los dos casos donde sí se detectaron
defectos antes del merge (PR #1: bug de RLS/GRANT + bug de cliente anónimo; PR #105: banner de sync
faltante + bug de borde) se detectaron porque el propio autor corrió una verificación explícita
(`verify-hito-inc0.mjs`, o una relectura contra el NFR del PRD) **antes de pedir el merge**, no porque un
segundo par de ojos humano lo señalara después. El mecanismo de calidad de este proyecto fue, en la
práctica, **autoverificación de una sola sesión**, con el PM interviniendo en decisiones de negocio
(Sección F.3) pero no en revisión línea por línea de código. Esto reencuadra la pregunta "¿dónde se
atascó o requirió intervención del PM?" — la intervención del PM en este proyecto fue casi siempre de
**producto/alcance/dato de negocio**, nunca de calidad de implementación vía revisión de PR.

### F.1 Cambio de cadencia a mitad de proyecto

Inc 0–5 (2026-06-15 a 17, 3 días) se construyeron como **~9 PRs grandes**, uno por incremento o
sub-fase, con nombres de rama que siguen la convención `inc-N/nombre`. A partir de Inc 6 (2026-07-03) el
patrón cambia a **decenas de PRs de una sola tarea** (`[T-nombre-tarea]`), muchos de una sola pantalla o
un solo bug, con nombres de rama generados automáticamente (`claude/eager-cray-5ur89l`,
`claude/order-date-single-selection-psw80b`). Esto coincide con el cierre de Fase 6 (25 jun, según
`CLAUDE.md`) y el paso a Fase 7 · Operación, donde el patrón de trabajo pasa de "construir incrementos
del PRD" a "atender pedidos puntuales del PM/cliente en producción" — es un cambio de modo de trabajo
documentable, no solo una impresión.

### F.2 Un commit sin PR asociado (Inc 5)

El commit `b7e9e4d` (`feat(inc-5): cobranza en ruta`, 2026-06-17) es el único incremento completo que
**no tiene un commit de merge de PR identificable** en su historial inmediato — a diferencia de Inc 0-4,
que sí tienen "Merge pull request #N" explícito. No se pudo determinar desde git si esto fue un push
directo a `main` sin pasar por revisión de PR, o si el merge fue squash y el número de PR simplemente no
quedó en el mensaje. **NO DISPONIBLE** para confirmar cuál de las dos.

### F.3 Puntos donde el propio código/commit señala una limitación o pide validación externa

- **Inc 6.5 (corte por consumo real, dinero real):** el mensaje de commit dice explícitamente *"No hay
  acceso a datos de producción reales desde este entorno; el fixture es representativo, no un corte
  histórico real"*, y el commit de merge anota *"Aprobado por el PM (2026-07-03): sin datos históricos de
  cortes reales disponibles, la regresión sintética multi-producto... es la verificación disponible"*.
  Es decir: **el motor de dinero se reescribió y se aprobó para producción sin poder validarlo contra un
  corte real histórico**, por ausencia de acceso a esos datos desde el entorno de ejecución — una
  limitación estructural del setup, señalada explícitamente en vez de ocultada, pero limitación al fin.
- **Script de cutover del relanzamiento** (`T-inc6.6-migracion-relanzamiento`, 2026-07-03): el commit
  abre con *"⛔ Punto de parada del README maestro: no lo ejecutes por tu cuenta"* y cierra con *"Merging
  este PR es seguro... lo que NO se debe hacer sin el PM es CORRERLO"* — el script se entrega en modo
  dry-run por defecto, requiere `--apply` explícito y credenciales `service_role` que Claude Code no
  tenía en ese entorno. Es un caso claro de **autolimitación explícita ante una operación irreversible
  sobre datos reales de negocio**, delegada correctamente al humano.
- **Carga/devolución a bodega** (PR #78, 2026-07-03): *"Decisión de PM (2026-07-03): el ajuste manual
  existente de `InventarioPage` se deja intacto — no está en el PRD delta retirarlo"* — evidencia de una
  decisión de scope tomada por el PM a media construcción, documentada en el commit en vez de
  asumida.
- **IVA recalculado** (H-06, 2026-06-17): *"Decisión del sponsor (2026-06-17): el MVP recalcula IVA"* —
  otra decisión de negocio capturada en el commit, en el mismo día en que se construyó H-06, sugiriendo
  que la aclaración se pidió y se resolvió dentro del ciclo de esa misma tarea, no que se adivinó.

### F.4 Rehecho por error de proceso, no de código

El caso de PRs #75/#76/#77 fusionados contra ramas intermedias en vez de `main` (Sección C.3) es el
único ejemplo claro, en toda la historia auditada, de una **corrección de flujo de git** (no de lógica
de negocio ni de UI) — sugiere que en el tramo de mayor paralelismo de tareas (Inc 6, seis
sub-incrementos el mismo día) hubo al menos un tropiezo mecánico de "a qué rama apunta este PR", resuelto
en el mismo día sin quedar expuesto en producción.

### F.5 Lo que esta sección NO puede afirmar

Sin transcripciones de sesión, este dossier **no puede** describir: cuántas veces Claude Code le
preguntó algo al PM y no obtuvo respuesta a tiempo; cuánto tiempo de una sesión se fue en exploración
antes de escribir código; si hubo intentos de solución descartados antes del commit final que sí quedó
en el historial (el historial de git solo muestra el resultado que se decidió commitear, no el camino
para llegar ahí); ni el tono o la fricción real de la interacción PM↔Claude Code más allá de lo que
quedó por escrito en mensajes de commit. Cualquier afirmación sobre esos puntos que no cite un commit,
PR o doc específico de este repo **no es evidencia — es especulación**, y se excluyó de este dossier.

---

## Resumen ejecutivo de cifras duras

| Métrica | Valor |
|---|---|
| Commits totales en `main` | 212 |
| PRs totales (confirmados 1:1 vía API de GitHub) | **120 / 120**, todos mergeados, todos del mismo autor |
| Líneas +/- agregadas, los 120 PRs | +51,066 / −7,833 |
| Ventana temporal Inc 0 → hoy | 29 días corridos (2026-06-15 → 2026-07-14) |
| Tests automatizados (ejecutados, no contados en código) | 349, 37 archivos, 100% verdes |
| Cobertura de la capa de lógica pura (statements) | 82.5% |
| Cobertura de `domain/corte/motor.ts` | 97.18% |
| Cobertura de componentes UI React | 0% (sin tests de componente) |
| **Reviews formales de PR (`APPROVE`/`REQUEST_CHANGES`) en 120 PRs** | **0** |
| **PRs con ronda de revisión real (comentario → fix → merge)** | **1 de 120** (PR #105) |
| Migraciones SQL totales | 15 |
| Migraciones correctivas de una anterior | 2 (13%) |
| Incidentes de aplicación en producción documentados | 1 (migración 006, 2026-07-02) |
| Defectos de QA Fase 5 | 7 (D-001…D-007), 2 reabiertos (29%), uno de ellos 3 intentos (D-007) |
| PRs de la primera cola CI (#1-#21, Inc 0-5 + Fase 5 completas) | Mergeados con **0 checks de CI** — el gate no existía aún |
| PR que introduce el gate de CI, mergeado con un check en `failure` | PR #22 (`pg_dump → artifact`) |
| ADRs con documento formal vs. referenciados | 6 documentados / 11 referenciados (55%) |
| Marcadores TODO/FIXME/HACK en `src/` | 0 |
| Cadena de hotfix más grande post-"cierre" (mismo día, un caso real de producción) | 9 PRs (#112→#120) en 16.45 horas |
| Hotfixes al motor de corte en los 4 días posteriores al "cierre" de Inc 7 | 5 (#106, #109, #110, #111, #119) |
| Vida de `CortePage.tsx` (Inc 3) antes de reemplazo total | 24 días |
