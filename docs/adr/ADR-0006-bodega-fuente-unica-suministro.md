# ADR-0006: Usar la recepción a bodega como fuente única del suministro con La Moderna

- Estado: aceptado · Aceptado por el PM el 2026-07-02
- Fecha: 2026-07-02 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta v1.3, H-16 (recepción a bodega) y H-10 (reconciliación del corte). Depende de ADR-0004 (RLS) y ADR-0003 (Supabase).

## Contexto

Hoy el gerente teclea a mano en `/admin/negocio` lo recibido y lo devuelto de La Moderna, y de ahí sale el adeudo. Inc 6 introduce un inventario de bodega que registra la recepción y la devolución como eventos. Si ambos conviven —la captura manual y el evento de bodega— se abren dos fuentes del mismo dato, que descuadran en cuanto una se olvida (riesgo R6 del PRD).

## Decisión

La **recepción y la devolución a bodega** (eventos `movimiento_la_moderna`, tipo recibido/devuelto) son la **fuente única** del suministro. `suministro_la_moderna` deja de capturarse a mano y pasa a ser un **rollup por periodo** derivado de esos eventos. Se retira la captura manual de `/admin/negocio` como fuente de suministro.

## Alternativas consideradas

- **Coexistencia (manual + bodega):** descartado. Doble entrada del mismo hecho; descuadre garantizado en cuanto una de las dos se omita.
- **Eliminar `suministro_la_moderna` y calcular todo on-the-fly desde los eventos:** descartado por ahora. El corte y `adeudoLaModerna()` ya leen esa tabla; conservarla como rollup materializado minimiza el cambio y deja un ancla de reconciliación estable.

## Consecuencias

**Se gana**
- Una sola verdad del recibido/devuelto, con traza de evento (quién, cuándo), no un número suelto.
- El suministro queda auditable y alineado con el inventario físico de bodega.

**Se sacrifica**
- Hay que migrar el flujo de `/admin/negocio` y reescribir cómo se llena `suministro_la_moderna`.
- El gerente pierde el atajo de teclear una cifra: ahora registra un evento de recepción (paso más, a cambio de traza).
