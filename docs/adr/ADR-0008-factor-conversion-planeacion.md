# ADR-0008: Degradar el factor de conversión a insumo de planeación, fuera del cuadre del corte

- Estado: aceptado · Aceptado por el PM el 2026-07-02
- Fecha: 2026-07-02 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta v1.3, H-11 (reencuadre) y H-10 (reconciliación por consumo real). Reemplaza el rol que el factor tenía en el modelo v1.2 (§1, `inventarioAUnidadCompra`).

## Contexto

En v1.2, `factor_conversion` traducía presentaciones vendidas → bidones para reconciliar el corte: una **estimación fija** que no refleja el rendimiento real de cada bidón (varía por merma y envasado). El negocio pide cantidades reales. Pero retirar el factor por completo deja sin ninguna base para **planear el primer pedido** hasta acumular semanas de envasado real.

## Decisión

Sacar `factor_conversion` del cuadre del corte (se retira de `inventarioAUnidadCompra()` en la reconciliación). Conservarlo **degradado** como *"rendimiento nominal de planeación"*: etiquetado como estimado, **prohibido en el corte**, y usado solo como insumo de la planeación/pedido (Inc 7). Cuando `registro_envasado` acumule historia, la planeación migrará del nominal fijo al **rendimiento empírico real** por producto.

## Alternativas consideradas

- **Retirar el factor por completo:** descartado. Sin él no hay arranque para planear el pedido hasta tener semanas de envasado; el nominal es el punto de partida.
- **Mantener el factor como fallback dentro del cuadre:** descartado. Reintroduce la estimación que el negocio rechaza y crea dos verdades del consumo (real vs. estimada) compitiendo en el mismo cálculo.

## Consecuencias

**Se gana**
- El cuadre pasa a consumo real; el factor sobrevive con un rol honesto (planear, no cuadrar) y sin desperdiciar el dato ya capturado.

**Se sacrifica**
- El **significado** del mismo campo cambia: riesgo de que alguien lo reintroduzca en el cuadre por inercia. Mitigación: prohibición explícita en el ADR y revisión en Fase 5.
- Nota: el `factor_conversion` = 12 de la escoba se conserva **sin cambio**, como equivalencia definicional docena↔pieza; esta degradación aplica al rol de rendimiento del químico, no a esa equivalencia.
