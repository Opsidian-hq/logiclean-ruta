# Plan de verificación manual — Logiclean Ruta
### Fase 5 · QA · Opsidian

> **Propósito:** confirmar que el producto construido es el producto correcto y que
> funciona en las manos de los usuarios reales, en condiciones reales. La cobertura
> automatizada (146 tests, `docs/trazabilidad-qa-fase5.md`) ya verifica la lógica;
> esta sesión verifica la experiencia y los casos que ningún test automatizado puede
> cubrir.

---

## Alcance

**Dentro:** todos los flujos del MVP — Flujo A (venta), Flujo B (prospectos), Flujo C
(cobranza), corte semanal, dashboard, catálogo, clientes, gastos, ruta del día,
comportamiento offline, fidelidad visual, accesibilidad básica, iOS offline (T2).

**Fuera:** emisión de CFDI, optimización de ruta, contabilidad general. Ninguno de
estos fue construido; no se verifican.

---

## Entorno y datos de prueba

| Ítem | Valor |
|---|---|
| URL del build | `[URL del deploy]` |
| Usuario vendedor | `vendedor@logiclean.mx` (contraseña rotada) |
| Usuario gerente | `gerente@logiclean.mx` (contraseña rotada) |
| Dispositivos objetivo | Android gama baja (primario) + iPhone/Safari (T2) |
| Datos de prueba | Catálogo y clientes seed cargados desde Inc 0 |

---

## Criterios de entrada

- [ ] Build desplegado y accesible desde el dispositivo de prueba.
- [ ] Credenciales rotadas (✓ hecho).
- [ ] `docs/trazabilidad-qa-fase5.md` disponible en el repo como referencia de
      trazabilidad.

## Criterios de salida (gate de Fase 5)

- [ ] 100% de los criterios de aceptación del PRD v1.2 verificados manualmente.
- [ ] 0 defectos críticos abiertos.
- [ ] Pruebas de accesibilidad básica ejecutadas.
- [ ] iOS offline verificado (T2) o riesgo declarado explícitamente.

---

## Sesiones de verificación

### Sesión 1 — Flujo A: Venta + cobranza en visita
*Rol: vendedor. Dispositivo: Android.*

**CP-001 · Venta de autoventa a cliente mayoreo**
- Traza: H-04 criterio 1
- Precondición: sesión activa como vendedor; hay clientes de mayoreo en la ruta.
- Pasos: entrar a la ruta del día → seleccionar un cliente mayoreo → registrar una venta con 2–3 productos → confirmar.
- Esperado: los precios aplican la lista de mayoreo; el inventario del vehículo se reduce; se genera la nota de venta.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-002 · Venta de autoventa a cliente menudeo**
- Traza: H-04 criterio 1
- Pasos: mismo flujo con un cliente menudeo.
- Esperado: los precios aplican la lista de menudeo.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-003 · Cobro total en efectivo al cerrar venta**
- Traza: H-07 criterio 1
- Pasos: tras confirmar productos de una venta → en el paso de cobro elegir "Cobro total" → forma de pago "Efectivo" → guardar.
- Esperado: la venta queda guardada con su cobro; no hay saldo pendiente para ese cliente.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-004 · Cobro parcial con transferencia**
- Traza: H-07 criterios 1 y 2
- Pasos: registrar venta → cobro parcial → "Transferencia" → monto menor al total → guardar.
- Esperado: saldo pendiente visible en ámbar; forma de pago correcta en el resumen; número de cuenta mostrado durante la captura.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-005 · Venta a crédito (sin cobro)**
- Traza: H-07 criterio 2
- Pasos: registrar venta → elegir "A crédito" → confirmar.
- Esperado: la venta se guarda sin cobro; el saldo del cliente refleja el total como pendiente.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-006 · Cobros múltiples sobre una venta**
- Traza: H-07 criterio 3
- Pasos: desde la ficha del cliente con saldo pendiente → registrar un cobro parcial en efectivo → registrar otro cobro parcial en transferencia.
- Esperado: cada cobro conserva su propia forma de pago; el saldo se reduce correctamente con cada cobro.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-007 · Pedido pendiente**
- Traza: H-05 criterios 1 y 2
- Pasos: en una venta, registrar un pedido de un producto no disponible → en otra sesión, marcar el pedido como entregado.
- Esperado: el pedido queda registrado; al entregarlo se convierte en venta y se cierra el pendiente.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-008 · Marcar venta como "requiere factura"**
- Traza: H-06
- Pasos: registrar venta → activar "requiere factura".
- Esperado: el monto se calcula a precio de lista + IVA; la venta queda etiquetada.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-009 · Gasto de ruta en efectivo**
- Traza: H-12 criterios 1 y 2
- Pasos: registrar un gasto de tipo ruta con forma de pago efectivo.
- Esperado: queda registrado con tipo, categoría, monto, fecha y forma de pago.
- Resultado: ☐ pasa ☐ falla · Notas: ___

---

### Sesión 2 — Flujo B: Prospectos y ruta del día
*Rol: vendedor. Dispositivo: Android.*

**CP-010 · Registro de prospecto nuevo**
- Traza: H-01 criterio 1
- Pasos: agregar un prospecto nuevo desde la app.
- Esperado: queda con "visita 1 de 4" y la fecha de hoy.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-011 · Avance de ciclo en visita a prospecto**
- Traza: H-01 criterio 2
- Pasos: registrar una visita a un prospecto existente con nota, siguiente paso y fecha de próxima visita.
- Esperado: el contador de ciclo avanza; nota y fecha quedan guardados.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-012 · Motor de vencimientos al iniciar jornada**
- Traza: H-02 criterios 1 y 2
- Pasos: abrir la app con al menos un prospecto con visita vencida y uno próximo a vencer.
- Esperado: el vencido aparece con alerta de color; el próximo aparece en la lista ordenado por urgencia.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-013 · Ruta del día**
- Traza: H-08
- Pasos: abrir la ruta del día.
- Esperado: lista de clientes y prospectos a visitar hoy, en el orden conocido.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-014 · Insertar visita ad-hoc**
- Traza: H-09 criterio 1
- Pasos: agregar una visita fuera de la ruta planeada para atenderla hoy.
- Esperado: aparece en la ruta del día actual.
- Resultado: ☐ pasa ☐ falla · Notas: ___

---

### Sesión 3 — Corte semanal y dashboard
*Rol: gerente.*

**CP-015 · Generación del corte semanal**
- Traza: H-10 criterios 1, 2 y 3
- Precondición: hay ventas, cobros y gastos registrados en el periodo.
- Pasos: generar el corte semanal.
- Esperado: muestra ventas, cobranza desglosada por forma de pago (efectivo/transferencia), gastos de ruta descontados de la bolsa correspondiente, gastos de backoffice como salidas de caja, inventario vendido vs. devuelto.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-016 · Reconciliación bidones en el corte**
- Traza: H-10 criterio 4 + H-11
- Pasos: en el corte, verificar que el inventario en presentaciones se convierte a bidones usando el factor definido.
- Esperado: el total de unidades vendidas aparece en bidones para la reconciliación con La Moderna.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-017 · Reinicio de indicadores de flujo al generar corte**
- Traza: H-15 criterio 2
- Pasos: revisar el dashboard antes y después de generar el corte.
- Esperado: ventas, caja y gastos del periodo se reinician; el embudo y la adherencia NO se reinician.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-018 · Dashboard consolidado del gerente**
- Traza: H-15 criterio 1
- Pasos: abrir el dashboard.
- Esperado: ventas del periodo, posición de caja por vendedor y bolsa (neta de gastos), alertas de prospectos vencidos o descuadres.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-019 · Embudo de prospectos en el panel del gerente**
- Traza: H-03 criterios 1 y 2
- Pasos: con prospectos en distintas etapas del ciclo, abrir el panel del gerente.
- Esperado: prospectos por etapa (1.ª–4.ª visita); porcentaje de adherencia visible.
- Resultado: ☐ pasa ☐ falla · Notas: ___

---

### Sesión 4 — Administración (gerente)

**CP-020 · Alta de producto en catálogo**
- Traza: H-13 criterio 1
- Pasos: dar de alta un producto nuevo con presentaciones, precios y factor de conversión.
- Esperado: el producto queda disponible para ventas posteriores.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-021 · Edición de precio de producto**
- Traza: H-13 criterio 2
- Pasos: editar el precio de un producto existente.
- Esperado: las ventas registradas después del cambio usan el nuevo precio.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-022 · Baja de producto (desactivación)**
- Traza: H-13 criterio 3
- Pasos: dar de baja un producto con historial de ventas.
- Esperado: el producto se desactiva (no se borra); el historial previo permanece intacto.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-023 · Reasignación de cliente entre vendedores**
- Traza: H-14 criterio 2
- Pasos: reasignar un cliente de un vendedor al otro.
- Esperado: el cliente aparece en la cartera del nuevo vendedor y desaparece de la del anterior.
- Resultado: ☐ pasa ☐ falla · Notas: ___

---

### Sesión 5 — Comportamiento offline
*Ambos roles. Esta sesión verifica lo que los tests automatizados no pueden.*

**CP-024 · Registro de venta sin señal**
- Traza: NFR offline (PRD §6)
- Pasos: activar modo avión → registrar una venta completa con cobro → verificar que la app no bloquea la operación → recuperar señal → esperar sync.
- Esperado: la venta y el cobro se guardan localmente al instante con estado "pendiente"; al recuperar señal se sincronizan; el `SyncStatusBadge` pasa a "sincronizado".
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-025 · ConnectivityStrip visible offline**
- Traza: NFR offline
- Pasos: activar modo avión → abrir cualquier pantalla operativa.
- Esperado: la `ConnectivityStrip` aparece en todas las pantallas operativas.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-026 · Sync agresivo al recuperar señal**
- Traza: T2 (deuda técnica cerrada)
- Pasos: registrar 2–3 operaciones en modo avión → recuperar señal → medir cuánto tarda en sincronizar sin acción manual.
- Esperado: la sync dispara automáticamente al detectar conexión; sin necesidad de que el usuario la inicie.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-027 · iOS offline — instalar PWA y registrar venta (T2)**
- Traza: ADR-0002 + T2
- Precondición: iPhone con Safari.
- Pasos: instalar la app desde Safari (Compartir → Agregar a inicio) → registrar una venta sin señal → enviar la app al fondo → volver a primer plano → verificar sync.
- Esperado: la venta sobrevive al segundo plano; al volver al primer plano con señal, sincroniza automáticamente.
- Resultado: ☐ pasa ☐ falla ☐ no ejecutado (sin dispositivo iOS) · Notas: ___
- **Nota de riesgo:** si este caso falla con pérdida de datos, se activa el disparador de migración a Capacitor nativo definido en ADR-0002. Registrar el resultado con detalle.

---

### Sesión 6 — Accesibilidad y experiencia de uso
*Vendedor no técnico, condiciones de campo.*

**CP-028 · Uso a una mano**
- Traza: NFR accesibilidad (PRD §6)
- Pasos: completar un flujo completo de venta + cobro usando solo el pulgar de la mano dominante.
- Esperado: todos los elementos interactivos son alcanzables sin reposicionar el teléfono; blancos de toque ≥ 44 px.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-029 · Legibilidad bajo el sol**
- Pasos: usar la app al aire libre con brillo del sol directo sobre la pantalla.
- Esperado: texto y botones legibles sin ajuste manual del brillo.
- Resultado: ☐ pasa ☐ falla · Notas: ___

**CP-030 · Velocidad de arranque**
- Traza: NFR rendimiento (PRD §6)
- Pasos: cerrar completamente la app → abrirla → medir el tiempo hasta que la ruta del día es visible e interactuable.
- Esperado: arranque en segundos, no en decenas de segundos.
- Resultado: ☐ pasa ☐ falla · tiempo medido: ___ seg · Notas: ___

**CP-031 · Registro de venta — tiempo de operación**
- Traza: NFR rendimiento
- Pasos: desde la ruta del día, completar una venta de 3 productos con cobro.
- Esperado: operación completa en menos de 2 minutos para un usuario familiarizado.
- Resultado: ☐ pasa ☐ falla · tiempo medido: ___ min · Notas: ___

---

## Registro de defectos

| ID | CP | Descripción | Severidad | Estado |
|---|---|---|---|---|
| D-001 | | | crítico / mayor / menor | abierto / cerrado |

**Severidades:**
- **Crítico:** bloquea el uso o corrompe datos. El gate exige 0 críticos abiertos.
- **Mayor:** funcionalidad incompleta o incorrecta, pero con workaround.
- **Menor:** visual, texto, comportamiento no esperado sin impacto operativo.

---

## Gate de cierre de Fase 5

- [ ] CP-001 a CP-031 ejecutados (o CP-027 con riesgo declarado si no hay iPhone).
- [ ] 0 defectos críticos abiertos.
- [ ] Accesibilidad básica verificada (CP-028, CP-029).
- [ ] Resultado de iOS offline documentado en CP-027.
- [ ] Resultados trazados a `docs/trazabilidad-qa-fase5.md`.

Con el gate cerrado, el producto avanza a **Fase 6 (Despliegue y entrega)**.

---

*Insumos: PRD v1.2 firmado · docs/trazabilidad-qa-fase5.md (cobertura automatizada) ·
ADR-0002 (disparador de migración iOS) · build desplegado.*
