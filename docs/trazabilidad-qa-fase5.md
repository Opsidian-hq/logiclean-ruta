# Matriz de trazabilidad QA — Fase 5

> Estado: **actualizado 2026-06-17** · Cruza los criterios de aceptación del **PRD v1.2 §5–§6** contra los casos de prueba en `tests/`.
> Leyenda: ✓ cubierto · ◐ parcial · ✗ hueco · **(F)** hueco de funcionalidad (falta la lógica, no solo el test) · **(T)** hueco solo de prueba (la lógica existe).
> **Cambio (2026-06-17):** cerrados H-05·2 (lógica nueva + tests), H-13, H-14 y H-15·2/3. Quedan abiertos H-06·1 (IVA) y H-09·1 (ad-hoc), pendientes de decisión de alcance.

## Resumen

- **Criterios Must con cobertura completa:** H-01, H-02, H-03, H-04, **H-05**, H-07, H-08, H-10, H-11, H-12, **H-13**, **H-14**, H-15.
- **Riesgos técnicos de máximo cuidado — ya blindados:** **T1** (sync idempotente) `T1-001…004` ✓ · **T4** (RLS por tabla) `T4-*` ✓.
- **Huecos abiertos:** 2 — **H-06·1** (cálculo IVA, *Should*) y **H-09·1** (inserción ad-hoc, *Should*). Ambos requieren decisión de alcance con el PM/sponsor.

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
| | **Pedido entregado → se convierte en venta y se cierra** | ✓ | `PEDIDO-101…107` | `lib/pedidos.ts` `entregarPedido`: crea venta+línea (precio congelado), baja inventario, marca `surtido` |
| **H-06** Should | Marca facturable → etiquetada + **monto a precio lista + IVA** | ✗ **(F)** | — | `requiere_factura` se guarda como flag, pero **no hay cálculo de IVA**; el total no se recalcula. *Abierto: decisión de alcance.* |
| **H-07** Must | Cobro captura monto + forma de pago | ✓ | `COBRO-101/102/103/104` | |
| | Total/parcial/crédito → saldo refleja pendiente | ✓ | `COBRO-201…205` | |
| | Liquidación en varios momentos → cada cobro su forma | ✓ | `COBRO-301/302/401/402/403` | |
| **H-08** Must | Ruta del día → clientes/prospectos de hoy | ✓ | `RUTA-001…005` | |
| **H-09** Should | Visita movida de día → aparece en ruta destino | ✓ | `REPROG-001/002/003` | |
| | Insertar pedido/visita ad-hoc en la jornada | ◐ **(T)** | — | sin caso dedicado de inserción ad-hoc |
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

## Huecos abiertos (requieren decisión de alcance)

1. **H-06·1 — Cálculo a precio de lista + IVA para venta facturable** *(Should)*. Hoy solo se guarda el flag y la UI rotula "Precio de lista + IVA", pero el monto no se recalcula. **Decidir con el sponsor/PM:** ¿el MVP recalcula IVA o el flag solo etiqueta para el proceso externo? Alinear PRD ↔ código según la respuesta.
2. **H-09·1 — Inserción ad-hoc** de visita/pedido en la jornada *(Should)*. Reprogramar está cubierto (`REPROG-*`); falta el caso de inserción ad-hoc dentro de la ruta del día.
