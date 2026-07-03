# ADR-0009: Calcular el adeudo a La Moderna por consumo real y cruzarlo con una identidad de control

- Estado: aceptado · Aceptado por el PM el 2026-07-02
- Fecha: 2026-07-02 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta v1.3, H-10 (reconciliación por cantidades reales) y H-17 (rendimiento de envasado). Depende de ADR-0010 (devolución semanal) y ADR-0008 (factor fuera del cuadre).

## Contexto

Con la devolución semanal de bidones sellados (ADR-0010), tanto **recibido** como **devuelto** son cantidades reales y no triviales. Eso permite dos cosas: calcular el adeudo sin el factor de estimación, y **cruzar** el registro de suministro contra el registro de envasado, que hasta ahora eran datos independientes sin verificación mutua.

## Decisión

El adeudo se calcula por **consumo real**: `adeudo = (recibido − devuelto) × precio_preferencial`, uniforme para químicos y escobas. Para químicos se impone además la **identidad de control**:

> **recibido − devuelto = bidones abiertos** (Σ envasado del periodo)

El corte **evalúa la identidad** y **alerta** cuando no se cumple: la diferencia delata un conteo mal hecho, un envasado sin registrar o una rotura.

## Alternativas consideradas

- **Adeudo = bidones abiertos × precio, ignorando recibido/devuelto:** descartado. Da el mismo número pero **pierde el cruce de control**: un envasado sin registrar pasaría inadvertido. El valor está en que dos registros independientes se auditen.
- **Seguir con el factor sobre ventas:** descartado (ver ADR-0008): es la estimación que el negocio rechaza.

## Consecuencias

**Se gana**
- El descuadre que hoy es invisible se convierte en **alerta del corte**: dos registros independientes (suministro y envasado) se verifican entre sí.
- El adeudo deja de depender de una estimación y refleja lo realmente consumido.

**Se sacrifica**
- Exige **disciplina de captura en ambos lados** (recepción/devolución y envasado). Un lado flojo dispara falsas alertas.
- Se acepta el trade-off: esa alerta es, precisamente, la señal de que falta un registro. Prefiere ruido visible a descuadre silencioso.
