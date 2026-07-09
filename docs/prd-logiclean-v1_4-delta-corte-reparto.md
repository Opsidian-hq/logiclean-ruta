# PRD — Logiclean Ruta · **Delta v1.4 (Corte por reparto — reemplazo del cálculo de cierre)**

> **Estado:** **aprobado** — PM (Eduardo) aceptó el delta el 2026-07-08; sponsor (Alonso) validó S7 (reparto en partes iguales) el 2026-07-08. Enmienda al PRD v1.2 (línea base firmada 2026-06-10) y al delta v1.3 (Inc 6) · **Versión:** v1.4 · **Fecha:** 2026-07-08
> Fase 1 · Discovery — enmienda de alcance sobre producto en operación (Fase 7). Documento vivo: se pliega al PRD del repo (`docs/prd-logiclean.md`) al aprobarse.
> **Insumo de arquitectura:** ADR-0011 (corte como posiciones netas + liquidación + arrastre encadenado). Depende de ADR-0008 (factor fuera del cuadre), ADR-0009 (adeudo por consumo real) y ADR-0010 (devolución semanal).
> **Contexto de la enmienda:** la operación en producción está **suspendida temporalmente** y los saldos registrados son **desechables**. Eso habilita un cutover limpio: el nuevo motor de corte **arranca en cero, sin migración de saldos** (ADR-0011).
> **Incremento:** _a confirmar por el PM_ — es incremento propio (no cabe dentro de uno existente). **Secuencia (decisión del PM, 2026-07-08):** este corte **bloquea el relanzamiento** —no se relanza sobre el corte de Inc 6 para luego ajustar—; debe operar correctamente con **uno o dos vendedores** desde el día uno. Inc 7 (Tablero de caja proyectada) se recorre detrás de este.
> **Estado real de dependencias (Notion, 2026-07-08):** Inc 6 tiene su código mergeado a `main` (PRs #74–80), incluida la reconciliación del corte por consumo real (6.5, ADR-0008/0009/0010) —ya construida, no pendiente—. La base de producción ya fue **reseteada a cero** (catálogo, clientes y 1 vendedor conservados). Este delta agrega **solo lo no construido**: reparto, liquidación y arrastre (H-20).

---

## Motivo de la enmienda

El corte actual (H-10, Inc 3) reconcilia **por vendedor** (bolsa efectivo/transferencia neta de gasto de ruta) y **con La Moderna**, pero **no calcula el reparto del remanente entre vendedores ni arrastra saldos** entre periodos. El negocio necesita que el corte:

1. **reparta el remanente en partes iguales** entre los vendedores;
2. trate la **cuenta por cobrar (CxC)** como algo que se queda quien la cobra —ajustando el efectivo que recibe hoy para que, al cobrarla, todos aterricen en la misma cantidad;
3. pague a La Moderna del **pool líquido** (efectivo + transferencias), que por S5 vive en las cuentas personales de los vendedores;
4. **arrastre** al siguiente corte lo que no se pudo liquidar (pago a La Moderna topado; vendedor sobre-endeudado de CxC).

Esto **reemplaza el cálculo de cierre de H-10**, no lo extiende. Parte del reemplazo solo **alinea el PRD a decisiones ya tomadas** (el criterio 4 de H-10 y H-11 llevan obsoletos desde Inc 6); la otra parte es lógica **genuinamente nueva** (reparto, liquidación, arrastre).

---

## §4 — Cambios de alcance (dentro / fuera)

**Se agrega a "Dentro":**
- **Reparto del remanente del periodo en partes iguales** entre los vendedores, con ajuste por CxC propia.
- **Posiciones netas por actor** y **pasada de liquidación** que emite las instrucciones concretas de movimiento de dinero (ADR-0011).
- **Arrastre encadenado** de saldos entre cortes: vendedor↔negocio y negocio↔La Moderna.
- **Corte con estado (*stateful*)**: cada corte abre con los saldos de cierre del anterior.

**Sigue fuera:** CFDI/timbrado; optimización de ruta; contabilidad general; cuenta de negocio dedicada (el comingling S5 se controla, no se elimina, en esta versión).

---

## §5 — Historias

### Depreca / reemplaza

**[H-10] (corte semanal) — reemplazo del cálculo de cierre.**

- **Se deprecan:** el **criterio 4** de H-10 (traducir presentaciones→bidones por factor para reconciliar con La Moderna) y **H-11** (factor de conversión gobernando el corte). Ya obsoletos desde Inc 6 (ADR-0008). El adeudo a La Moderna se rige por ADR-0009: `(recibido − devuelto) × precio_preferencial`, con la identidad de control para químicos.
- **Sobrevive de H-10** (se reusa como el *front* del nuevo flujo, no se rehace):
  - *criterio 1* — desplegar ventas, cobranza, gastos e inventario vendido vs. devuelto;
  - *criterio 2* — desglose de cobranza por forma de pago (efectivo vs. transferencia);
  - *criterio 3* — gasto de ruta netea la bolsa del vendedor; backoffice = salida de caja del negocio.

### Nueva

**[H-20] Como** gerente **quiero** un corte que **reparta el remanente del periodo en partes iguales** entre los vendedores —liquidando las obligaciones del negocio y arrastrando lo que no cuadre— **para** que cada vendedor termine con la misma cantidad y el corte encadene entre semanas sin perder un peso.
*Prioridad: Must*

> El corte es una **confirmación multi-paso** (stepper). Los criterios se ordenan por paso; los estados de borde marcados **[borde]** deben tener composición propia en el prototipo (Fase 3).

**Paso 1 — Validación por vendedor** *(reusa H-10 c1–c3)*
- Dado el cierre de semana, cuando abro el corte, entonces por cada vendedor veo su bolsa reconciliada (efectivo y transferencia, netas de gasto de ruta) y su **CxC nueva** del periodo, y la confirmo antes de avanzar.

**Paso 2 — Cierre con La Moderna**
- Dado el registro de recepción y de devolución de sellados del periodo, cuando calculo el adeudo, entonces se computa como `(recibido − devuelto) × precio_preferencial` (ADR-0009).
- **[borde · identidad de control]** Dado un adeudo de químicos, cuando `recibido − devuelto ≠ Σ bidones abiertos` (envasado), entonces el corte muestra **alerta de descuadre** y no permite cerrar sin reconocerla.

**Paso 3 — Obligaciones y pool líquido**
- Dado el adeudo a La Moderna y los **gastos de backoffice pendientes**, cuando compongo las obligaciones del periodo, entonces se muestran contra el **pool líquido = efectivo + transferencias cobradas** (netas de ruta) de todos los vendedores.
- **[borde · La Moderna topada]** Dado que el pool líquido no alcanza a cubrir las obligaciones, cuando genero el corte, entonces el pago a La Moderna **se topa a la caja disponible** y el faltante queda como **saldo a favor de La Moderna, arrastrado** al siguiente corte.

**Paso 4 — Reparto**
- Dado `V = ventas del periodo − adeudo La Moderna − backoffice`, cuando calculo el reparto, entonces `T = V ÷ nº de vendedores` y el **efectivo objetivo de cada vendedor = `T − su CxC`** (al cobrar su CxC, aterriza en T).
- **[borde · vendedor en negativo]** Dado un vendedor cuya CxC supera su T, cuando calculo su posición, entonces su objetivo es negativo: **no recibe efectivo y queda debiendo al negocio** por la diferencia, **arrastrada** al siguiente corte.

**Paso 5 — Instrucciones de liquidación**
- Dadas las posiciones objetivo y lo que cada quien tiene en mano, cuando genero la liquidación, entonces el corte emite los **movimientos concretos** (quién entrega o transfiere cuánto y a quién) que llevan a cada actor a su objetivo, **prefiriendo efectivo sobre transferencia** y **minimizando el número de movimientos**.
- Dado que un vendedor paga una obligación del negocio desde su bolsa (efectivo o transferencia), cuando se registra ese movimiento, entonces cuenta como **avance hacia su objetivo** —no se le exige entregar ese monto dos veces.

**Paso 6 — Cierre y arrastre**
- Dado un corte anterior con saldos pendientes, cuando abro el corte nuevo, entonces sus **saldos de apertura** son los **saldos de cierre** del anterior (vendedor↔negocio y negocio↔La Moderna).
- **[borde · arrastre entrante · anti-doble-conteo]** Dado un vendedor que arrastra deuda de un corte previo, cuando **cobra la CxC** que la originó, entonces esa deuda se salda primero y el vendedor completa su T de aquel periodo; **el cobro de CxC vieja NO se cuenta como ingreso nuevo** (distinto de una venta a crédito nueva).
- Dado el **primer corte tras el cutover**, cuando lo genero, entonces abre **en cero** (sin arrastre entrante), habilitado por la operación suspendida (ADR-0011).
- Dado un corte confirmado, cuando lo cierro, entonces queda registrado como **evento de cierre del periodo** con sus saldos de cierre encadenados.
- **[agnóstico al número de vendedores]** Dado un corte con **N vendedores activos** (N=1 al relanzamiento; N=2 cuando entra mayoreo), cuando lo genero, entonces `T = V ÷ N` y las posiciones/liquidación/arrastre se calculan **sin ramas que asuman un N fijo**. Con N=1, T = V y el remanente completo es del único vendedor.
- Dado que el **conjunto de vendedores cambia entre cortes** (entra el segundo), cuando genero el corte siguiente, entonces uso los vendedores activos de *ese* periodo, y el arrastre —al ser **por actor**— sobrevive la transición sin recálculo especial.

---

## §6 — Requisitos no funcionales (nuevos)

- **Motor de corte determinista y aislable.** El cálculo (posiciones netas, V, T, liquidación, detección de topes, arrastre) debe ser **testeable de forma independiente de la UI** (capa de dominio pura). Los ejemplos trabajados en definición se adoptan como **casos de prueba** de Fase 5.
- **Exactitud contable.** El corte no debe perder ni crear dinero: la suma de efectivo repartido + obligaciones pagadas + arrastres debe cuadrar contra la caja líquida real cobrada, en todo corte.
- **Agnóstico al número de vendedores (no negociable).** El motor opera con `N` vendedores sin código que asuma `N=2`. Se **verifica explícitamente con N=1 y con N=2** como casos de prueba de Fase 5. Objetivo de la decisión del PM: construir una vez para 1 o 2, no relanzar con 1 y ajustar al entrar el segundo.

---

## §7 — Supuestos y riesgos nuevos

| ID | Tipo | Enunciado | Validación / mitigación |
|---|---|---|---|
| S7 | Supuesto → **validado** | El reparto **en partes iguales** es la regla de compensación acordada del negocio (no proporcional ni por comisión). | **Validado por el sponsor (Alonso) el 2026-07-08.** |
| R8 | Riesgo | **Reemplazo de un motor de dinero en producción.** Un error de arrastre descuadra caja real, semana tras semana. | Arranque en cero (operación suspendida, sin migración) + motor determinista con casos de prueba + cobertura exhaustiva de los 4 estados de borde en el prototipo (Fase 3). |
| R9 | Riesgo | **Doble conteo de la CxC** (contarla como ingreso al generarse y otra vez al cobrarse). | Criterio explícito Paso 6: cobro de CxC vieja ≠ ingreso nuevo. Caso de prueba dedicado. |

---

## Cascada pendiente tras aprobar este delta

1. **Modelo de datos** — saldos de apertura/cierre encadenados por corte; distinción **venta a crédito nueva** vs. **cobro de CxC vieja**; posición neta por actor.
2. **Plan de incrementos** — ubicar el incremento y su hito (secuencia vs. Inc 7).
3. **Fase 3 (Claude Design)** — prototipo del stepper cubriendo **todos** los estados, con los 4 de borde compuestos.
4. **Handoff → Fase 4 (Claude Code)** — con el prototipo como contrato. La capa de dominio pura puede adelantarse en Code sin esperar a la UI.

---

## Bitácora de aprobación

| Versión | Fecha | Autor | Estado |
|---|---|---|---|
| v1.4 (delta) | 2026-07-08 | Opsidian (copiloto), a solicitud del PM | **Aprobado** — reemplaza el cálculo de cierre de H-10; depreca criterio 4 de H-10 y H-11; agrega H-20 (corte por reparto). **PM (Eduardo) aceptó el delta; sponsor (Alonso) validó S7.** Gate de Fase 1 cerrado para esta enmienda. |
