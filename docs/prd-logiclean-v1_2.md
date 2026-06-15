# PRD — Logiclean Ruta *(nombre de trabajo)*

> **Estado:** firmado — v1.2 revalidada por el sponsor; alcance ampliado (gastos; catálogo CRUD; administración de clientes; dashboard) aceptado · **Versión:** v1.2 · **Sponsor:** Alonso González (Escobas La Moderna) · **Fecha:** 2026-06-10
> Fase 1 · Discovery y definición — Opsidian. Documento vivo: se versiona en el repo (`docs/`).
> Insumo: Acta de Encuadre v2 (Fase 0, gate cumplido). Línea base firmada: v1.0 (2026-06-09).

---

## Resumen ejecutivo  *(capa sponsor — léase en una página)*

**Problema en una frase.** La venta en ruta de Logiclean opera sin herramientas formales y el seguimiento de prospectos depende de la memoria del vendedor; eso le pone techo al crecimiento de la cartera activa y vuelve poco confiable el corte semanal.

**Por qué importa al negocio.** La mayoría de los prospectos no compra hasta su 3.ª o 4.ª visita. Sin un seguimiento sistemático, los potenciales se pierden antes de convertir y la cartera no crece. Además, el corte semanal —que reconcilia al vendedor con su ruta y a Logiclean con La Moderna bajo venta-o-devolución— no es confiable hoy.

**Qué cambia si lo resolvemos.** Crecer la cartera activa (compra sostenida) un +50% sobre la base real por vendedor —de ~20–25 a ~30–37— en un trimestre, sosteniendo la confiabilidad del corte semanal como guardrail.

**Alcance del MVP en una línea.** Una app de venta en ruta que registra ventas, pedidos pendientes, cobranza y **gastos**, sostiene el seguimiento de prospectos con recordatorios de visita semanales, y produce un corte semanal confiable. **No** emite CFDI, **no** optimiza rutas y **no** mide merma de envasado en esta versión.

**Qué quedó aprobado con la firma (v1.0).** (1) El alcance del MVP —lo que entra y lo que queda fuera—; (2) los criterios de éxito medibles; (3) el plan de validación de los supuestos críticos antes del arranque.

**Qué se agrega tras la firma (v1.1–v1.2, revalidado por el sponsor).** (v1.1) El registro de gastos —de ruta y de backoffice— como parte del corte. (v1.2) La gestión del catálogo de productos (CRUD completo), la administración de clientes (incluida la reasignación entre vendedores) y un dashboard consolidado del periodo para el gerente. Alonso revalidó el alcance ampliado; la v1.2 es la nueva línea base.

---
*— A partir de aquí, capa de ingeniería —*

## 1. Problema y contexto de negocio

Logiclean distribuye productos de limpieza mediante **venta en ruta** con dos vendedores (uno a mayoreo, otro a menudeo); en ambos conviven autoventa y preventa. Recibe producto a granel de Escobas La Moderna (bidones), lo envasa en presentaciones de **1 L** y **3.7 L**, y lo vende en ruta. El suministro es **venta-o-devolución**: Logiclean compra a precio preferencial por bidones y docenas, al cierre de semana paga lo vendido y devuelve lo no vendido. El corte semanal cuadra al vendedor con su ruta y a Logiclean con La Moderna.

El crecimiento depende de convertir prospectos, y convertir exige sostener un seguimiento a lo largo de 3-4 visitas. Hoy ese seguimiento vive en la memoria del vendedor: ahí está el techo del negocio y el origen del proyecto.

## 2. Objetivos y criterios de éxito (medibles)

| Criterio | Métrica | Línea base | Meta | Plazo |
|---|---|---|---|---|
| Resultado de negocio | Clientes activos por vendedor (*activo* = compra sostenida; ver nota) | ~20–25 (recuento preliminar del cuaderno del vendedor de menudeo, 9 mar–9 jun 2026) | +50% ≈ 30–37 | 3 meses desde el arranque en uso |
| Indicador adelantado (mes 1) | Prospectos en seguimiento activo con ciclo de visita registrado | 0 (no se mide hoy) | Embudo poblado y vivo | Mes 1 |
| Indicador adelantado (mes 1) | Adherencia al seguimiento (% de prospectos que reciben su siguiente visita a tiempo) | n/d | A definir con dato de mes 1 | Mes 1 |
| Indicador adelantado (mes 1) | Tiempo de venta recuperado por jornada | n/d | Tendencia positiva | Mes 1 |
| Guardrail | Confiabilidad del corte semanal | Corte no confiable | Corte que cuadra cada semana | Continuo |

Estos números son los que la **Fase 7** evaluará contra el éxito definido en la Fase 0.

> **Definición de cliente activo (compra sostenida).** Cuenta que registra compra en **al menos 2 de las últimas 4 semanas** —no compra única. Umbral operativo propuesto, ajustable por el sponsor; el tool lo calcula en automático una vez en uso.
> **Recalibración de la base.** El ~10 por vendedor del acta era una estimación no confiable. El cuaderno de operación del vendedor de menudeo (9 mar–9 jun 2026) muestra ~50–60 cuentas comprando *al mes*, de las cuales un núcleo recurrente de ~20–25 cumple "compra sostenida". La meta se reexpresa como +50% sobre esa base real, **pendiente de un recuento limpio y de la firma del sponsor**.

## 3. Usuarios y actores

| Actor | Tipo | Qué necesita |
|---|---|---|
| Vendedor (×2: mayoreo, menudeo) | Usuario principal, en ruta | Registrar ventas/pedidos/cobranza/gastos rápido y sin papeleo; ver a quién visitar y dar seguimiento a prospectos. |
| Gerente de Logiclean | Usuario, dueño operativo | Corte semanal confiable; gestionar el catálogo y los clientes (reasignar incluido); registrar gastos de backoffice; un dashboard consolidado del periodo; ver el embudo de prospectos y la adherencia. |
| Alonso González | Sponsor | Visibilidad/transparencia de la operación (base de su futura participación). |
| Escobas La Moderna | Actor externo | Reconciliación venta-o-devolución en bidones/docenas (no es usuario del sistema). |

## 4. Alcance — dentro / fuera (MVP)

| Dentro del MVP | Fuera del MVP (esta versión) |
|---|---|
| Registro de venta (autoventa) con 2 listas de precios (mayoreo/menudeo) y catálogo de 100 productos | Emisión y timbrado de CFDI con PAC |
| Nota de venta; marca de "requiere factura" (a precio de lista + IVA, sin timbrar) | Optimización algorítmica de secuencia de ruta |
| Pedido pendiente (preventa) | Registro del evento de envasado y medición de merma de envasado |
| Cobranza (cobro total/parcial/crédito, saldo por cliente, **forma de pago: efectivo / transferencia**) | Fuerza de prospección separada del vendedor |
| **Registro de gastos de ruta (gasolina, viáticos) con forma de pago, que afectan la bolsa del vendedor en el corte** | Contabilidad general / estados financieros completos |
| **Registro de gastos de backoffice (insumos, etiquetas, pagos a proveedores) como salidas de caja del negocio** | |
| Seguimiento de prospectos (ficha con punto del ciclo, notas, siguiente paso y fecha) | |
| Motor de vencimientos semanal ("¿a quién visitar esta semana?") | |
| Mostrar ruta del día + insertar/reprogramar visita ad-hoc | |
| Factor de conversión bidón → presentación (para cuadrar el corte) | |
| Corte semanal (vendedor↔ruta y Logiclean↔La Moderna), **incluyendo gastos** | |
| Operación offline con sincronización | |
| **Gestión del catálogo de productos (CRUD completo): productos, presentaciones, precios y factor**, por el gerente | |
| **Administración de clientes en backoffice: ver, editar y reasignar entre vendedores** | |
| **Dashboard consolidado del gerente (periodo entre cortes), casi en tiempo real** | |

## 5. Historias de usuario

> Formato Connextra + prioridad MoSCoW + criterios de aceptación en Gherkin (Dado/Cuando/Entonces). Cada criterio se vuelve caso de prueba en Fase 5.

### Seguimiento de prospectos *(el corazón de la apuesta)*

**[H-01] Como** vendedor **quiero** registrar cada prospecto con su punto en el ciclo de visitas **para** no depender de mi memoria al darle seguimiento.
*Prioridad: Must*
- Dado un prospecto nuevo, cuando lo registro, entonces queda con "visita 1 de 4" y la fecha de hoy.
- Dado un prospecto existente, cuando registro una visita, entonces avanza su contador de ciclo y guarda la nota de lo hablado, el siguiente paso y la fecha de la próxima visita.

**[H-02] Como** vendedor **quiero** ver al iniciar la jornada qué prospectos tienen visita por vencer o vencida esta semana **para** sostener el seguimiento a tiempo.
*Prioridad: Must*
- Dado prospectos con próxima visita programada, cuando abro la app al iniciar la jornada, entonces veo la lista de los que tocan esta semana ordenados por urgencia.
- Dado un prospecto cuya visita se pasó de fecha, cuando aparece en la lista, entonces se marca como "vencido" en color de alerta.

**[H-03] Como** gerente **quiero** ver el embudo de prospectos en seguimiento y la adherencia al seguimiento **para** saber si la conversión va en camino antes de que se refleje en ventas.
*Prioridad: Must*
- Dado prospectos en seguimiento, cuando abro el panel del gerente, entonces veo cuántos hay por etapa del ciclo (1.ª–4.ª visita).
- Dado el cierre de la semana, cuando reviso la adherencia, entonces veo el porcentaje de prospectos que recibió su siguiente visita a tiempo.

### Venta, pedido y cobranza

**[H-04] Como** vendedor **quiero** registrar una venta de autoventa con la lista de precios correcta **para** emitir la nota y descontar inventario del vehículo.
*Prioridad: Must*
- Dado un cliente de mayoreo, cuando registro la venta, entonces los precios aplican la lista de mayoreo (y la de menudeo para clientes de menudeo).
- Dado producto vendido, cuando confirmo la venta, entonces el inventario cargado en el vehículo se reduce en esa cantidad y se genera la nota de venta.

**[H-05] Como** vendedor **quiero** levantar un pedido pendiente cuando el cliente pide algo que no cargo **para** entregarlo después sin perder la venta.
*Prioridad: Must*
- Dado un producto no disponible en el vehículo, cuando el cliente lo pide, entonces se registra como pedido pendiente con cliente, producto, cantidad y fecha compromiso.
- Dado un pedido pendiente, cuando se entrega, entonces se convierte en venta y se cierra el pendiente.

**[H-06] Como** vendedor **quiero** marcar una venta como "requiere factura" **para** que la facturación se procese fuera a precio de lista + IVA.
*Prioridad: Should*
- Dado un cliente que pide factura, cuando marco la venta como facturable, entonces queda etiquetada con los datos necesarios y el monto se calcula a precio de lista + IVA.
- *(Nota de alcance: el MVP registra, no timbra. El timbrado ocurre fuera del sistema.)*

**[H-07] Como** vendedor **quiero** registrar el cobro de cada venta indicando su forma de pago **para** llevar la cobranza con visibilidad del efectivo y las transferencias.
*Prioridad: Must*
- Dado una venta, cuando registro un cobro, entonces capturo el monto y la **forma de pago** (efectivo o transferencia).
- Dado una venta, cuando registro cobro total, parcial o a crédito, entonces el saldo del cliente refleja lo pendiente.
- Dada una venta liquidada en varios momentos, cuando registro cada cobro, entonces cada uno conserva su propia forma de pago.
- *(Nota de alcance: facturar (H-06) es un eje independiente. Una venta facturada o no facturada puede pagarse en efectivo o por transferencia; el destino fiscal/no fiscal se deduce del cruce, no se captura a mano.)*

### Gastos

**[H-12] Como** vendedor o gerente **quiero** registrar cada gasto con su tipo y su forma de pago **para** que el corte semanal cuadre el dinero realmente disponible.
*Prioridad: Must*
- Dado cualquier gasto, cuando lo registro, entonces capturo tipo (ruta / backoffice), categoría, monto, fecha y forma de pago (efectivo / transferencia).
- Dado un gasto de ruta pagado en efectivo, cuando lo registro, entonces baja el efectivo en mano de ese vendedor en el corte.
- Dado un gasto de ruta pagado por transferencia, cuando lo registro, entonces baja el saldo en banco (bolsa de transferencias) de ese vendedor en el corte.
- Dado un gasto de backoffice, cuando lo registro, entonces se suma a las salidas de caja del negocio sin afectar las bolsas del vendedor.
- *(Nota de alcance: el MVP registra gastos para cuadrar el corte; no es contabilidad general ni estados financieros.)*

### Ruta

**[H-08] Como** vendedor **quiero** ver mi ruta del día **para** visitar a mis clientes en el orden que ya conozco.
*Prioridad: Must*
- Dado mi ruta planeada, cuando inicio la jornada, entonces veo la lista de clientes y prospectos a visitar hoy.

**[H-09] Como** vendedor **quiero** insertar o reprogramar una visita cuando surge un pedido nuevo **para** atenderlo hoy o localizarlo en otra ruta/día.
*Prioridad: Should*
- Dado un pedido nuevo fuera de la ruta planeada, cuando lo agrego, entonces puedo atenderlo en la jornada actual o programarlo a otra fecha/ruta.
- Dada una visita programada, cuando la muevo de día, entonces aparece en la ruta del día destino.

### Corte semanal, inventario y conversión

**[H-10] Como** gerente **quiero** un corte semanal que cuadre lo vendido, lo cobrado, los gastos y el inventario **para** reconciliar al vendedor con su ruta y a Logiclean con La Moderna.
*Prioridad: Must*
- Dado el cierre de semana, cuando genero el corte, entonces muestra ventas, cobranza, gastos e inventario vendido vs. devuelto.
- Dado el corte, cuando lo genero, entonces la cobranza se desglosa por forma de pago (efectivo vs. transferencia) para reconciliar el efectivo en mano contra las transferencias.
- Dado el corte, cuando lo genero, entonces los **gastos de ruta** se descuentan de la bolsa correspondiente del vendedor (efectivo o transferencia), y los **gastos de backoffice** se reportan como salidas de caja del negocio.
- Dado el inventario en presentaciones, cuando se genera el corte, entonces se traduce a bidones para reconciliar la compra/devolución con La Moderna (venta-o-devolución).

**[H-11] Como** gerente **quiero** definir el factor de conversión por producto (bidón → presentaciones) **para** que el corte traduzca entre la unidad de compra y la de venta.
*Prioridad: Must*
- Dado un producto, cuando defino cuántas presentaciones de 1 L / 3.7 L salen de un bidón, entonces el corte usa ese factor en la reconciliación.

### Administración y tablero (gerente)

**[H-13] Como** gerente **quiero** gestionar el catálogo de productos (alta, consulta, edición y baja) **para** mantener productos, presentaciones, precios y factor sin depender de nadie.
*Prioridad: Must*
- Dado un producto nuevo, cuando lo doy de alta, entonces queda disponible con sus presentaciones, precios (mayoreo/menudeo) y factor de conversión.
- Dado un producto existente, cuando edito su precio o su factor, entonces las ventas posteriores usan el nuevo valor.
- Dado un producto que ya no se vende, cuando lo doy de baja, entonces se **desactiva** (no se borra) para no romper el histórico de cortes anteriores.

**[H-14] Como** gerente **quiero** administrar los clientes y reasignarlos entre vendedores **para** mantener la cartera ordenada cuando cambia una zona o un vendedor.
*Prioridad: Must*
- Dado un cliente, cuando edito sus datos, entonces se actualizan para el vendedor dueño.
- Dado un cliente de un vendedor, cuando lo reasigno a otro, entonces pasa a la cartera del nuevo y deja de verse en la del anterior.
- *(Nota: la reasignación es una acción de administrador; cambia al dueño exclusivo definido en el ADR-0001.)*

**[H-15] Como** gerente **quiero** un dashboard consolidado del periodo en curso **para** ver de un vistazo cómo va la operación antes del siguiente corte.
*Prioridad: Must*
- Dado el periodo desde el último corte, cuando abro el dashboard, entonces veo ventas del periodo, posición de caja por vendedor y bolsa (efectivo/transferencia, netos de gastos) y las alertas (prospectos vencidos, descuadres).
- Dado que se genera un corte, cuando se cierra el periodo, entonces los indicadores de flujo (ventas, caja, gastos) se reinician para el nuevo periodo.
- Dado lo relacionado con la cartera de clientes (embudo, adherencia, cartera activa), cuando se genera un corte, entonces **no** se reinicia: refleja estado vivo y continuo.
- Dado que hay señal, cuando el vendedor sincroniza, entonces el dashboard se actualiza casi en tiempo real.

## 6. Requisitos no funcionales

- **Operación offline + sincronización.** La app debe permitir registrar ventas, pedidos, cobranza, **gastos** y visitas **sin conexión** y sincronizar al recuperarla, sin pérdida ni duplicado de datos. *(Decisión de arquitectura → ADR en Fase 2.)*
- **Accesibilidad básica.** Uso con una mano y a la luz del sol; contraste y tamaño de toque adecuados; pensada para usuarios no técnicos (vendedores).
- **Rendimiento.** Arranque y registro de una venta en segundos; la sincronización no debe bloquear el uso.
- **Seguridad.** Cada vendedor ve su ruta y su cartera; el gerente ve el consolidado; los datos de cliente quedan protegidos.

## 7. Supuestos y riesgos

### Supuestos (cada uno con su validación)

| ID | Supuesto | Estado | Cómo y cuándo se valida |
|---|---|---|---|
| S1 | **[CRÍTICO]** La cadencia de visita/recompra es ~semanal; sostiene el horizonte de 3 meses. | Ratificado (direccional) | Cuaderno menudeo (mar–jun 2026): cuentas recurrentes recompran de semanal a quincenal. Confirmar con vendedor de mayoreo. |
| S2 | **[CRÍTICO]** El embudo y la conversión alcanzan para crecer la cartera sostenida +50%. | Validado (direccional) | Cuaderno menudeo: 50+ prospectos surtidos en el trimestre, ~10 conversiones rastreables a recompra. Triangular con mayoreo y con el gerente antes de la firma. |
| S3 | El plazo se cuenta desde el arranque en uso de la herramienta, no desde el inicio del proyecto. | Registrado | Acuerdo explícito con el sponsor en la firma. |
| S4 | La conectividad en ruta es intermitente. | Registrado | Sostiene el NFR offline; se confirma en Fase 2. |
| S5 | **[CRÍTICO para el corte]** Las transferencias de los clientes aterrizan en la cuenta personal de cada vendedor, y de esa misma cuenta el vendedor paga sus gastos por transferencia. | **Validado por el gerente** | Confirmado para ambos vendedores: el gasto por transferencia drena la bolsa de transferencias cobradas (no es reembolso). El corte reconcilia, por vendedor: *transferencias a entregar = transferencias cobradas − gastos de ruta por transferencia*. |

### Riesgos

| ID | Riesgo | Mitigación |
|---|---|---|
| R1 | **Atribución compartida:** la app abre y sostiene el embudo, pero convertir lo ejecuta el vendedor. | El compromiso de la herramienta se mide en los indicadores adelantados del mes 1, no solo en el resultado de cartera. |
| R2 | **Incentivos sponsor ↔ gerente:** la transparencia que beneficia al sponsor ilumina lo que hoy nadie ve al gerente. | Diseñar el valor también para el gerente (corte confiable, menos retrabajo), no solo vigilancia. |
| R3 | **Adopción del vendedor:** si la app vigila más de lo que ayuda, se sabotea en silencio. | El seguimiento debe ahorrarle papeleo y ayudarle a vender; medir adopción desde el mes 1. |
| R4 | **Conectividad en ruta.** | NFR offline + sincronización (ver §6); ADR en Fase 2. |
| R5 | **Comingling de fondos:** el dinero del negocio (cobros de clientes) vive en cuentas personales de los vendedores; diluye la transparencia que busca el sponsor (R2) y depende de la honestidad/disciplina del vendedor para entregar lo cobrado. | El **corte semanal es el control**: reconcilia por bolsa lo cobrado menos gastos contra lo que el vendedor debe entregar, volviendo auditable lo que hoy es opaco. A futuro, considerar una cuenta de negocio dedicada. |

## 8. Dependencias e integraciones

- **Escobas La Moderna:** relación de suministro venta-o-devolución en bidones/docenas. No es integración de sistema; es reconciliación lógica dentro del corte.
- **Facturación CFDI:** fuera del sistema en el MVP (proceso externo). Dependencia futura con un PAC si se decide *emitir* en un incremento posterior.
- **Dispositivos móviles** de los vendedores (capacidad offline).

## 9. Bitácora de aprobación

| Versión | Fecha | Quién | Estado |
|---|---|---|---|
| v0.1 | 2026-06-09 | Opsidian (copiloto de proceso) | Borrador inicial |
| v0.2 | 2026-06-09 | Opsidian, a solicitud del PM | Forma de pago por cobro (efectivo/transferencia); corte desglosado por forma de pago; facturar confirmado como eje independiente |
| v0.3 | 2026-06-09 | Opsidian, con datos del cuaderno de operación | S1/S2 validados (direccional); métrica de éxito redefinida (cliente activo = compra sostenida, base recalibrada a ~20–25); tarjeta confirmada como transferencia |
| — | 2026-06-09 | PM (Opsidian) | **Aprobado** — contenido listo; sujeto a firma del sponsor |
| v1.0 | 2026-06-09 | Alonso González (sponsor) | **Firmado** — alcance, criterios de éxito y plan de validación aceptados; PRD como línea base |
| v1.1 | 2026-06-10 | Opsidian (copiloto de proceso), a solicitud del PM | **En revisión** — alcance ampliado con registro de gastos de ruta y backoffice como parte del corte (H-12 nueva, H-10 actualizada, §4 y §7). Expande el alcance firmado: **pendiente de revalidación del sponsor**. |
| v1.2 | 2026-06-10 | Opsidian (copiloto de proceso), a solicitud del PM | **En revisión** — alcance ampliado: gestión de catálogo CRUD (H-13), administración y reasignación de clientes (H-14), dashboard consolidado por periodo (H-15). El corte pasa a registrarse como evento de cierre que delimita el periodo del dashboard. **Pendiente de revalidación del sponsor**. |
| v1.2 | 2026-06-10 | Alonso González (sponsor) | **Revalidado / firmado** — alcance ampliado (gastos, catálogo CRUD, administración y reasignación de clientes, dashboard) aceptado; v1.2 como nueva línea base. |
