# Matriz de trazabilidad QA — Fase 5

> Estado: **actualizado 2026-06-20** · Cruza los criterios de aceptación del **PRD v1.2 §5–§6** contra los casos de prueba en `tests/`.
> Leyenda: ✓ cubierto · ◐ parcial · ✗ hueco · **(F)** hueco de funcionalidad (falta la lógica, no solo el test) · **(T)** hueco solo de prueba (la lógica existe).
> **Cambio (2026-06-17):** cerrados H-05·2 (lógica + UI de entrega en la ficha), H-13, H-14, H-15·2/3, **H-06·1** (IVA recalculado) y **H-09·1** (inserción ad-hoc). **Todos los criterios del PRD v1.2 quedan cubiertos.**
> **Cierre Fase 5 (2026-06-20):** verificación manual completa — los **31 casos CP-001…CP-031** ejecutados y en verde (`docs/plan-verificacion-manual-qa.md`); los **7 defectos D-001…D-007** corregidos y mergeados (PRs #16–#21); **0 críticos abiertos**; **iOS offline (T2)** verificado en dispositivo → disparador ADR-0002 descartado. Se añaden fitness functions `UIFIT-001…006` (`tests/ui-fitness.test.ts`) que blindan los defectos estructurales reincidentes D-005 (forms anidados) y D-007 (contraste de tabs). **Total: 162 tests automatizados en verde. Gate de Fase 5 CERRADO.**

## Resumen

- **Criterios Must con cobertura completa:** H-01, H-02, H-03, H-04, **H-05**, H-07, H-08, H-10, H-11, H-12, **H-13**, **H-14**, H-15.
- **Should cubiertos:** **H-06** (IVA), **H-09** (reprogramar + inserción ad-hoc).
- **Riesgos técnicos de máximo cuidado — ya blindados:** **T1** (sync idempotente) `T1-001…004` ✓ · **T4** (RLS por tabla) `T4-*` ✓ · **T2** (offline iOS) verificado en dispositivo en `CP-027` ✓ (disparador ADR-0002 descartado).
- **Regresión de UI (defectos estructurales reincidentes):** `UIFIT-001…006` ✓ — D-005 (forms anidados) y D-007 (contraste de tabs sobre navy).
- **Huecos abiertos:** ninguno. ✅

## Matriz por historia

| Historia | Criterio (Gherkin) | Estado | Casos | Nota |
|---|---|---|---|---|
| **H-01** Must | Prospecto nuevo → "visita 1 de 4" + fecha hoy | ✓ | `VISITA-001` | |
| | Registrar visita → avanza ciclo + nota/paso/fecha | ✓ | `VISITA-002/003`, `VISITA-004` | |
| **H-02** Must | Lista de la semana ordenada por urgencia | ✓ | `PROSP-002` | |
| | Visita pasada → "vencido" (color alerta) | ✓ | `PROSP-001` | color es UI; la clasificación está probada |
| **H-03** Must | Embudo por etapa (1.ª–4.ª) | ✓ | `PROSP-003` | |
| | Adherencia % a tiempo | ✓ | `PROSP-004/004b` | |
| **H-04** Must | Lista de precios correcta (may/men) | ✓ | `PRECIO-001/002`, `VENTA-001/002` | |
| | Confirmar → baja inventario + nota | ✓ | `VENTA-001/003`, `VENTA-006` | |
| **H-05** Must | Pedido no disponible → se registra con datos | ✓ | `VENTA-004` | |
| | **Pedido entregado → se convierte en venta y se cierra** | ✓ | `PEDIDO-101…108` | `lib/pedidos.ts` `entregarPedido` + UI en la ficha del cliente (sección "Pedidos pendientes" → Entregar) |
| **H-06** Should | Marca facturable → etiquetada + **monto a precio lista + IVA** | ✓ | `PRECIO-004/005`, `VENTA-008/009/010` | `lib/precios.ts` `totalConFactura`; el total de la venta facturable = subtotal + IVA (16%) |
| **H-07** Must | Cobro captura monto + forma de pago | ✓ | `COBRO-101/102/103/104` | |
| | Total/parcial/crédito → saldo refleja pendiente | ✓ | `COBRO-201…205` | |
| | Liquidación en varios momentos → cada cobro su forma | ✓ | `COBRO-301/302/401/402/403` | |
| **H-08** Must | Ruta del día → clientes/prospectos de hoy | ✓ | `RUTA-001…005` | |
| **H-09** Should | Visita movida de día → aparece en ruta destino | ✓ | `REPROG-001/002/003` | |
| | Insertar pedido/visita ad-hoc en la jornada (hoy o a otra fecha) | ✓ | `REPROG-004/005` | `reprogramarVisita` a hoy → entra en `clientesDeHoy`; a otra fecha → no |
| **H-10** Must | Corte: ventas/cobranza/gastos/inv vendido-devuelto | ✓ | `CORTE-001…006` | |
| | Cobranza desglosada por forma de pago | ✓ | `CORTE-001` | |
| | Gastos ruta bajan bolsa; backoffice salidas de caja | ✓ | `CORTE-001/002`, `GASTO-004`, `BACK-001/002` | |
| | Inventario → bidones; reconciliación La Moderna | ✓ | `CORTE-004`, `CONV-001…004`, `SUM-001…005` | |
| **H-11** Must | Factor bidón→presentación usado por el corte | ✓ | `CONV-001…004` | |
| **H-13** Must | Alta de producto con presentaciones/precios/factor | ✓ | `CAT-101/102` | lógica movida a `lib/catalogo.ts` |
| | Editar precio/factor → ventas posteriores usan nuevo | ✓ | `CAT-103` | precio se congela al vender desde el nuevo valor |
| | Baja → **desactiva, no borra** (preserva histórico) | ✓ | `CAT-104/105` | |
| **H-14** Must | Editar cliente → se actualiza | ✓ | `CLI-101` | lógica movida a `lib/clientes.ts` |
| | Reasignar a otro vendedor → cambia de cartera | ✓ | `CLI-102/103/105` | + `T4-CLIENTE-001/002` (visibilidad RLS) |
| | Baja lógica de cliente → desactiva, no borra | ✓ | `CLI-104` | |
| **H-15** Must | Dashboard: ventas/caja/bolsa/alertas del periodo | ✓ | `DASH-001/002/003` | |
| | Al generar corte → indicadores de flujo se reinician | ✓ | `DASH-004/006` | el flujo deriva solo de snapshots del periodo |
| | Cartera (embudo/adherencia/activa) **no** se reinicia | ✓ | `DASH-003/005` | |
| **NFR offline+sync** | Registrar sin conexión y sincronizar sin pérdida/dup | ✓ | `T1-001…004`, `PULL-001…006` | |
| **NFR seguridad (RLS)** | Cada vendedor ve lo suyo; gerente el consolidado | ✓ | `T4-*` (todas las tablas) | |

## Huecos cerrados (2026-06-17)

- **H-05·2** — `lib/pedidos.ts` `entregarPedido` (conversión pedido→venta + cierre) + `PEDIDO-101…107`. *Pendiente menor: afordancia de UI para disparar la entrega (la lógica de dominio ya cierra el criterio que verifica QA).*
- **H-13** — lógica de catálogo extraída a `lib/catalogo.ts` + `CAT-101…105`.
- **H-14** — lógica de clientes extraída a `lib/clientes.ts` + `CLI-101…105`.
- **H-15·2/3** — `DASH-004…006` (reinicio de flujo / continuidad de cartera).

- **H-06·1** — `lib/precios.ts` `totalConFactura`/`calcularIVA`; la venta facturable recalcula el total a precio de lista + IVA (16%) en el modelo y se refleja en P1/P2 de la venta. Tests `PRECIO-004/005`, `VENTA-008/009/010`. *(Decisión del sponsor 2026-06-17: el MVP recalcula IVA.)*
- **H-09·1** — inserción ad-hoc vía `reprogramarVisita` (a hoy → entra en la ruta del día; a otra fecha → cae en esa jornada). Tests `REPROG-004/005`. La afordancia de UI ya existe en la ficha ("Reprogramar próxima visita → Para hoy").
- **H-05·2 (UI)** — sección "Pedidos pendientes" en la ficha del cliente con acción **Entregar** (convierte el pedido en venta y lo cierra). `lib/pedidos.ts` `pedidosPendientesVista`, test `PEDIDO-108`.

## Huecos abiertos

Ninguno. Todos los criterios de aceptación del PRD v1.2 quedan cubiertos por al menos un caso de prueba.
