# ADR-0005: Usar React con Ionic React como framework de UI sobre Capacitor

- Estado: aceptado · Aceptado por el PM el 2026-06-11
- Fecha: 2026-06-11 · Decide: PM (Opsidian)
- Requisito que lo origina: ADR-0002 (PWA sobre Capacitor) dejó sin fijar el framework JS de la capa de UI. El handoff de Fase 3 → 4 lo marca como pendiente "antes de escribir UI" y lo asigna al Incremento 0. NFR de operación offline (PRD §6, ADR-0001) y de accesibilidad/uso en teléfonos de gama baja (PRD §6).

## Contexto

ADR-0002 fijó construir el MVP como PWA sobre stack web, con Capacitor (Ionic) como ruta a nativo, pero dejó abierto el framework JS concreto de la capa de UI. El handoff Fase 3 → 4 lo declara bloqueante "antes de escribir UI" y lo asigna al Incremento 0.

La fuerza que obliga a decidir es de secuencia: el Incremento 0 crea la capa compartida —tokens de diseño, componentes base y andamiaje— sobre la que cuelgan el Incremento 1 (venta offline) y el Incremento 2 (prospectos). Ese código nace en un framework, y cambiarlo después es reescritura, no envoltura.

Restricciones reales en juego:
- Usuarios no técnicos sobre teléfonos de gama baja: el peso del bundle y el tiempo de arranque importan (PRD §6).
- Operación offline-first (ADR-0001): la robustez del offline vive en la capa de almacenamiento, no en el framework, por lo que ésta no es la fuerza que diferencia la elección.
- Dato de contexto de operación: el mantenimiento lo opera **Opsidian** —agencia en formación— asistida por Claude, sin un stack de casa previamente fijado. Esto convierte la elección en candidata a **stack default de la agencia**, no solo de este proyecto, y desplaza el peso desde "pool de talento de un tercero" hacia "amplitud de ecosistema y profundidad del soporte asistido por Claude".

## Decisión

Construir la capa de UI con **React**, usando **Ionic React** para los componentes con apariencia nativa, sobre el Capacitor ya decidido en ADR-0002. Ionic React provee el puente con Capacitor y la librería de componentes; los tokens del brief de diseño se aplican encima, bajando a componentes propios donde el brief lo exija.

## Alternativas consideradas

- **Angular con Ionic Angular** (la dupla histórica de Ionic): descartado. Su estructura rígida, inyección de dependencias y framework completo están pensados para apps empresariales de larga vida y equipos grandes. A escala de 2–4 usuarios y un MVP que debe despachar rápido, esas virtudes no pagan su costo en curva de aprendizaje ni en peso de bundle sobre gama baja.
- **Vue con Ionic Vue**: descartado por poco; es el segundo lugar honesto. Es el más liviano y el de mejor experiencia de desarrollo. Pierde frente a React por menor amplitud de ecosistema para los problemas recurrentes del producto (offline, PWA, sincronización) y por menor profundidad de soporte en el ciclo de mantenimiento asistido por Claude —factor decisivo dado que Opsidian + Claude son el equipo de operación.
- Las alternativas de plataforma (nativo ×2, React Native / Flutter) ya quedaron descartadas en ADR-0002 por la decisión PWA previa.

## Consecuencias

**Se gana**
- Ecosistema más amplio para los problemas que se repetirán (offline, PWA, sincronización): rara vez un problema sin solución comunitaria documentada.
- Mantenimiento asistido por Claude más predecible: patrones y convenciones consolidadas, menos ambigüedad al generar y revisar código.
- Bundle más liviano que Angular en gama baja y mejor arranque para los vendedores (NFR PRD §6).
- Compatibilidad de primera con Capacitor vía Ionic React; el código sobrevive el salto a nativo como envoltura, no reescritura, que ADR-0002 reserva para su disparador de migración.
- Primer ladrillo de un stack default para Opsidian: los próximos proyectos parten de aquí y no de una discusión desde cero.

**Se sacrifica**
- Más decisiones de librería abiertas que Angular (ruteo, manejo de estado): React es menos "baterías incluidas". Mitigación: fijar esas piezas como convenciones del Incremento 0 y registrar con un ADR propio cualquiera que resulte arquitectónicamente significativa.
- Se renuncia al bundle mínimo absoluto de Vue. Mitigación: presupuesto de bundle vigilado desde el Incremento 0 y carga diferida de los Incrementos 1 y 2.
- Estandarizar de facto sobre React introduce cierta rigidez de agencia: el siguiente proyecto heredará esta elección aunque su contexto difiera. Mitigación: este ADR es candidato a stack default, no mandato; un proyecto con contexto distinto puede abrir su propio ADR que lo reemplace para ese caso.
