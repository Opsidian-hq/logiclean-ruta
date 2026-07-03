# Inc 6 · Inventario de bodega y envasado — README maestro de construcción
### Orquestación Fase 4 · proyecto Opsidian · Logiclean Ruta

Este documento le dice a Claude Code **cómo construir todo Inc 6, en orden, sin volver al chat entre rebanada y rebanada**. No reemplaza los documentos de referencia: los orquesta. Léelos primero; este README es el mapa.

## Documentos de referencia (autoridad, en este orden)
1. `prd-logiclean-v1_3-delta-inc6.md` — el qué y los criterios de aceptación (revalidado por el sponsor).
2. `modelo-datos-inc6-bodega-envasado.md` — entidades, contadores, efecto de cada evento, RLS, migración.
3. `ADR-0006`…`ADR-0010` — las decisiones de arquitectura aceptadas y su porqué.
4. `plan-inc6-bodega-envasado.md` — las seis sub-rebanadas, su hito y la Definición de Hecho.
5. `handoff-inc6.1-bodega-esquema-sync.md` — el handoff detallado de la primera rebanada.
Además, ya en el repo: PRD v1.2, ADR-0001…0005, modelo y plan base.

## Reglas del método (no se rompen)
- **Regla de cascada.** Si al construir una rebanada descubres que hace falta cambiar el esquema, el modelo o el PRD, **eso cascada hacia atrás por los documentos y se consulta al PM** — no se inventa en el código. El orden es PRD → modelo → plan → implementación, **nunca directo a implementación**.
- **Una rama/PR por rebanada.** No un PR monolítico de Inc 6. Nombres de rama indicados por rebanada abajo.
- **Copia los criterios de aceptación del PRD delta, no los reinterpretes.** Son los que QA verificará en Fase 5.
- **Definición de Hecho por rebanada** (del plan): código revisado · pruebas verdes · criterios cumplidos · accesibilidad básica · documentación actualizada · sin defectos críticos. Una rebanada no se cierra sin esto.
- **Fase 3 se omitió por decisión del PM.** No hay prototipo. Por eso, en cada rebanada con pantalla, **tú propones la composición** sobre el sistema de diseño del admin que ya existe (reutiliza los componentes reales de `src/pages/admin/` y sus formularios; no inventes componentes), cubres **todos los estados** (vacío, carga, éxito, error, y offline donde aplique), y **para las pantallas no triviales (envasado y el corte rediseñado) subes la composición al PM antes de finalizar**. Eso sustituye al prototipo que no se hizo.
- **Offline-first (ADR-0001) intacto**, con una sola excepción registrada: **la carga al vehículo es online** (ocurre en bodega con internet). Recepción, envasado y devolución sí operan offline.

## Secuencia de construcción

### 6.1 — Esquema, contadores, eventos, sync idempotente  ·  rama `inc-6.1/bodega-esquema-sync`
Handoff detallado: `handoff-inc6.1-bodega-esquema-sync.md`. Es el cimiento; nada de UI. **Empieza aquí.**
- **Hito:** un evento de bodega se crea offline, sincroniza sin duplicar, contador materializado correcto.

### 6.2 — Recepción + suministro como rollup  ·  rama `inc-6.2/recepcion-suministro`
Gobierna ADR-0006. Historia **H-16** (criterios en el PRD delta §5). Pantalla de recepción del gerente; `movimiento_la_moderna` (recibido) alimenta el rollup `suministro_la_moderna`; **retira la captura manual de `/admin/negocio`** como fuente de suministro.
- **Fuera de alcance:** envasado, carga, corte.
- **Hito:** registrar una recepción sube el inventario de bodega y el recibido del suministro, sin captura aparte.

### 6.3 — Envasado con rendimiento real  ·  rama `inc-6.3/envasado`
Gobierna ADR-0007. Historia **H-17**. Pantalla de envasado: `origen` bidón nuevo / granel, líneas de presentaciones que salen, residuo estimado. Mueve contadores según la tabla del modelo. **Pantalla no trivial → sube la composición al PM antes de finalizar.**
- **Fuera de alcance:** el corte; el rol del factor de conversión (eso es 6.5).
- **Hito:** envasar un bidón de 20 L registra presentaciones y residuo; el inventario de bodega lo refleja; queda la traza de rendimiento.

### 6.4 — Carga y devolución a bodega  ·  rama `inc-6.4/carga-devolucion`
Historias **H-18 / H-19**. Carga (online, en bodega) descuenta de bodega y sube al vehículo; devolución vehículo → bodega. Se conecta con `inventario_vehiculo` existente.
- **Hito:** cargar desde bodega, vender, devolver al cierre — todo cuadra.

### 6.5 — Corte por consumo real + identidad de control  ·  rama `inc-6.5/corte-consumo-real`
Gobierna ADR-0008/0009/0010. Historia **H-10** (actualizada). Reescribe la reconciliación: saca el factor del cuadre (degrádalo a planeación, no lo borres); adeudo = `(recibido − devuelto) × precio`; devolución de sellados a La Moderna al cierre; evalúa la identidad `recibido − devuelto = abiertos` y **alerta** si no cuadra.
- ⛔ **PUNTO DE PARADA — decisión del PM.** Esto es **código en producción** (toca `src/lib/corte.ts`, `conversion.ts`, `suministro.ts`, `useCorte.ts`). Antes de mergear: corre **pruebas de regresión contra cortes históricos reales** y **sube el resultado al PM para aprobación explícita**. No mergees 6.5 sin ese visto bueno.
- **Hito:** un corte reconcilia por consumo real, muestra el inventario de bodega y alerta si la identidad falla; el cuadre histórico no se rompe.

### 6.6 — Migración y relanzamiento (cutover)  ·  rama `inc-6.6/migracion-relanzamiento`
Conteo físico de apertura → seed de contadores → reset de `inventario_vehiculo` → congelar `/admin/negocio`. Detalle en el plan §6.6 y el modelo §Migración. **No se siembran bidones sellados como inventario propio** (consignación, ADR-0010).
- ⛔ **PUNTO DE PARADA — decisión del PM.** Es el cutover del relanzamiento y **depende de un conteo físico** que ocurre fuera del sistema. **No lo ejecutes por tu cuenta:** prepara los scripts/pantallas de seed y **espera al PM** para correrlos con los números del conteo real. El **primer corte post-relanzamiento** se trata como validación del seed, no como corte normal.

## Qué subir al PM y cuándo
- Al terminar **cada** rebanada: PR + pruebas verdes (flujo normal de revisión).
- **Además, parada obligatoria** antes de mergear **6.5** y antes de ejecutar **6.6**.
- **En cualquier momento** en que la cascada aplique (un cambio necesario al esquema/modelo/PRD): no lo resuelvas en código, súbelo al PM.
- Composición de pantalla de **6.3 (envasado)** y del **corte de 6.5**: al PM antes de finalizar.

## Instrucción de arranque
Empieza por **6.1** con su handoff detallado. Al cerrarla (PR + pruebas + DoD), continúa con 6.2 y sigue la secuencia, respetando los puntos de parada. No necesitas volver al chat para avanzar entre rebanadas; sí para los puntos de parada marcados.
