# PRD — Logiclean Ruta · **Delta v1.3 (Inc 6 — Inventario de bodega y envasado)**

> **Estado:** en revisión — enmienda al PRD v1.2 (línea base firmada 2026-06-10) · **Versión:** v1.3 · **Sponsor:** Alonso González (Escobas La Moderna) · **PM:** Eduardo (Opsidian) · **Fecha:** 2026-07-02
> Fase 1 · Discovery — enmienda de alcance sobre producto en operación (Fase 7). Documento vivo: se pliega al PRD del repo (`docs/prd-logiclean.md`) al aprobarse.
> **Contexto de la enmienda:** la operación en producción está **suspendida temporalmente**; los datos existentes pueden migrarse/resetearse sin riesgo económico ni operativo. Eso habilita un cutover limpio de Inc 6 (reset de inventario y conteo físico de apertura de bodega).

---

## Motivo de la enmienda

El corte se hace hoy a mano y se apoya en un **factor de conversión fijo** para traducir presentaciones vendidas → bidones. El negocio necesita **cantidades reales** de bidones (químicos) y piezas (escobas/trapeadores/recogedores) tomadas de La Moderna por semana, y **visibilidad del inventario en bodega**, no una estimación por factor.

Esto **mueve dentro del alcance** lo que la v1.2 dejó explícitamente fuera:

> ~~Fuera del MVP: "Registro del evento de envasado y medición de merma de envasado".~~ → **Dentro (Inc 6).**

---

## §4 — Cambios de alcance (dentro / fuera)

**Se agrega a "Dentro":**
- Inventario de **bodega** como nivel de inventario aguas arriba del vehículo (químicos en bidones/granel; escobas·trapeadores·recogedores en piezas).
- **Recepción** de mercancía de La Moderna hacia bodega, como fuente del "recibido" de la reconciliación (sin doble captura).
- **Envasado** de químicos (bidón de 20 L → presentaciones) con **rendimiento real** y **residuo estimado** a granel.
- **Carga a vehículo** descontando de bodega; **devolución** a bodega al cierre.
- **Corte reconciliado con cantidades reales**: químicos por bidones realmente abiertos; escobas/trapeadores por pieza.

**Se retira de "Fuera":** "Registro del evento de envasado y medición de merma de envasado" (ahora dentro).

**Sigue fuera:** CFDI/timbrado; optimización de ruta; contabilidad general; auditoría del residuo al mililitro (se estima, no se mide con precisión de laboratorio).

---

## §5 — Historias nuevas y modificadas

> Bidón estándar de químico = **20 litros**. Escobas/trapeadores/recogedores: **1 docena = 12 piezas**.

### Nuevas

**[H-16] Como** gerente **quiero** registrar en un **inventario de bodega** la mercancía que recibo de La Moderna **para** saber qué hay disponible y que ese registro sea la fuente del "recibido", sin doble captura.
*Prioridad: Must*
- Dado un lote recibido, cuando registro la recepción (químicos en bidones de 20 L; escobas/trapeadores/recogedores en piezas), entonces el inventario de bodega aumenta y queda fecha y responsable.
- Dado que registro una recepción, cuando se guarda, entonces alimenta la reconciliación con La Moderna (**recibido**) sin recapturarla por separado.

**[H-17] Como** gerente **quiero** registrar cada **envasado** (bidón de 20 L → presentaciones) **para** conocer el rendimiento real por bidón y el producto que queda a granel, en vez de estimar con un factor fijo.
*Prioridad: Must*
- Dado un bidón de 20 L en bodega, cuando registro un envasado, entonces capturo cuántas presentaciones de cada tipo salieron (p. ej. 1 L, 3.7 L) y el **residuo estimado en litros** que queda en el bidón.
- Dado un envasado registrado, cuando se guarda, entonces el inventario de bodega mueve: baja el bidón (pasa a granel), **suben las presentaciones envasadas**, y el residuo queda como **granel estimado re-envasable**.
- Dado un bidón abierto, cuando llega el corte, entonces cuenta como **bidón consumido** para La Moderna (un bidón abierto no se devuelve), sin importar el residuo.
- *(Nota de alcance: el residuo se estima en litros para visibilidad de inventario; no se audita al mililitro.)*

**[H-18] Como** gerente o vendedor **quiero** **cargar el vehículo descontando del inventario de bodega** **para** que el stock del vehículo salga de una fuente real y no de un registro suelto.
*Prioridad: Must*
- Dado inventario disponible en bodega (presentaciones envasadas o piezas), cuando cargo el vehículo de un vendedor, entonces baja bodega y sube el vehículo por la misma cantidad.
- Dado que no hay stock suficiente en bodega, cuando intento cargar, entonces el sistema lo advierte o lo impide (no se carga "de la nada").

**[H-19] Como** gerente **quiero** registrar lo que **regresa a bodega al cierre** **para** cuadrar el corte por pieza (escobas/trapeadores) y por presentación (químicos).
*Prioridad: Must*
- Dado el cierre de semana, cuando registro la devolución del vehículo a bodega, entonces sube bodega y baja el vehículo.
- Dado escobas/trapeadores, cuando cuadro el corte, entonces las piezas se manejan **por pieza** (recibidas − devueltas = consumidas); la equivalencia a docena es referencia manual para La Moderna.

### Modificadas

**[H-10] (corte semanal) — reconciliación con cantidades reales.** Se añaden criterios:
- Dado el corte de químicos, cuando reconcilio contra La Moderna, entonces uso los **bidones realmente abiertos** (registro de envasado), **no** el factor de conversión derivado de ventas.
- Dado el corte de escobas/trapeadores, cuando reconcilio, entonces uso las **piezas consumidas** (recibidas − devueltas), no una conversión por factor.
- Dado el corte, cuando lo genero, entonces muestra el inventario de bodega: presentaciones envasadas, granel estimado en bidones (litros) y piezas.

**[H-11] (factor de conversión) — reencuadre a insumo de planeación.** Con envasado real, el factor **deja de gobernar la reconciliación del corte** (se retira de `inventarioAUnidadCompra()`). Se **conserva degradado** como *"rendimiento nominal de planeación"*, etiquetado como estimado y **prohibido en el corte**. Sirve de arranque para el pedido hasta que `registro_envasado` acumule historia y el nominal pueda migrar al **rendimiento empírico real** por producto. Decisión de ADR en Fase 2.

> **Registrado — Inc 7 (Must): Tablero de caja proyectada de la semana.** *Fuera de Inc 6, incremento propio.* Vista derivada (solo lectura) que extiende el dashboard del gerente (H-15) y compone: **adeudo proyectado a La Moderna** (consumo real × `precio_preferencial`), **cartera por cobrar**, y **venta necesaria vs. proyectada** (punto de equilibrio de caja vs. pronóstico del histórico; la señal es la *brecha* entre ambas). Motivo: el pedido semanal es la principal salida de caja; decidir cuánto traer es decidir cuánto capital se compromete. Nace del consumo real que Inc 6 deja registrado. Tiene su propia cascada (PRD → modelo → plan) cuando se active.

---

## §7 — Supuestos y riesgos nuevos

| ID | Tipo | Enunciado | Validación / mitigación |
|---|---|---|---|
| S6 | Supuesto | El residuo por bidón se puede **estimar** de forma suficientemente fiable (medición gruesa a ojo/regla). | Se valida en las primeras 2–3 semanas de uso: contrastar residuo estimado acumulado vs. bidones abiertos. |
| R6 | Riesgo | **Triple registro de inventario** (bodega ↔ vehículo ↔ recepción) descuadra si la carga/devolución no es disciplinada. | Bodega como **fuente única**: la carga descuenta, la devolución reingresa, el corte reconcilia. Sin captura paralela. |
| R7 | Riesgo (migración) | El relanzamiento resetea `inventario_vehiculo` y siembra bodega con **saldos de apertura**; si están mal, todo arranca torcido. | **Conteo físico de apertura** de bodega y vehículos antes del relanzamiento. La operación está suspendida: se puede hacer conteo limpio. |

---

## Decisiones de PM — resueltas (2026-07-02)

1. **Fuente de verdad del adeudo a La Moderna → RESUELTO.** La **recepción a bodega (H-16) es la fuente única** y alimenta `suministro_la_moderna` (recibido/devuelto). Se **retira la captura manual** de `/admin/negocio` como fuente. Sin doble entrada.
2. **Factor de conversión (H-11) → RESUELTO.** Se **degrada a insumo de planeación** (rendimiento nominal), fuera del cuadre; habilita Inc 7. Detalle en H-11 arriba.
3. **Migración/cutover → RESUELTO.** Reset de `inventario_vehiculo` + **conteo físico de apertura** de bodega y vehículos antes del relanzamiento. **Confirmado por el PM: el conteo se puede hacer.**

---

## Gate de Fase 1 (checklist)

- [x] Historias nuevas con criterios de aceptación en Gherkin (H-16..H-19) y H-10 actualizada.
- [x] Alcance "dentro/fuera" explícito (envasado entra; residuo al mililitro y CFDI siguen fuera).
- [x] Las 3 decisiones de PM — resueltas (2026-07-02).
- [x] **Revalidación del sponsor** (Alonso) del alcance ampliado — **revalidado (2026-07-02)**.
- [ ] Supuesto S6 (estimación de residuo) — se valida en uso; queda como supuesto abierto declarado.

**Nota de gate:** PRD delta v1.3 cerrado y revalidado. Fase 2 de Inc 6 (modelo, ADRs 0006–0010 aceptados, plan) cerrada. Habilitado el paso a diseño/construcción de Inc 6.

---

## Bitácora

| Versión | Fecha | Quién | Estado |
|---|---|---|---|
| v1.3 (delta) | 2026-07-02 | Opsidian (copiloto), a solicitud del PM | **En revisión** — Inc 6: inventario de bodega, envasado con rendimiento real y residuo estimado, carga/devolución, corte por cantidades reales. Mueve "envasado/merma" de fuera a dentro. Pendiente: 3 decisiones de PM + revalidación del sponsor. |
| v1.3 (delta) | 2026-07-02 | PM (Opsidian) | **3 decisiones de PM resueltas** (recepción a bodega = fuente única; factor degradado a planeación; migración con conteo de apertura). ADRs 0006–0010 aceptados. |
| v1.3 (delta) | 2026-07-02 | Alonso González (sponsor) | **Revalidado** — alcance ampliado de Inc 6 (inventario de bodega + envasado) aceptado. Gate de Fase 1 del delta cerrado. |
