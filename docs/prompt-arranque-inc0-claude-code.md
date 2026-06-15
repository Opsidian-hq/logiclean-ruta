# Incremento 0 — Cimientos · Arranque en Claude Code
**Proyecto:** Logiclean Ruta (Opsidian) · **Fase 4 · Construcción** · Rama: `inc-0/cimientos`

## Resumen
Construir la **capa de cimientos** sobre la que cuelga todo el producto: andamiaje de la app, backend con autenticación y seguridad por fila, el **motor de sincronización offline** (la zona de máximo cuidado del proyecto), respaldos, y la carga del catálogo con su vista de administración. Este incremento **no** construye los flujos de venta ni de prospectos: prepara el terreno para que nazcan sin deuda.

## Antes de escribir código: lee estos artefactos (ya en `docs/`)
Son la línea base congelada al cierre de Fase 2. Léelos primero; este prompt los resume, no los reemplaza.
- `prd-logiclean-v1_2.md` — requisitos (línea base firmada v1.2).
- `ADR-0001-offline-first.md` … `ADR-0005-framework-react-ionic.md` — las cinco decisiones de arquitectura.
- `modelo-datos-logiclean.md` — el esquema a materializar.
- `plan-incrementos-riesgos-logiclean.md` — el plan y los riesgos técnicos.
- `handoff-logiclean-venta-prospectos.md` — handoff de los flujos (Inc 1 / Inc 2; aún no se construyen).
- `brief-sistema-diseno-logiclean.md` — tokens de diseño (colores, tipografía, tamaños de toque).

> **Primer commit:** deja estos artefactos en `docs/` antes que nada. El porqué viaja al lado del código desde la línea 1.

## Stack objetivo (decidido, no a discutir)
- **React + Ionic React sobre Capacitor**, como PWA (ADR-0005, ADR-0002). El framework ya está decidido: no lo reabras.
- **Estado ligero: Context + hooks de React.** Sin librería de estado formal (Redux, MobX, etc.). El único estado compartido real es la cola offline y el estado de conexión; lo demás es estado local de pantalla.
- **Supabase Cloud:** Postgres + Auth + RLS (ADR-0003, ADR-0004).
- **Offline-first** (ADR-0001): la app opera sin conexión y sincroniza al recuperarla, **sin pérdida ni duplicado**.
- **PKs UUID generadas en cliente** (no autoincrementales): es la base de un sync idempotente y sin colisión de folios.
- Tokens del brief → capa de componentes base; bajar a componentes propios donde el brief lo exija.

## Alcance de Inc 0 — construir en este orden
Cada paso habilita al siguiente.

1. **Andamiaje** React + Ionic React + Capacitor + el commit de `docs/`. Estructura de carpetas y estándar de nombres establecidos como convención del repo (documentarlos en el README).
2. **Backend Supabase:** proyecto, **Auth con roles** (`vendedor` / `gerente`) y **políticas RLS base**. Cada vendedor ve solo su ruta y su cartera; el gerente ve el consolidado. **Cada política RLS = un caso de prueba** (riesgo T4).
3. **Motor de sincronización offline** (BD local ↔ servidor): UUID en cliente, **sync idempotente**, manejo de la cola pendiente. **Zona de máximo cuidado (T1)** — los duplicados, las escrituras perdidas y las colisiones de ID son el riesgo más caro del proyecto.
4. **Respaldos y disponibilidad:** `pg_dump` programado a almacenamiento externo **desde el día uno** (T5) y keep-alive periódico del plan gratis (T6).
5. **Carga del catálogo:** `PRODUCTO_BASE`, `PRESENTACION`, listas de precios (mayoreo/menudeo) y `factor_conversion`.
6. **Vista de administración del gerente:** catálogo CRUD (H-13) y administración de clientes (H-14), incluida la reasignación entre vendedores.

## Modelo de datos a materializar
Crea el **esquema completo** de `modelo-datos-logiclean.md` (es pequeño; hacerlo una vez evita migraciones después). En Inc 0 solo se *cablean* el catálogo y la administración; las demás tablas existen para que los incrementos siguientes construyan encima. Convenciones que vienen del cierre de Fase 2 y no se improvisan:
- `INVENTARIO_VEHICULO.cantidad` es un **contador que se decrementa** en cliente (decisión consciente; seguro porque cada vendedor es dueño único de su dispositivo, sin escritura concurrente).
- `CLIENTE` lleva `dia_ruta` (día de ruta recurrente) **y** `fecha_proxima_visita` (única visita viva). **No** crees una entidad `VISITA_PROGRAMADA`: queda como extensión futura, fuera de alcance.
- `COBRO.tipo` es solo `total` / `parcial`. Una venta a crédito es una **venta sin cobro**; el saldo es derivado.
- **Baja lógica** (`activo = false`) en catálogo y clientes, **nunca DELETE físico**: preserva el histórico de cortes.

## Criterios de aceptación (copiados del PRD v1.2 — no reinterpretar)
**Hito de Inc 0 (plan de Fase 2):** un vendedor inicia sesión, ve el catálogo sin conexión, y un cambio sincroniza ida y vuelta sin pérdida ni duplicado; el gerente da de alta y edita un producto desde su vista de administración. Respaldos corriendo.

**H-13 (catálogo):**
- Dado un producto nuevo, cuando lo doy de alta, entonces queda disponible con sus presentaciones, precios (mayoreo/menudeo) y factor de conversión.
- Dado un producto existente, cuando edito su precio o su factor, entonces las ventas posteriores usan el nuevo valor.
- Dado un producto que ya no se vende, cuando lo doy de baja, entonces se **desactiva** (no se borra) para no romper el histórico de cortes anteriores.

**H-14 (clientes):**
- Dado un cliente, cuando edito sus datos, entonces se actualizan para el vendedor dueño.
- Dado un cliente de un vendedor, cuando lo reasigno a otro, entonces pasa a la cartera del nuevo y deja de verse en la del anterior.
- *(La reasignación es una acción de administrador; cambia al dueño exclusivo definido en el ADR-0001.)*

## Riesgos a tener presentes (de `plan-incrementos-riesgos-logiclean.md`)
- **T1 — Sincronización:** máximo cuidado. UUID en cliente, sync idempotente, casos de prueba dedicados.
- **T4 — RLS / `service_role`:** cada política = un caso de prueba; la llave `service_role` **nunca** en el cliente ni en el repositorio.
- **T5 / T6 — Backups y pausa del plan gratis:** respaldos y keep-alive desde el primer día.
- **T2 / T7 — Offline en iPhone y dato sensible local:** solicitar almacenamiento persistente, instalar a pantalla de inicio, minimizar dato sensible local.

## Fuera de alcance de Inc 0 — NO construir todavía
- Registro de venta, cobranza, inventario en uso, ruta del día → **Inc 1**.
- Seguimiento de prospectos, motor de vencimientos, embudo del gerente → **Inc 2**.
- Corte semanal, reconciliación con La Moderna, gastos de backoffice → **Inc 3**.
- Dashboard consolidado → **Inc 4**.
- CFDI / timbrado, optimización de rutas, merma de envasado → **fuera del MVP completo**.
- Librería de estado formal y entidad `VISITA_PROGRAMADA` → **descartadas por decisión**, no las introduzcas.

## Instrucción
Trabaja en la rama `inc-0/cimientos` contra `main`. Primer commit: `docs/` con los artefactos congelados. Abre PR al terminar el incremento y corre las pruebas —incluidas las de sincronización (T1) y una por cada política RLS (T4)—. El PR no se da por listo hasta que el hito de Inc 0 se demuestre de punta a punta.
