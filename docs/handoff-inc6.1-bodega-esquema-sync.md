# Inc 6.1 · Bodega — esquema, contadores, eventos y sync idempotente — Handoff a Claude Code
### Puente Fase 2 → Fase 4 · proyecto Opsidian · Logiclean Ruta

## Resumen
Este bundle construye el **cimiento del subsistema de inventario de bodega** de Inc 6: las tablas nuevas, sus contadores materializados, los eventos append-only que los mueven, la RLS con sus GRANTs, y la **extensión del motor de sincronización offline** a esos eventos, garantizando idempotencia. **No incluye pantallas** (van en 6.2+): es la capa de datos + sync sobre la que se montan recepción, envasado, carga, devolución y el corte real. Sin prototipo de Fase 3 (decisión del PM): la intención va descrita aquí; como 6.1 no tiene UI, el riesgo de fidelidad visual no aplica todavía.

## Stack objetivo
- **Offline-first (ADR-0001):** BD local como fuente de verdad; escritura local instantánea; sync incremental. **UUID en cliente**, **sync idempotente** (zona de máximo cuidado, T1/T11).
- **Eventos + contadores materializados (ADR-0007):** cada movimiento es un evento append-only; los contadores de bodega se **materializan** aplicando eventos. Mismo patrón que hoy `venta` → `inventario_vehiculo`, extendido.
- **Supabase Cloud (ADR-0003):** Postgres + API automática. Migraciones en `supabase/migrations/` (siguiendo la numeración existente, la última relevante es `006_categoria_producto.sql`).
- **Identidad y RLS (ADR-0004):** helper `es_gerente()` (lee el rol del JWT). La PWA usa solo la llave `anon`. **Cada tabla nueva necesita `GRANT ... TO authenticated`** además de sus políticas — sin el GRANT, Postgres devuelve `permission denied` antes de evaluar la RLS (lección registrada en ADR-0004).

## Código real a reutilizar (existe en el repo — no inventar)
Localiza y **extiende** estas piezas; no crees paralelas:
- **Motor de sincronización offline** de Inc 0 (BD local ↔ servidor, cola de pendientes, UUID en cliente). Extiéndelo a las tablas de evento nuevas. *(Inspecciona el repo para su ruta y nombre exactos antes de tocarlo.)*
- **Patrón de contador `inventario_vehiculo`** (`supabase/migrations/001_schema.sql`): los contadores de bodega lo replican.
- **Convención de RLS** de `supabase/migrations/002_rls.sql` + `es_gerente()` + trigger `handle_new_vendedor` (`003_roles.sql`).
- **Baja lógica y `gen_random_uuid()`** como convención de todo el esquema.

## Esquema a crear
Tablas (definición canónica en `modelo-datos-inc6-bodega-envasado.md`, adjunto):

**Contadores (estado materializado):**
- `inventario_bodega_base` — por `producto_base_id`: `bidones_disponibles` (químicos, consignación La Moderna), `litros_granel_estimado` (químicos, residuo abierto de Logiclean).
- `inventario_bodega_presentacion` — por `presentacion_id`: `cantidad` (vendible en bodega: químico envasado o pieza).

**Eventos (append-only) + sus líneas:**
- `movimiento_la_moderna` (`tipo`: recibido/devuelto; `producto_base_id`, `fecha`, `cantidad` en unidad de compra, `responsable_id`, `nota`).
- `envasado` (`producto_base_id`, `fecha`, `origen`: bidon_nuevo/granel, `bidones_abiertos`, `litros_consumidos_granel`, `litros_residuo_estimado`, `responsable_id`, `nota`) + `envasado_linea` (`presentacion_id`, `cantidad`).
- `carga_vehiculo` (`vendedor_id`, `fecha`, `responsable_id`, `nota`) + `carga_linea` (`presentacion_id`, `cantidad`).
- `devolucion_bodega` (`vendedor_id`, `fecha`, `responsable_id`, `nota`) + `devolucion_linea` (`presentacion_id`, `cantidad`).

**Efecto de cada evento sobre los contadores:** tabla completa en el modelo adjunto (sección "Efecto de cada evento sobre los contadores"). Impleméntala tal cual; en particular `envasado.origen=granel` **no** incrementa `bidones_abiertos`.

## Intención de comportamiento (capa de datos + sync)
No hay pantallas; la intención es cómo se comporta la capa.

- **Escritura local instantánea + cola.** Un evento de bodega se escribe local al instante y entra a la cola de sync con estado pendiente, con o sin red (reusa el chip de estado existente cuando 6.2+ monte UI).
- **Contador = fold conmutativo del lado servidor, no valor absoluto empujado por el cliente.** El cliente puede mostrar un contador local optimista, pero **la verdad del contador se recomputa en el servidor aplicando los eventos**. Esto es lo que hace segura la **bodega compartida**: el gerente (recepción/envasado) y los vendedores (carga) mutan el mismo inventario; si el contador fuera last-write-wins sobre un valor absoluto, dos syncs concurrentes se pisarían. Como incrementos/decrementos por evento, el orden de llegada no altera el resultado.
- **Idempotencia (crítico, T11).** Cada evento lleva su UUID de cliente; reaplicarlo (reintento, doble push al reconectar) **no** debe volver a mover el contador. La aplicación del evento al contador debe ser exactamente-una-vez por UUID.
- **Sobreventa de bodega — resuelta por operación.** La **carga al vehículo ocurre siempre en la bodega, con internet** (confirmado por el PM, 2026-07-02). Es el único punto de la cadena de bodega que se asume **online**: al cargar, el contador está sincronizado y el vendedor ve el stock real, así que la sobreventa por concurrencia offline no es un escenario esperado. Aun así, el contador se materializa como *fold* conmutativo (arriba) y **se permite** materializar un negativo si llegara a ocurrir, marcándolo como **alerta de reconciliación** —red de seguridad, no control primario. No endurecer la carga contra un offline que no va a pasar; sí dejar el estado de dato que habilita la alerta.
  - **El resto de la cadena sigue offline-first intacto:** recepción, envasado y devolución pueden crearse sin señal; solo la **carga** asume conexión.
- **RLS por tabla:** movimiento La Moderna y envasado → escritura **solo gerente** (`es_gerente()`), lectura autenticados. Contadores de bodega → lectura autenticados, escritura solo vía la lógica de eventos (nunca edición directa del contador). Carga/devolución → el vendedor para su propio vehículo (`vendedor_id = auth.uid()`) o el gerente. **`GRANT ... TO authenticated` en cada tabla nueva.**

## Criterios de aceptación
Trazables a Fase 5. Los de historia (H-16…H-19) se verifican con UI en 6.2+; aquí se verifica la **capa que los soporta**:

**[NFR §6] Operación offline + sincronización (aplicado a eventos de bodega)**
- Dado un evento de bodega creado sin conexión, cuando se recupera la señal, entonces sincroniza **sin pérdida ni duplicado** y su contador materializado queda correcto.
- Dado un mismo evento reintentado o empujado dos veces, cuando se aplica, entonces el contador se mueve **una sola vez** (idempotencia por UUID).
- Dados dos eventos concurrentes sobre el mismo contador, cuando ambos consolidan, entonces el resultado es la suma de sus efectos, **independiente del orden** de llegada.

**[NFR §6] Seguridad (RLS)**
- Dado un vendedor autenticado, cuando consulta o escribe recepción/envasado, entonces la RLS lo **rechaza** (solo gerente).
- Dado un vendedor, cuando registra una carga/devolución de **su** vehículo, entonces se permite; de otro vehículo, se rechaza.
- Cada política nueva = un caso de prueba en Fase 5.

**[Hito 6.1]**
- Un evento de bodega se crea offline, sincroniza sin duplicar al reconectar, y el contador materializado queda correcto.

## Fuera de alcance (no construir en 6.1)
- **Cualquier pantalla/UI** de recepción, envasado, carga o devolución → 6.2, 6.3, 6.4.
- **Rollup de `suministro_la_moderna` y retiro de `/admin/negocio`** → 6.2 (ADR-0006). En 6.1 solo se crea `movimiento_la_moderna`; conectarlo al suministro es 6.2.
- **Reescritura del corte, adeudo por consumo real, identidad de control** → 6.5 (ADR-0009). No tocar `src/lib/corte.ts`, `conversion.ts`, `suministro.ts`, `useCorte.ts` en este PR.
- **Degradar el factor de conversión** → parte de 6.5; en 6.1 no se toca el rol actual del factor.
- **Migración / conteo de apertura / seed / reset de `inventario_vehiculo`** → 6.6.
- **UI de la alerta de sobreventa** → posterior; en 6.1 solo el estado de dato que la habilita.

## Instrucción
- Implementar contra `main`. **Rama:** `inc-6.1/bodega-esquema-sync`. Un PR para esta entrega, no monolítico con el resto de Inc 6.
- Nueva migración `007_bodega_esquema.sql` (o el siguiente número libre): tablas, contadores, RLS + **GRANTs**, índices por FK.
- Extender el motor de sync existente a las tablas de evento nuevas, preservando idempotencia por UUID.
- **Pruebas obligatorias** (traza con los criterios de arriba): sync sin duplicado, reaplicación idempotente, conmutatividad de dos eventos concurrentes, rechazo RLS por rol, y contador negativo materializado como alerta ante sobreventa simulada (red de seguridad; la carga es online por operación, así que no se endurece más allá de esto).
- Abrir PR, correr pruebas verdes antes de pedir revisión.

---
*Insumos del handoff: PRD delta v1.3 (revalidado) · `modelo-datos-inc6-bodega-envasado.md` · ADR-0001, 0003, 0004, 0006, 0007, 0009, 0010 · `plan-inc6-bodega-envasado.md` (sub-rebanada 6.1). Fase 3 omitida por decisión del PM (6.1 sin UI). Bundle = este README + modelo + ADRs.*
