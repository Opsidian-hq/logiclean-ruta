# ADR-0010: Devolver los bidones sellados a La Moderna cada semana (consignación en anaquel compartido)

- Estado: aceptado · Aceptado por el PM el 2026-07-02
- Fecha: 2026-07-02 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta v1.3, H-16/H-19 (recepción y devolución) y H-10 (reconciliación). Decisión de modelo M-1. Habilita ADR-0009 y condiciona la migración (PRD delta §Migración).

## Contexto

Bodega y La Moderna comparten el mismo espacio físico, en anaqueles distintos. Al cierre de semana, los bidones sellados no abiertos pueden (A) conservarse como inventario de Logiclean entre semanas, o (B) devolverse a La Moderna. La elección determina si el inventario de bidones sellados persiste entre cortes y cómo se siembra la migración. En ambos casos el adeudo del químico es el mismo (`abiertos × precio`); lo que cambia es la **continuidad del inventario**.

## Decisión

Los bidones sellados no abiertos **se devuelven a La Moderna cada semana** (opción B). Los bidones sellados son **consignación de La Moderna** en el anaquel compartido; Logiclean **posee —y debe— un bidón solo cuando lo abre** (envasado). El contador `bidones_disponibles` **no persiste** entre cortes: al cierre, lo no abierto se registra como devuelto.

## Alternativas consideradas

- **(A) Conservar los sellados como inventario de Logiclean (consignación entre semanas):** descartado por el PM. No refleja el trato real con La Moderna. Además, como la devolución física es trivial (mismo espacio, distinto anaquel), no hay fricción operativa que justifique cargar con inventario ajeno: **lo que importa es el registro**, no mover cajas.

## Consecuencias

**Se gana**
- Migración más simple: no se siembran bidones sellados como inventario propio; solo el granel abierto, las presentaciones envasadas y las piezas.
- Habilita la **identidad de control** del ADR-0009 (recibido − devuelto = abiertos), porque el devuelto pasa a ser real.

**Se sacrifica**
- El gerente debe **registrar la devolución de sellados** al cierre (un evento más en el corte). Si lo omite, el recibido queda inflado y dispara la alerta del ADR-0009 —lo cual, de nuevo, es la señal deseada, no un defecto.
