# ADR-0011: Modelar el corte como posiciones netas + liquidación, con arrastre encadenado entre cortes

- Estado: propuesto (pendiente de aceptación del PM)
- Fecha: 2026-07-08 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD delta (pendiente) — historia nueva de corte por reparto, que **reemplaza el cálculo de cierre de H-10**. Depende de ADR-0008 (factor fuera del cuadre), ADR-0009 (adeudo por consumo real) y ADR-0010 (devolución semanal). Habilitado por operación suspendida.

## Contexto

El corte actual (H-10, Inc 3) reconcilia por vendedor (bolsa efectivo/transferencia neta de gasto de ruta) y con La Moderna, pero **no calcula el reparto del remanente entre vendedores ni arrastra saldos** entre periodos. El negocio reparte el remanente **en partes iguales**; la cuenta por cobrar (CxC) se la queda quien la cobra; a La Moderna se le paga del **pool líquido** (efectivo + transferencias), que —por S5— vive en las cuentas personales de los vendedores.

Modelar esto de forma **procedural** ("qué bolsa paga qué obligación y cómo descarga lo que el vendedor debe entregar") obliga a reglas frágiles: prelación global vs. por vendedor, y acreditación explícita de la descarga de bolsa. Son síntomas del modelo elegido, no del dominio. Además, dos escenarios reales dejan saldos que deben **sobrevivir al cierre**: el pago a La Moderna topado por caja insuficiente, y un vendedor sobre-endeudado de CxC (CxC > su parte T).

## Decisión

El corte se modela como **posiciones netas + una pasada de liquidación**, no como prelación procedural de bolsas.

- Cada actor tiene una **posición objetivo** al cierre: cada vendedor, `T − su CxC` (con `T = V / nº de vendedores` y `V = ventas del periodo − adeudo La Moderna − backoffice`); el negocio, sus obligaciones como salida.
- Una **pasada de liquidación** emite los movimientos mínimos que llevan a cada quien de lo que tiene en mano (efectivo + transferencia, netos de ruta) a su objetivo. La **prelación efectivo→transferencia** y la minimización de movimientos son **preferencias sobre la salida**, no reglas del cálculo: un solo parámetro blando y cambiable.
- Todo objetivo no alcanzable este corte se vuelve **arrastre encadenado** al siguiente: el pago topado a La Moderna deja saldo a su favor; el vendedor en negativo queda debiendo al negocio. Ambos son la **misma brecha vista desde dos extremos**.
- El motor **arranca en cero, sin migración de saldos**: la operación está suspendida y los saldos registrados son desechables.

Consecuencia estructural: el corte deja de ser un cálculo de un tiro y pasa a ser una **confirmación multi-paso con estado (*stateful*)** que reemplaza el cálculo de cierre de H-10.

## Alternativas consideradas

- **Prelación procedural de bolsas** (definir qué bolsa paga cada obligación y acreditar la descarga de "lo que el vendedor debe entregar"): descartado. Introduce dos reglas frágiles (prelación global vs. por vendedor; acreditación de descarga) que son artefactos del modelo, no del negocio. Correcto solo por orden de operaciones y fácil de descuadrar.
- **Corte sin estado** (foto por periodo, sin arrastre): descartado. No puede representar un pago a La Moderna topado ni un vendedor con CxC > T; esos saldos existen en la realidad y deben persistir al cierre.
- **Migración con corte cero sembrado** (conteo de apertura, como bodega en Inc 6): descartado por innecesario. Los saldos actuales son desechables (operación suspendida); arrancar en cero es legítimo y **elimina el riesgo R7** de siembra torcida.

## Consecuencias

**Se gana**
- **Correcto por construcción:** si las posiciones netas cuadran, el efectivo cuadra; no hay orden de operaciones que lo descuadre.
- Las dos preguntas frágiles (prelación, acreditación de descarga) **colapsan a un solo parámetro** de salida.
- Los dos arrastres (vendedor↔negocio, negocio↔La Moderna) quedan como **una sola brecha** que el modelo hace evidente, en vez de dos cálculos separados que "casualmente" coinciden.
- El pago a La Moderna se liquida contra el **pool líquido** (efectivo + transferencia), no solo efectivo.

**Se sacrifica**
- El corte se vuelve ***stateful***: cada corte abre con los saldos del anterior y cierra dejando los suyos. El modelo de datos debe llevar **saldos de apertura/cierre encadenados**.
- **Reemplaza** el cálculo de cierre de H-10 en producción: el delta de PRD debe **deprecar formalmente** el criterio 4 de H-10 (traducción por factor) y H-11 —ya obsoletos desde Inc 6 (ADR-0008)— y sostener lo que sí sobrevive (validación por vendedor, desglose por forma de pago, gastos).
- Un prototipo de Fase 3 debe **cubrir cuatro estados de borde** —La Moderna topada, vendedor en negativo, arrastre entrante, alerta de identidad de control— o el gap de fidelidad viaja a Code.
