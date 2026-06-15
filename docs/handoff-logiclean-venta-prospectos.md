# Venta offline + Seguimiento de prospectos — Handoff a Claude Code
### Puente Fase 3 → Fase 4 · proyecto Opsidian · Logiclean Ruta

## Resumen
Este bundle implementa los dos flujos críticos aprobados en Fase 3: **registro de venta offline** (autoventa, con pedido pendiente y doble lista de precios) y **seguimiento de prospectos** (motor de vencimientos + ficha + registro de visita). Ambos operan sin conexión sobre una base local que es la fuente de verdad del vendedor, y sincronizan de forma incremental al recuperar señal, sin pérdida ni duplicado. El prototipo aprobado vive en el bundle de Claude Design adjunto; este README traslada su intención a producción.

## Stack objetivo
- **PWA cross-platform**, un solo código para iPhone y Android, con **Capacitor (Ionic)** como ruta de migración a nativo sin reescritura (ADR-0002). Instalación a pantalla de inicio, no pestaña.
- **Backend Supabase Cloud, plan gratis** (ADR-0003): Postgres + Auth + Realtime + API automática. Respaldos scriptados (`pg_dump` a almacenamiento externo) y keep-alive **desde el día uno** — es el libro de caja del negocio.
- **Identidad y autorización** (ADR-0004): Supabase Auth (login, sesiones) + **Row Level Security** en Postgres. Roles `vendedor` y `gerente`. La PWA usa **solo la llave `anon`**; la `service_role` **nunca** sale al cliente ni al repo.
- **Offline-first** (ADR-0001): BD local en el dispositivo como fuente de verdad por vendedor; lee/escribe local al instante; sincronización incremental y continua. **IDs generados en cliente (UUID)** y **sync idempotente** para evitar duplicados/escrituras perdidas (riesgo T1, zona de máximo cuidado).
- Dato local en IndexedDB **sin cifrar** → bloqueo de dispositivo obligatorio y minimizar lo sensible guardado local (T7).
- **Pendiente de fijar por ADR antes de escribir UI:** el framework JS concreto sobre Ionic/Capacitor no está decidido en ningún ADR. El Incremento 0 lo establece junto con el andamiaje y lo registra como ADR-0005.

> Convención de ramas/PR: ver la sección **Instrucción**.

## Componentes reutilizables a usar
**No existe codebase del cliente todavía (greenfield).** No se reutilizan componentes previos; el **Incremento 0** crea la capa compartida que el resto de incrementos reusa. Esos componentes —a construir en Inc 0, no antes— son:

- **Motor de sincronización** (BD local ↔ servidor) y store offline. Núcleo del riesgo T1: idempotente, UUID en cliente.
- **Chip de estado de sincronización** (sin conexión / guardando / pendiente / sincronizado / error), presente de forma permanente en toda pantalla operativa.
- **Guard de auth + rol** (vendedor / gerente) apoyado en Supabase Auth + RLS.
- **Capa de design tokens** del sistema de diseño (colores, tipografía, tamaños) + componentes base: botón, tarjeta, fila de lista, stepper de cantidad, status-chip. Tokens en el brief adjunto (`brief-sistema-diseno-logiclean.md`).

Regla: ninguna pantalla de Inc 1/Inc 2 redefine estos; los consume.

## Intención de diseño
Comportamiento esperado por flujo (no solo apariencia: estados, transiciones, vacíos, errores).

### Flujo A — Registro de venta offline *(Incremento 1)*
- **Estado por defecto = sin conexión.** Se asume sin señal; el chip lo indica. Armar la venta (cliente, productos del vehículo con stepper de cantidad, total) debe poder completarse en pocos toques sin red.
- **Guardar = escritura local instantánea.** Al tocar "Guardar venta", la venta se escribe al instante en el equipo y entra a la cola de sincronización con estado **pendiente**. Nunca se bloquea el uso esperando al servidor.
- **Transición de sync:** pendiente → **sincronizado** al volver la señal; recién entonces la venta **recibe su folio** (p. ej. LC-0428). El folio es server-side; el UUID de cliente es la identidad real para deduplicar.
- **Estado de error de sync:** si no sube, la venta sigue **guardada en el equipo** y se marca "en cola"; se reintenta sola al volver la señal y ofrece **"Reintentar ahora"**. El mensaje debe tranquilizar: el dato está a salvo localmente.
- **Doble lista de precios:** el `tipo` del cliente decide la lista. Cliente de mayoreo → cada línea toma `precio_mayoreo`; menudeo → `precio_menudeo`. La pantalla debe **dejar visible qué lista se aplica** y, en mayoreo, mostrar el precio de referencia de la otra lista ayuda a la confianza. **El precio se congela al momento de la venta** (no se recalcula después si cambia el catálogo).
- **Pedido pendiente (preventa), dentro del mismo flujo:** cuando el cliente pide algo que el vendedor **no trae en el vehículo**, "Levantar pedido" vive junto a "Agregar del vehículo" — **no es un modo aparte**. Captura producto, cantidad y fecha compromiso. Esa línea **no descuenta inventario** del vehículo y queda marcada como pendiente, con el mismo estado offline/sync. Se da seguimiento por cliente y, **al entregarse, se convierte en venta y se cierra** el pendiente.
- **Descuento de inventario:** al confirmar la venta, `INVENTARIO_VEHICULO` se reduce por las cantidades vendidas y se genera la nota de venta. El pedido pendiente **no** toca inventario hasta convertirse en venta.
- **Caso vacío a definir (el prototipo no lo mostró):** venta sin productos agregados → "Guardar venta" deshabilitado; vehículo sin inventario de un producto → cómo se ofrece levantar pedido.

### Flujo B — Seguimiento de prospectos *(Incremento 2)*
- **Lista del día = abrir la jornada.** Al iniciar, el vendedor ve "¿A quién visitar esta semana?": prospectos con próxima visita por vencer o vencida, **ordenados por urgencia** (vencidos primero). Vencido en **rojo de alerta**, por vencer en **ámbar**, al día en neutral.
- **Ficha del prospecto:** punto en el ciclo ("Visita 2 de 4" con progreso claro), notas previas con fecha, siguiente paso acordado, dirección.
- **Registrar visita:** captura la nota de lo hablado, el siguiente paso y la fecha de la próxima visita; pre-llenado para mínimos toques. Funciona sin conexión.
- **El ciclo avanza:** al guardar, el contador sube (2 → 3 de 4), la próxima visita se reprograma, y la visita queda **pendiente de sync**. `CLIENTE` y `prospecto` son la misma entidad diferenciada por `estado`; el seguimiento vive en `ciclo_visita` + `fecha_proxima_visita`, y cada visita realizada en `VISITA`.
- **Caso vacío a definir:** semana sin prospectos por vencer → estado vacío explícito ("sin visitas por vencer esta semana"), no una lista en blanco.

## Criterios de aceptación
Copiados literalmente del PRD v1.2. Son los mismos que QA verificará en Fase 5; no reinterpretar.

**[H-04] Venta de autoventa con lista de precios correcta — Must**
- Dado un cliente de mayoreo, cuando registro la venta, entonces los precios aplican la lista de mayoreo (y la de menudeo para clientes de menudeo).
- Dado producto vendido, cuando confirmo la venta, entonces el inventario cargado en el vehículo se reduce en esa cantidad y se genera la nota de venta.

**[H-05] Pedido pendiente (preventa) — Must**
- Dado un producto no disponible en el vehículo, cuando el cliente lo pide, entonces se registra como pedido pendiente con cliente, producto, cantidad y fecha compromiso.
- Dado un pedido pendiente, cuando se entrega, entonces se convierte en venta y se cierra el pendiente.

**[H-06] Marca "requiere factura" — Should** *(presente en el prototipo)*
- Dado un cliente que pide factura, cuando marco la venta como facturable, entonces queda etiquetada con los datos necesarios y el monto se calcula a precio de lista + IVA.
- Nota de alcance: el MVP **registra, no timbra**. El timbrado ocurre fuera del sistema.

**[H-01] Registrar prospecto con su punto en el ciclo — Must**
- Dado un prospecto nuevo, cuando lo registro, entonces queda con "visita 1 de 4" y la fecha de hoy.
- Dado un prospecto existente, cuando registro una visita, entonces avanza su contador de ciclo y guarda la nota de lo hablado, el siguiente paso y la fecha de la próxima visita.

**[H-02] Ver vencimientos de la semana — Must**
- Dado prospectos con próxima visita programada, cuando abro la app al iniciar la jornada, entonces veo la lista de los que tocan esta semana ordenados por urgencia.
- Dado un prospecto cuya visita se pasó de fecha, cuando aparece en la lista, entonces se marca como "vencido" en color de alerta.

**[NFR §6] Operación offline + sincronización**
- La app debe permitir registrar ventas, pedidos y visitas **sin conexión** y sincronizar al recuperarla, **sin pérdida ni duplicado** de datos.

**[NFR §6] Seguridad**
- Cada vendedor ve su ruta y su cartera; el gerente ve el consolidado; los datos de cliente quedan protegidos. Cada política de RLS es un caso de prueba en Fase 5.

## Fuera de alcance
No implementar en este bundle:
- **Cobranza (H-07), corte semanal (H-10/H-11), gastos (H-12), dashboard del gerente (H-15), administración de catálogo/clientes (H-13/H-14):** son incrementos posteriores, no estos dos flujos.
- **Ruta del día (H-08) y reprogramar visita (H-09):** fuera de este bundle (Inc 1/Inc 3 según plan).
- **Emisión y timbrado de CFDI con PAC:** fuera del MVP. H-06 solo marca y calcula a precio de lista + IVA; **no timbra**.
- **Optimización de secuencia de ruta** y **registro/medición de merma de envasado:** fuera del MVP.
- **Factor de conversión bidón→presentación y reconciliación con La Moderna:** pertenecen al corte (Inc 3), no a estos flujos.

## Instrucción
- Implementar contra `main`. **Una rama/PR por entrega del plan de Fase 2**, no un PR monolítico:
  1. `inc-0/cimientos` — andamiaje PWA (lista para Capacitor), proyecto Supabase, auth + roles, RLS base, motor de sincronización, respaldos + keep-alive, capa de design tokens y componentes base. Registrar el ADR-0005 (framework). **Hito:** login, catálogo offline, un cambio sincroniza ida y vuelta sin pérdida ni duplicado; respaldos corriendo.
  2. `inc-1/venta-offline` — Flujo A completo (H-04, H-05, H-06) sobre la capa de Inc 0.
  3. `inc-2/prospectos` — Flujo B completo (H-01, H-02) sobre la capa de Inc 0.
- Abrir PR por incremento y correr las pruebas. Cada criterio de aceptación de arriba debe quedar cubierto por al menos un caso de prueba (traza directa con Fase 5).

---
*Insumos del handoff: prototipo aprobado (Fase 3) · `brief-sistema-diseno-logiclean.md` · PRD v1.2 firmado · ADR-0001…0004 · modelo de datos · plan de incrementos. Bundle = prototipo + contexto de chat + este README.*
