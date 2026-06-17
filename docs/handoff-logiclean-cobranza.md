# Cobranza en ruta (Flujo C) — Handoff a Claude Code
### Puente Fase 3 → Fase 4 · Incremento 5 · proyecto Opsidian · Logiclean Ruta

---

## Resumen

Este bundle implementa el **Flujo C — Cobranza en ruta** (H-07): el registro del
cobro de cada venta indicando forma de pago (efectivo o transferencia), gestión de
cobro total, parcial y a crédito, y consulta/registro de saldo pendiente desde la
ficha del cliente. El flujo se integra como continuación natural del Flujo A
(registro de venta), que ya vive en producción desde Inc 1.

H-07 estaba en el alcance de Inc 1 pero fue diferido por falta de diseño aprobado.
Este incremento cierra esa deuda antes de entrar a Fase 5 (QA).

---

## Stack objetivo

- **PWA cross-platform** con **React + Ionic React sobre Capacitor** (ADR-0005,
  ADR-0002). Una sola base de código para iPhone y Android.
- **Backend Supabase Cloud** (ADR-0003): Postgres + Auth + RLS. La PWA usa
  exclusivamente la llave `anon`; la `service_role` **nunca** sale al cliente ni
  al repo.
- **Offline-first** (ADR-0001): la BD local es la fuente de verdad del vendedor.
  Todo cobro se escribe local al instante y entra a la cola de sync con estado
  **pendiente**. La app nunca bloquea la operación esperando al servidor.
- **IDs UUID generados en cliente** para deduplicar sin esperar confirmación del
  servidor (riesgo T1, zona de máximo cuidado).
- **Estado ligero**: Context + hooks como convención; sin librería de estado formal.
- Patrón de carpetas y estándar de nombres: heredar los establecidos en Inc 0–1.

---

## Componentes reutilizables a usar

Todos construidos en Inc 1 (`fix/fidelidad-visual`, PR #7). Este incremento los
**consume**; no los redefine ni duplica.

| Componente | Uso en Flujo C |
|---|---|
| `Card` | Contenedor de resumen de venta cobrable y fila de cobro individual |
| `Chip` | Etiqueta de forma de pago (efectivo / transferencia) y estado de sync del cobro |
| `PrimaryCTA` | "Registrar cobro", "Confirmar venta + cobro", "Guardar" |
| `ConnectivityStrip` | Banda offline permanente en toda pantalla operativa |
| `SyncStatusBadge` | Estado pendiente → sincronizado → error sobre cada cobro guardado |

Regla: ninguna pantalla de Inc 5 redefine estos componentes; los importa desde la
capa compartida creada en Inc 0.

---

## Intención de diseño

### Punto de entrada — Flujo integrado al carrito

La cobranza **no es una sección separada en el menú**. Es el paso inmediatamente
siguiente al carrito de venta (Flujo A), dentro de la misma sesión de la visita.
El vendedor termina de armar la venta y, antes del botón de confirmar, aparece el
paso de cobro.

Acceso alternativo: desde la **ficha del cliente**, para cobrar saldo pendiente de
visitas anteriores sin una venta nueva activa en esa sesión.

---

### P1 — Paso "¿Cómo cobramos?" (continuación del carrito)

**Cuándo aparece:** después de confirmar los productos de la venta, antes de guardar.

**Qué muestra:**
- Total de la venta en tipografía grande (Aaux Next, peso ≥ medio, cifras tabulares).
- Tres opciones con blancos de toque ≥ 44 px:
  - **Cobro total** — precarga el monto completo; el vendedor solo elige forma de pago.
  - **Cobro parcial** — campo de monto editable + selector de forma de pago.
  - **A crédito** — sin monto ni forma de pago; confirmar con un tap.
- Selector de forma de pago: **Efectivo** / **Transferencia** (únicamente estas dos).
- Al elegir **Transferencia**: mostrar el número de cuenta en un campo de solo lectura
  que el vendedor puede girar hacia el cliente para que lo escanee o lo lea.

**Estados obligatorios:**

| Estado | Comportamiento |
|---|---|
| Happy path | Cobro total en efectivo; CTA activo; flujo de confirmación. |
| Vacío / sin selección | CTA "Confirmar venta" deshabilitado hasta que se elija una opción de cobro. |
| Cargando | Skeleton breve mientras carga el historial de saldo del cliente (puede ser local). |
| Error de sync | El cobro no subió; mensaje tranquilizador: **"Tu cobro está guardado en el equipo"**; opción "Reintentar ahora". El dinero no se pierde. |
| Offline | `ConnectivityStrip` activo; el cobro se guarda igual; la app no bloquea. |

---

### P2 — Confirmación de venta con cobro registrado

**Cuándo aparece:** inmediatamente después de guardar en P1.

**Qué muestra:**
- UUID local con etiqueta "guardando…" (el folio oficial llega al sincronizar).
- Resumen: cliente, total de la venta, forma de pago, monto cobrado.
- Si hay saldo pendiente (cobro parcial o a crédito): saldo visible en color de
  alerta suave — **ámbar informativo, no rojo de error** (es información, no fallo).
- `SyncStatusBadge`: pendiente → sincronizado al recuperar señal.
- CTA de regreso a la ruta del día.

**Estados obligatorios:** los mismos cinco estados de P1. El estado de error
aquí también tranquiliza: el dato está guardado localmente.

---

### P3 — Cobro de saldo previo (desde ficha del cliente)

**Cuándo aparece:** el vendedor visita a un cliente con saldo pendiente de compras
anteriores y entra a la ficha del cliente.

**Qué muestra:**
- Saldo actual del cliente derivado (ventas − cobros previos), desglosado por
  venta/visita si hay más de una pendiente.
- Campo de monto + selector de forma de pago (efectivo / transferencia).
- Historial de cobros anteriores (colapsable para no abrumar en pantalla pequeña).

**Comportamiento offline:** idéntico al resto del flujo — guarda local, sync
posterior. El `SyncStatusBadge` y la `ConnectivityStrip` aplican igual.

**Estado vacío explícito:** si el cliente no tiene saldo pendiente → mensaje
"Sin saldo pendiente" (no lista en blanco).

**Estados obligatorios:** los cinco estados aplican. Error de sync: mismo mensaje
tranquilizador de P1/P2.

---

### P4 — Varios cobros sobre una venta (liquidación en etapas)

**Cuándo aparece:** el vendedor registra un cobro parcial sobre una venta que ya
tenía cobros previos.

**Qué muestra:**
- Lista de cobros ya registrados, cada uno con su propia forma de pago y monto.
- Campo para el nuevo cobro (monto + forma de pago).
- Saldo actualizado de forma derivada (ventas − suma de cobros).

**Regla de negocio crítica:** cada cobro conserva su propia forma de pago
independientemente de los demás. Un cobro puede ser en efectivo y el siguiente en
transferencia sobre la misma venta.

**Estados obligatorios:** los cinco estados aplican.

---

### Regla de modelos de datos que impacta el diseño

- **Venta a crédito = venta sin fila en `COBRO`**. No existe un tipo de cobro
  "crédito"; el crédito se modela por ausencia de cobro y su saldo es derivado
  (ventas − cobros), nunca almacenado.
- **Destino fiscal/no fiscal** se deduce del cruce `requiere_factura × forma_pago`
  en el backend; **no se captura a mano** en ninguna pantalla de este flujo.
- El cobro **alimenta las bolsas del corte** (efectivo en mano / transferencias por
  entregar) en Inc 3 ya construido; este incremento solo registra `COBRO`; el corte
  lo agrega sin cambio.

---

## Criterios de aceptación

Copiados literalmente del PRD v1.2. Son los mismos que QA verificará en Fase 5.

**[H-07] Como** vendedor **quiero** registrar el cobro de cada venta indicando su
forma de pago **para** llevar la cobranza con visibilidad del efectivo y las
transferencias.
*Prioridad: Must*

- Dado una venta, cuando registro un cobro, entonces capturo el monto y la
  **forma de pago** (efectivo o transferencia).
- Dado una venta, cuando registro cobro total, parcial o a crédito, entonces el
  saldo del cliente refleja lo pendiente.
- Dada una venta liquidada en varios momentos, cuando registro cada cobro, entonces
  cada uno conserva su propia forma de pago.

*(Nota de alcance del PRD: facturar (H-06) es un eje independiente. Una venta
facturada o no facturada puede pagarse en efectivo o por transferencia; el destino
fiscal/no fiscal se deduce del cruce, no se captura a mano.)*

---

## Fuera de alcance

Declarado explícitamente para evitar scope creep:

- **H-06 (requiere factura):** ya existe en Flujo A (Inc 1); no se modifica ni
  re-implementa aquí. El cruce `requiere_factura × forma_pago` se resuelve en el
  modelo, no en la UI de cobro.
- **H-10 / corte semanal:** las bolsas que alimenta este cobro ya se agregan en
  Inc 3. Este incremento no toca la lógica del corte.
- **Cobro con tarjeta:** fuera del MVP. Solo efectivo y transferencia.
- **Emisión y timbrado de CFDI:** fuera del MVP.
- **Vista de cobranza consolidada del gerente:** fuera de este prototipo; pertenece
  al dashboard (Inc 4, ya construido).
- **Draft recovery:** fuera del MVP. Si el vendedor sale del flujo sin guardar, el
  estado en memoria se descarta. El registro guardado en BD local es la única
  fuente de verdad. (Decisión de diseño establecida en Inc 1.)

---

## Instrucción

Implementar sobre `main` en la rama `inc-5/cobranza`. Abrir PR y correr las pruebas
antes de dar el incremento por cerrado.

El gate de cierre exige (proceso Opsidian, Definición de Hecho):
- [ ] Código revisado.
- [ ] Pruebas pasando.
- [ ] Criterios de aceptación de H-07 cubiertos por al menos un caso de prueba
      cada uno (trazabilidad directa a Fase 5).
- [ ] Fidelidad visual verificada pantalla por pantalla contra el prototipo
      (prototipo y app en paralelo): layout, colores, tipografía, espaciados.
- [ ] Los cinco estados implementados en cada pantalla (happy path, vacío, carga,
      error de sync, offline).
- [ ] Accesibilidad básica verificada (blancos de toque ≥ 44 px).
- [ ] Sin defectos críticos abiertos.

**El incremento no se da por cerrado si la verificación visual falla, aunque los
tests estén en verde.**

---

*Insumos del handoff: prototipo aprobado `Cobranza_en_ruta.html` (Fase 3) ·
`brief-sistema-diseno-logiclean.md` · PRD v1.2 firmado · ADR-0001…0005 ·
modelo de datos · plan de incrementos (Fase 2) · handoff Flujos A y B (Inc 1–2).*

*Bundle = prototipo + contexto de chat + este README.*
