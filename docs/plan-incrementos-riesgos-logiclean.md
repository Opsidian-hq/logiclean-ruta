# Plan de entregas y riesgos técnicos — Logiclean Ruta *(Fase 2)*

> Estado: **aprobado / actualizado 2026-06-16** · Deriva del **PRD v1.2**, de los **ADR-0001…0005** y del modelo de datos. Insumo del Gate de Fase 2.
> **Registro de cambios:** H-07 (cobranza) fue diferido de Inc 1 durante construcción por falta de diseño aprobado. El diseño se completó en un ciclo independiente de Fase 3 (2026-06-16). Se añade **Inc 5 — Cobranza en ruta** para cerrar la deuda antes de Fase 5 (QA). Inc 1 se renombra en consecuencia.
> **Estado por incremento:** Inc 0 ✓ · Inc 1 ✓ (sin H-07) · Inc 2 ✓ · Inc 3 ✓ · Inc 4 ✓ · **Inc 5 en construcción**.

## Plan de entregas por incrementos

Cada incremento es una rebanada demostrable y probable por sí sola. El orden ataca primero el mayor riesgo técnico (la sincronización offline) y luego prioriza la utilidad diaria del vendedor —de la que depende la adopción (R3)— antes de la apuesta estratégica.

### Incremento 0 — Cimientos técnicos
Andamiaje de la PWA (preparada para Capacitor), proyecto Supabase Cloud, autenticación con roles, RLS base, motor de sincronización offline (BD local ↔ servidor), respaldos scriptados y keep-alive. Carga del catálogo (productos base, presentaciones, listas de precios). Incluye la vista de administración del gerente para gestionar el catálogo (H-13) y los clientes (H-14).
- **Hito:** un vendedor inicia sesión, ve el catálogo sin conexión, y un cambio sincroniza ida y vuelta sin pérdida ni duplicado; el gerente da de alta y edita un producto desde su vista de administración. Respaldos corriendo.
- *Por qué primero:* desactiva el riesgo más caro del proyecto (la sincronización) antes de construir valor encima.

### Incremento 1 — Venta, inventario y ruta *(el driver diario)* ✓
Registro de venta de autoventa con lista de precios correcta (H-04), descuento de inventario del vehículo, pedido pendiente (H-05), **registro de gastos de ruta (H-12)**, ruta del día (H-08).
- **Hito:** un vendedor completa una venta **sin señal**, registra un gasto de ruta que baja su bolsa correspondiente, el inventario se descuenta, y todo sincroniza al recuperar conexión.
- *Por qué aquí:* es lo que el vendedor hace todo el día; darle utilidad inmediata es lo que sostiene la adopción.
- **Nota de trazabilidad:** H-07 (cobranza) estaba en el alcance original de este incremento pero fue diferido por falta de diseño aprobado en Fase 3. Se construye en **Inc 5**. El hito de este incremento excluye el cobro en visita; esa brecha es el riesgo R3 que Inc 5 cierra.

### Incremento 2 — Seguimiento de prospectos y panel del gerente *(el corazón de la apuesta)* ✓
Ficha de prospecto con ciclo de visita (H-01), motor de vencimientos "¿a quién visitar esta semana?" (H-02), panel del gerente con embudo y adherencia al seguimiento (H-03).
- **Hito:** el embudo queda poblado y vivo; el vendedor ve a quién le toca esta semana; el gerente ve el embudo por etapa y la adherencia. *(Esto enciende el indicador adelantado del mes 1.)*

### Incremento 3 — Corte semanal y reconciliación ✓
Factor de conversión por presentación (H-11), registro de suministro/devolución con La Moderna, **registro de gastos de backoffice (H-12)**, corte semanal que cuadra vendedor↔ruta (cobros menos gastos por bolsa) y Logiclean↔La Moderna, desglosado por forma de pago (H-10). Incluye los *Should* pendientes: marca "requiere factura" (H-06) y reprogramar/insertar visita (H-09).
- **Hito:** el gerente genera un corte que cuadra el efectivo y las transferencias (netos de gastos), reconcilia con La Moderna en la unidad de compra, y queda registrado como cierre del periodo.

### Incremento 4 — Dashboard consolidado del gerente ✓
Tablero del periodo en curso (H-15): ventas, posición de caja por vendedor y bolsa (netos de gastos), salud del embudo y adherencia, alertas. Casi en tiempo real vía Supabase realtime. Se apoya en que el corte se registra como evento de cierre que delimita el periodo.
- **Hito:** el gerente ve el dashboard del periodo; al generar un corte, los indicadores de flujo (ventas, caja, gastos) se reinician y los de cartera (embudo, adherencia) siguen vivos.

### Incremento 5 — Cobranza en ruta (Flujo C) ← **en construcción**
Registro del cobro de cada venta con forma de pago (H-07): cobro total, parcial y a crédito (venta sin cobro); saldo derivado por cliente; cobros múltiples sobre una venta; cobro de saldo previo desde ficha del cliente. Rama: `inc-5/cobranza`.
- **Hito:** el vendedor registra el cobro en la misma visita en que vende, sin señal, con forma de pago efectivo o transferencia; el saldo del cliente refleja lo pendiente; todo sincroniza al recuperar conexión.
- *Por qué aquí:* cierra el riesgo R3 (adopción) antes de Fase 5. Sin cobro en visita, el flujo diario del vendedor queda incompleto y la herramienta no reemplaza el cuaderno.
- **Insumos:** prototipo `Cobranza_en_ruta.html` (Fase 3, 2026-06-16) · handoff `handoff-logiclean-cobranza.md`.

> **Decisión de secuencia (registrada en Fase 2, 2026-06-11):** Inc 1 antes de Inc 2 para proteger la adopción; Inc 1 e Inc 2 ambos dentro del mes 1 para encender el embudo (indicador adelantado del mes 1). La separación de H-07 en Inc 5 no altera esta decisión; Inc 5 completa Inc 1 antes de que arranque Fase 5.

## Riesgos técnicos y mitigación

| # | Riesgo técnico | Mitigación |
|---|---|---|
| T1 | Sincronización offline: duplicados, escrituras perdidas, colisión de folios/IDs. | IDs únicos generados en cliente (UUID); sync idempotente; casos de prueba dedicados de sincronización en Fase 5. Tratada como zona de máximo cuidado. |
| T2 | Fragilidad del offline en iPhone: purga de almacenamiento, sin background sync. | Solicitar almacenamiento persistente; sincronización agresiva en primer plano; instalación a pantalla de inicio (no pestaña); capas de resiliencia y aviso al usuario. |
| T3 | Fricción de instalación PWA en iPhone → riesgo de adopción (R3). | Instrucciones claras vía Safari; acompañamiento en el arranque con los vendedores. |
| T4 | Fuga de datos entre vendedores o exposición de la llave `service_role`. | RLS bien diseñado y probado (cada política = caso de prueba); `service_role` nunca en cliente ni repositorio; revisión de seguridad. |
| T5 | Pérdida del libro de caja: plan gratis de Supabase sin respaldos automáticos. | Respaldos scriptados (`pg_dump` programado a almacenamiento externo) desde el día uno. |
| T6 | Pausa por inactividad del plan gratis de Supabase. | Keep-alive periódico; disparador de migración a Pro/VPS al techo del plan. |
| T7 | Dato sensible en el dispositivo (IndexedDB sin cifrar). | Bloqueo de dispositivo obligatorio; minimizar el dato sensible guardado localmente. |
| T8 | Reconciliación incorrecta: factor de conversión o venta-o-devolución mal calculados. | Validar el cálculo del corte contra casos reales del cuaderno de operación (mar–jun 2026); criterios de aceptación → casos de prueba en Fase 5. |
| T9 | Uptime del backend (si se elige el VPS dedicado en el disparador). | Amortiguado por el offline-first (el vendedor sigue operando); monitoreo y respaldos. |
| T10 | Un gasto no registrado (u olvidado) rompe el cuadre del corte: la bolsa no cuadra y no se sabe por qué. | Registro de gasto rápido y de baja fricción dentro del flujo diario; el corte resalta los descuadres por bolsa para detectarlos a tiempo. |
