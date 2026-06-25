# CLAUDE.md — Logiclean Ruta
> Instrucciones permanentes para este proyecto. Claude Code las lee al arrancar cada sesión.

---

## Contexto del proyecto

Logiclean Ruta es una PWA de venta en ruta construida con **React + Ionic + Capacitor** sobre **Supabase** (auth, RLS, sync offline). El tracker operativo vive en **Notion** y se actualiza vía MCP al terminar cada acción relevante.

- **Proyecto en Notion:** Logiclean Ruta (`https://app.notion.com/p/389b4abbc878816d808dd28808f49795`)
- **Fase actual:** 7 · Operación
- **Fase 6 · Despliegue y entrega:** Completada (gate 3/3 — capacitación y handover al cliente cerrados el 25 jun 2026)

---

## Protocolo de sincronización con Notion

### Regla general
**Al terminar cualquier acción que cambie el estado del proyecto, actualiza Notion antes de responder que terminaste.** No es opcional ni "si tengo tiempo" — es parte de la definición de "tarea completada".

### Tabla de eventos → acciones en Notion

| Cuando… | Actualizas en Notion… |
|---|---|
| Se completa una tarea | Tarea → Estado = **Completada** |
| Se inicia una tarea | Tarea → Estado = **En curso** |
| Se bloquea un grupo de tareas | Grupo → **Bloqueado = ✓** + anota el motivo en Propósito |
| Se resuelve un bloqueo | Grupo → **Bloqueado = ☐** |
| Se verifica un incremento | Incremento → Estado = **Verificado** |
| Se cierra un incremento | Incremento → Estado = **Cerrado** |
| Se cumple un criterio de gate | Criterio → Estado = **Cumplido** + agrega evidencia (ref. commit/PR) |
| Se cumplen todos los criterios de una fase | Fase → Estado = **Completada** |
| Se activa la siguiente fase | Fase siguiente → Estado = **En curso** |
| Se detecta un riesgo nuevo | Crea fila en Riesgos → Estado = **Abierto** |
| Se mitiga un riesgo | Riesgo → Estado = **Mitigado** + anota la mitigación |
| Se cierra un riesgo | Riesgo → Estado = **Cerrado** |
| Se mergea un PR relevante | Tarea relacionada → Ref GitHub = `#PR-número` o `commit-hash` |

### Cómo referenciar tareas

Las tareas en Notion están bajo la base **Tareas**, relacionadas a **Grupos de tareas** → **Fases** → **Proyecto**. Para encontrar la tarea correcta:
1. Busca por nombre en Notion MCP.
2. Si no existe, créala bajo el grupo correcto de la fase activa.
3. Nunca dejes tareas flotando sin grupo.

### Cuándo NO actualizar Notion

- Cambios experimentales o branches temporales que no llegaron a `main`.
- Refactors internos sin impacto en funcionalidad verificada.
- Cuando explícitamente se te diga "esto es exploración, no lo registres".

---

## Fases y estado actual

```
0 · Encuadre y diagnosis      ✅ Completada
1 · Discovery y definición    ✅ Completada
2 · Diseño de solución        ✅ Completada
3 · Diseño de detalle         ✅ Completada
4 · Construcción              ✅ Completada
5 · Verificación y QA         ✅ Completada
6 · Despliegue y entrega      ✅ Completada
7 · Operación                 🟡 En curso  ← FASE ACTIVA
```

### Gate de Fase 6 (3 de 3 cumplidos) ✅
- [x] Runbook de operación entregado
- [x] Despliegue verificado en producción
- [x] Capacitación y handover al cliente completados (vendedor de mayoreo + instalación PWA) — 25 jun 2026

La Fase 6 quedó cerrada el 25 jun 2026 y la Fase 7 · Operación está activa. Próximo foco:
monitoreo en operación, soporte post-arranque y atención de incidencias.

---

## Stack técnico (referencia rápida)

- **Frontend:** React + Ionic 7 + Capacitor 5
- **Backend:** Supabase Cloud (PostgreSQL + Auth + Realtime)
- **Sync offline:** Motor propio (BD local ↔ servidor), cola de operaciones pendientes
- **Deploy:** PWA en Vercel; build nativo vía Capacitor para Android
- **Auth:** Supabase Auth con RLS por rol (vendedor / gerente / admin)
- **Repo:** GitHub — commits referencian tareas con formato `[T-nombre-tarea] descripción`

---

## Convención de commits

```
[T-nombre-tarea] tipo: descripción breve

Ejemplos:
[T-keep-alive] fix: corrige reconexión tras timeout de red
[T-capacitacion-mayoreo] docs: agrega guía de onboarding del vendedor
```

El campo **Ref GitHub** en cada Tarea de Notion recibe el hash del commit o el número de PR.

---

## Al arrancar una sesión nueva

1. Pregunta en qué incremento o tarea se va a trabajar hoy.
2. Busca esa tarea en Notion y verifica su estado actual.
3. Si está en To-do, cámbiala a **En curso** antes de empezar.
4. Al terminar la sesión, actualiza el estado de todo lo que se tocó.
