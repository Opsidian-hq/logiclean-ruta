# Logiclean Ruta

App de venta en ruta offline-first para Logiclean: registra ventas, pedidos, cobranza y gastos, sostiene el seguimiento de prospectos con recordatorios de visita, y produce un corte semanal confiable. Proyecto Opsidian — *del caos al orden*.

> **Estado:** Fase 4 · Construcción · arrancando por el **Incremento 0 — Cimientos**.
> El *porqué* de cada decisión vive en `docs/` (PRD, ADRs, modelo, plan). Léelos antes de tocar código.

## Stack

- **React + Ionic React sobre Capacitor**, como PWA (ver `docs/adr/ADR-0002`, `ADR-0005`).
- **Estado ligero: Context + hooks de React.** Sin librería de estado formal (Redux, MobX, etc.). El único estado compartido real es la cola offline y el estado de conexión.
- **Supabase Cloud:** Postgres + Auth + RLS (`docs/adr/ADR-0003`, `ADR-0004`).
- **Offline-first** (`docs/adr/ADR-0001`): la app opera sin conexión y sincroniza al recuperarla, sin pérdida ni duplicado.

## Estructura

```
logiclean-ruta/
├─ docs/                  # línea base congelada Fase 2 (NO se edita sin un nuevo ADR/versión)
│  ├─ prd-logiclean-v1_2.md
│  ├─ modelo-datos-logiclean.md
│  ├─ plan-incrementos-riesgos-logiclean.md
│  ├─ handoff-logiclean-venta-prospectos.md
│  ├─ brief-sistema-diseno-logiclean.md
│  ├─ prompt-arranque-inc0-claude-code.md   # el prompt que se pega en Claude Code
│  ├─ adr/                # ADR-0001 … ADR-0005
│  └─ prototipo/          # prototipo aprobado (Fase 3)
├─ src/                   # app React + Ionic React        (Inc 0)
├─ supabase/              # config, migraciones, políticas RLS  (Inc 0)
├─ scripts/               # pg_dump de respaldo, keep-alive       (Inc 0)
└─ capacitor.config.ts
```

## Convenciones (decididas al cierre de Fase 2 — no se improvisan)

- **PKs UUID generadas en cliente** (no autoincrementales): base de un sync idempotente y sin colisión de folios.
- **Baja lógica** (`activo = false`), nunca DELETE físico: preserva el histórico de cortes.
- **Las migraciones son la única fuente de verdad** del esquema; nunca se cambia la BD remota a mano.
- **Cada política RLS = un caso de prueba.** La llave `service_role` nunca en el cliente ni en el repo.
- `INVENTARIO_VEHICULO.cantidad` es un contador que se decrementa (seguro: cada vendedor es dueño único de su dispositivo).
- `CLIENTE` lleva `dia_ruta` + `fecha_proxima_visita` (una sola visita viva). No existe `VISITA_PROGRAMADA` (extensión futura).

## Flujo de trabajo

Una rama / PR por incremento del plan de Fase 2. Se arranca por `inc-0/cimientos`. El PR no se da por listo hasta que el hito del incremento se demuestre de punta a punta.

## Por dónde empezar

Pega `docs/prompt-arranque-inc0-claude-code.md` en Claude Code dentro de este repo: trae el contexto, el alcance y los criterios de aceptación del Incremento 0.
