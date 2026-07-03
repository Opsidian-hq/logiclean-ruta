# Plan de entregas — **Addendum Inc 6 (Inventario de bodega y envasado)**

> Estado: borrador de Fase 2 · Deriva del PRD delta v1.3, los ADR-0006…0010 y el modelo de datos de Inc 6 · Insumo del Gate de Fase 2 de Inc 6.
> **Dependencias:** se apoya en Inc 1 (`inventario_vehiculo`, venta) e Inc 3 (corte). Es prerrequisito de **Inc 7** (tablero de caja).
> **Precondición de arranque de construcción:** Gate de Fase 2 cerrado (ADRs aceptados) + **revalidación del sponsor** del alcance ampliado (delta v1.3). La construcción (Fase 4) no arranca antes.

## Por qué Inc 6 va como un solo incremento (y no partido en producción)

La operación está **suspendida**: no hay riesgo de cutover en vivo. Eso permite construir toda la cadena de bodega y **reescribir la reconciliación del corte** de una vez, y hacer un relanzamiento limpio con conteo de apertura. Se construye por sub-rebanadas demostrables, en una rama, con QA en Fase 5 antes del relanzamiento.

## Sub-rebanadas (orden de construcción)

Cada una es demostrable por sí sola. El orden va de los cimientos (esquema + sync de los eventos nuevos) hacia el corte, dejando la migración como último paso, ya con todo probado.

### 6.1 — Esquema, contadores y eventos de bodega *(cimiento)*
Migraciones de las tablas nuevas (`inventario_bodega_base`, `inventario_bodega_presentacion`, `movimiento_la_moderna`, `envasado`/`envasado_linea`, `carga_vehiculo`/`carga_linea`, `devolucion_bodega`/`devolucion_linea`). RLS + **`GRANT ... TO authenticated`** en cada tabla nueva (lección ADR-0004). Extensión del motor de sync offline a los nuevos eventos, **idempotente** (ADR-0001, ADR-0007).
- **Hito:** un evento de bodega se crea sin conexión, sincroniza sin duplicar al reconectar, y su contador materializado queda correcto.
- *Por qué primero:* desactiva el riesgo de divergencia evento↔contador antes de montar pantallas encima.

### 6.2 — Recepción y suministro como rollup *(ADR-0006)*
Pantalla de recepción del gerente; `movimiento_la_moderna` (recibido) alimenta el rollup `suministro_la_moderna`. Se **retira la captura manual** de `/admin/negocio` como fuente de suministro.
- **Hito:** el gerente registra una recepción → suben `bidones_disponibles` (químicos) o piezas (escobas, docena×12) → el recibido del suministro lo refleja sin captura aparte.

### 6.3 — Envasado con rendimiento real *(H-17, ADR-0007)*
Pantalla de envasado (`origen` = bidón nuevo / granel); líneas de presentaciones que salen; residuo estimado. Mueve contadores: baja disponibles, sube granel, suben presentaciones en bodega.
- **Hito:** el gerente envasa un bidón de 20 L → registra las presentaciones que salieron y el residuo → el inventario de bodega de presentaciones sube y queda la traza de rendimiento.

### 6.4 — Carga y devolución a bodega *(H-18/H-19)*
Carga descuenta de bodega y sube al vehículo (iniciable por el vendedor para su propio vehículo o por el gerente); devolución vehículo → bodega. Se conecta con el `inventario_vehiculo` existente.
- **Hito:** cargar un vehículo desde bodega (bodega baja, vehículo sube), vender (vehículo baja) y devolver al cierre (vehículo baja, bodega sube), todo cuadrando.

### 6.5 — Corte por consumo real + identidad de control *(H-10, ADR-0008/0009/0010)*
Reescritura de la reconciliación: se saca el factor del cuadre; adeudo = `(recibido − devuelto) × precio`; devolución de sellados a La Moderna al cierre (`movimiento` devuelto); evaluación de la identidad `recibido − devuelto = abiertos` con **alerta** cuando no cuadra; inventario de bodega en el corte.
- **Hito:** el gerente genera un corte que reconcilia por consumo real, muestra el inventario de bodega, y **alerta** si la identidad de control no cuadra. Pruebas de regresión contra cortes históricos (que el cuadre existente no se rompa).

### 6.6 — Migración y relanzamiento *(cutover, una sola vez)*
1. **Conteo físico de apertura** de lo que es de Logiclean: granel abierto (litros estimados), presentaciones envasadas en bodega, piezas de escoba. *(Los bidones sellados NO se siembran como propios — son consignación, ADR-0010.)*
2. **Sembrar** `inventario_bodega_base.litros_granel_estimado` e `inventario_bodega_presentacion`; `bidones_disponibles` = lo que haya en el anaquel de La Moderna ese día (o 0 y llenar con la primera recepción).
3. **Reset de `inventario_vehiculo`** a los saldos reales contados por vehículo.
4. **Congelar** `/admin/negocio` como fuente de suministro.
- **Hito de cierre de Inc 6:** relanzamiento con inventario sembrado; el **primer corte post-relanzamiento cuadra** y valida el conteo de apertura.

## Definición de Hecho (Inc 6)
Código revisado · pruebas verdes (incluidas sync idempotente y regresión del corte) · criterios de aceptación de H-16…H-19 y H-10 cumplidos · accesibilidad básica verificada en las pantallas nuevas · ADRs 0006–0010 aceptados y documentación actualizada (modelo, PRD, runbook) · sin defectos críticos abiertos.

## Riesgos técnicos y mitigación *(continúa la tabla del plan base)*

| # | Riesgo técnico | Mitigación |
|---|---|---|
| T11 | **Divergencia evento↔contador:** un evento aplicado dos veces o a medias descuadra el inventario de bodega. | Aplicación por el motor de sync idempotente (ADR-0001/0007); casos de prueba de reaplicación y de corte de conexión a mitad de evento en Fase 5. |
| T12 | **Conteo de apertura mal hecho:** todo el inventario arranca torcido y contamina el primer corte. | Conteo físico con doble verificación antes de sembrar; el **primer corte post-relanzamiento** se trata como validación explícita del seed, no como corte normal. |
| T13 | **Fatiga de alertas:** la identidad de control dispara falsos positivos por captura floja y se empieza a ignorar. | Alerta con **tolerancia/umbral** configurable (no al mililitro); flujo de captura de recepción/envasado de baja fricción; la alerta describe el lado probable del descuadre. |
| T14 | **Regresión del corte:** reescribir la reconciliación (código en producción) rompe el cuadre que hoy funciona. | Construcción en rama; **pruebas de regresión contra cortes históricos** reales; no se toca el corte hasta 6.5 con QA de Fase 5 aprobado. |
| T15 | **Piezas sueltas de escoba:** al devolver solo se completan docenas; quedan piezas sueltas sin devolver. | El modelo maneja el inventario **por pieza**: las sueltas quedan como inventario de bodega visible; solo se devuelven a La Moderna las que completan docena. |

> **Nota de secuencia para tu revisión (PM):** Inc 6 toca el corte, que es código en producción. La suspensión de la operación es la ventana para hacerlo sin riesgo en vivo; si la operación se reanudara antes de cerrar 6.5, habría que replantear a un cutover por fases. Es una llamada del PM.
