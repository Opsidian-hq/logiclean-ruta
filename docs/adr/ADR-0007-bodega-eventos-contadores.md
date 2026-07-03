# ADR-0007: Modelar el inventario de bodega como eventos append-only con contadores materializados

- Estado: aceptado · Aceptado por el PM el 2026-07-02
- Fecha: 2026-07-02 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta v1.3, H-16/H-17/H-18/H-19 (recepción, envasado, carga, devolución) y H-10 (rendimiento real en el corte). Depende de ADR-0001 (offline-first) y hereda el patrón de `inventario_vehiculo`.

## Contexto

El inventario de bodega debe operar offline (ADR-0001) y, además, producir el **rendimiento real por bidón** y la **traza de merma**. Un contador puro —como el actual `inventario_vehiculo`, que la venta decrementa— guarda el estado pero no el porqué de cada movimiento. Un registro de eventos puro da la traza pero es lento para responder "¿qué hay ahora en bodega?".

## Decisión

Cada movimiento —**recepción, envasado, carga, devolución**— se registra como **evento append-only** (con sus líneas de detalle donde aplica). Los **contadores** de bodega (`inventario_bodega_base`, `inventario_bodega_presentacion`) se **materializan** aplicando esos eventos. Es el mismo patrón que hoy relaciona `venta` → `inventario_vehiculo`, extendido a toda la cadena de bodega.

## Alternativas consideradas

- **Solo contadores mutados directamente (sin log de eventos):** descartado. Sin traza no hay rendimiento, ni auditoría, ni la identidad de control del ADR-0009. Es el modelo que precisamente estamos superando.
- **Event sourcing puro (recomputar el estado siempre, sin contador):** descartado. Caro en un cliente offline y lento para las consultas de estado ("cuánto hay para cargar"), que son las más frecuentes.

## Consecuencias

**Se gana**
- Traza completa: rendimiento real, merma estimada y la identidad de control quedan disponibles.
- Resiliencia: si un contador se corrompe, se reconstruye reaplicando los eventos.
- Encaja con la cola de sincronización offline ya existente (ADR-0001).

**Se sacrifica**
- Doble escritura (evento + contador) con riesgo de divergencia si la lógica de aplicación falla.
- Exige **idempotencia** en la sincronización: un evento no debe aplicarse dos veces al reconectar. Se apoya en el mecanismo de ADR-0001 y se vuelve caso de prueba en Fase 5.
