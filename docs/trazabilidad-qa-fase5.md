# Matriz de trazabilidad QA — Fase 5

> Estado: **actualizado 2026-06-17** · Cruza los criterios de aceptación del **PRD v1.2 §5–§6** contra los casos de prueba en `tests/`.
> Leyenda: ✓ cubierto · ◐ parcial · ✗ hueco · **(F)** hueco de funcionalidad (falta la lógica, no solo el test) · **(T)** hueco solo de prueba (la lógica existe).
> **Cambio (2026-06-17):** cerrados H-05·2 (lógica nueva + tests), H-13, H-14, H-15·2/3 y **H-06·1** (IVA recalculado: el sponsor decidió que el MVP sí recalcula). Queda abierto solo H-09·1 (inserción ad-hoc, *Should*).

## Resumen

- **Criterios Must con cobertura completa:** H-01, H-02, H-03, H-04, **H-05**, H-07, H-08, H-10, H-11, H-12, **H-13**, **H-14**, H-15.
- **Should cubiertos:** **H-06** (IVA), H-09 (reprogramar).
- **Riesgos técnicos de máximo cuidado — ya blindados:** **T1** (sync idempotente) `T1-001…004` ✓ · **T4** (RLS por tabla) `T4-*` ✓.
- **Huecos abiertos:** 1 — **H-09·1** (inserción ad-hoc, *Should*).

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
| **H-06** Should | Marca facturable → etiquetada + **monto a precio lista + IVA** | ✓ | `PRECIO-004/005`, `VENTA-008/009/010` | `lib/precios.ts` `totalConFactura`; el total de la venta facturable = subtotal + IVA (16%) |
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

- **H-06·1** — `lib/precios.ts` `totalConFactura`/`calcularIVA`; la venta facturable recalcula el total a precio de lista + IVA (16%) en el modelo y se refleja en P1/P2 de la venta. Tests `PRECIO-004/005`, `VENTA-008/009/010`. *(Decisión del sponsor 2026-06-17: el MVP recalcula IVA.)*

## Huecos abiertos (requieren decisión de alcance)

1. **H-09·1 — Inserción ad-hoc** de visita/pedido en la jornada *(Should)*. Reprogramar está cubierto (`REPROG-*`); falta el caso de inserción ad-hoc dentro de la ruta del día.
