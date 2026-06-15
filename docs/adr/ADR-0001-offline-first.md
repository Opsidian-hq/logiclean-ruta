# ADR-0001: Adoptar arquitectura offline-first con sincronización incremental

- Estado: aceptado · Aceptado por el PM el 2026-06-10
- Fecha: 2026-06-09 · Decide: PM (Opsidian)
- Requisito que lo origina: PRD §6 (NFR de operación offline + sincronización) y R4. Soporta H-04 (venta), H-07 (cobro), H-01/H-02 (visitas y prospectos) en ruta, y H-03/H-10 (visibilidad del gerente y corte semanal). Supuesto S4 (conectividad intermitente en ruta).

## Contexto

La operación de Logiclean es venta en ruta sobre cobertura intermitente (S4). El negocio depende de que el vendedor registre ventas, cobros y visitas **en el momento**, parado frente al cliente, tenga o no señal, y de que ese dato quede en firme sin pérdida ni duplicado (PRD §6). Al mismo tiempo, el gerente necesita visibilidad oportuna del embudo (H-03) y un corte semanal confiable (H-10). La fuerza que obliga a decidir es esta tensión: registrar sin red en el dispositivo del vendedor vs. consolidar para el gerente en el servidor.

## Decisión

La app opera **offline-first**: cada dispositivo mantiene una base de datos local que es la fuente de verdad para ese vendedor. La app lee y escribe localmente, al instante, con o sin conexión. La sincronización es **incremental y continua**: cada operación sube al servidor apenas hay red, donde se consolida para el panel del gerente y el corte. El servidor es el punto de consolidación y reconciliación, no la fuente de verdad de la operación en ruta.

Alcance de datos en el dispositivo: cartera activa del vendedor + histórico reciente; el detalle histórico antiguo se consulta con conexión. (Confirmado por el PM.)

## Alternativas consideradas

- **Online puro (cliente delgado, todo contra el servidor):** descartado. Viola el requisito de operar sin señal; el vendedor no podría registrar ventas en zonas sin cobertura, que es la operación crítica del negocio.
- **Online con caché (servidor como fuente de verdad, copia local solo de lectura):** descartado. Resuelve la lectura sin señal, pero deja la escritura frágil: sin red la venta no queda registrada en firme. Para sostener la escritura offline habría que añadirle una cola de escritura, con lo que converge de hecho hacia offline-first pero a medias.

## Consecuencias

**Se gana**
- Registro instantáneo y confiable de ventas, cobros y visitas con o sin señal; UX rápida, sin esperas de red.
- La **propiedad exclusiva** de cada vendedor sobre su ruta y cartera elimina casi todos los conflictos de edición concurrente, simplificando enormemente la estrategia de merge (lo único compartido es catálogo y listas de precios, que administra el gerente en una sola dirección).
- La sincronización incremental hace que el panel del gerente se actualice casi en tiempo real cuando hay cobertura.

**Se sacrifica**
- La **sincronización es la zona de mayor riesgo de bugs** (duplicados, escrituras perdidas, colisión de folios/IDs). Mitigación: identificadores únicos generados en cliente (UUID) y casos de prueba dedicados de sincronización en Fase 5.
- El gerente **no ve datos en tiempo real estricto**: hay una latencia de consistencia eventual igual al tiempo que el dispositivo permanezca sin señal. Aceptado: el PRD pide consolidado oportuno (H-03, H-10), no monitoreo en vivo; el tiempo real estricto además agravaría los riesgos R2/R3 (vigilancia, adopción).
- La sincronización continua consume algo más de datos y batería. Despreciable a la escala del proyecto (2 vendedores, ~100 productos, ~50–60 cuentas).
- Obliga a acotar el dataset local para preservar rendimiento en teléfonos de gama baja.
