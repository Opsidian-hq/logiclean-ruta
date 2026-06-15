# ADR-0003: Usar Supabase como backend — Cloud gratis con migración diferida (Pro o VPS dedicado)

- Estado: aceptado · Aceptado por el PM el 2026-06-10
- Fecha: 2026-06-09 · Decide: PM (Opsidian)
- Requisito que lo origina: Necesidad de un backend que consolide lo que suben los dispositivos (ADR-0001, offline-first) y alimente el panel del gerente (H-03) y el corte semanal (H-10). Naturaleza relacional del corte (H-10, H-11). NFR de seguridad (PRD §6). Restricción de mantener bajo el costo recurrente.

## Contexto

ADR-0001 fijó que el dispositivo es la fuente de verdad y el servidor consolida. Hace falta decidir ese servidor. El corte semanal es relacional por naturaleza (cruza ventas, cobros, inventario, factor de conversión y reconciliación venta-o-devolución). El equipo es chico y lo mantiene Opsidian, que quiere mantenerlo ligero y barato. El VPS existente ya hospeda otros proyectos, por lo que no puede absorber con seguridad el stack de Supabase, que es glotón de memoria.

## Decisión

Adoptar **Supabase** como backend (Postgres + autenticación + tiempo real + API automática). Desplegarlo en **Supabase Cloud, plan gratis**, para construcción y operación temprana, con respaldos scriptados y un keep-alive para evitar la pausa por inactividad.

Disparador de migración: cuando los datos se acerquen al **techo del plan gratis** (~500 MB). En ese punto se elige entre dos destinos, ambos sobre la misma pila (migración, no reescritura), y la decisión se difiere a ese momento:
- **Supabase Cloud Pro** (~25 USD/mes): gestionado, sin migración (es un upgrade del mismo proyecto), menor riesgo operativo.
- **Supabase autohospedado en un VPS dedicado** (~9 USD/mes, KVM 2): más barato, pero Opsidian recupera la operación (respaldos, parches, uptime, seguridad).

## Alternativas consideradas

- **Firebase (Firestore):** descartado. Su modelo documental complica las agregaciones relacionales del corte, y una migración futura sería más cara al no ser la misma pila.
- **Backend a la medida (servidor y BD propios):** descartado. Carga de construcción y operación innecesaria; Supabase entrega auth, tiempo real y API de fábrica.
- **Autohospedar en el VPS compartido existente (KVM 1, 4 GB):** descartado. El stack de Supabase pondría en riesgo por memoria a los otros proyectos del mismo servidor.
- **Cloud Pro desde ya:** descartado por ahora. Pagar 25/mes antes de necesitarlo; el plan gratis cubre la construcción y la operación temprana.

## Consecuencias

**Se gana**
- Cero costo durante construcción y operación temprana; Postgres + auth + tiempo real + API sin construirlos.
- Cloud aporta TLS, cifrado en reposo e infraestructura parchada sin trabajo de Opsidian.
- Al ser Supabase en ambos extremos, el salto futuro (a Pro o a VPS) es mudanza, no reescritura.

**Se sacrifica**
- La seguridad del backend queda en manos de Opsidian en lo que importa: **RLS bien diseñado** (implementa el NFR §6 — cada vendedor solo ve su cartera; el gerente, el consolidado), **nunca exponer la llave `service_role`** en la PWA, **seguridad del dispositivo** (IndexedDB no va cifrado por defecto) y **respaldos**.
- El plan gratis no trae respaldos automáticos ni evita la pausa por inactividad. Mitigación innegociable desde el día uno: respaldos scriptados (`pg_dump` programado a almacenamiento externo) y keep-alive. Es el libro de caja del negocio.
- Uptime: en Cloud lo cubre su SLA; si se elige el VPS dedicado, pasa a Opsidian (amortiguado por el offline-first: los vendedores siguen operando; solo el consolidado espera).
