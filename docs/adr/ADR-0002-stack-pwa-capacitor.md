# ADR-0002: Construir el MVP como PWA cross-platform, con Capacitor como ruta a nativo

- Estado: aceptado · Aceptado por el PM el 2026-06-10
- Fecha: 2026-06-09 · Decide: PM (Opsidian)
- Requisito que lo origina: Necesidad de operar en iPhone y Android (definida en Fase 2), NFR de operación offline (PRD §6) y ADR-0001 (offline-first). Restricción del cliente: diferir el costo recurrente de Apple mientras la escala no lo justifique.

## Contexto

Los vendedores usan iPhone y Android, así que la app debe correr en ambas plataformas. ADR-0001 ya fijó que la operación es offline-first, lo que descarta una web puramente online. La fuerza adicional que obliga a decidir es económica y de oportunidad: a la escala actual (2 vendedores) el cliente quiere evitar el costo recurrente de la cuenta de desarrollador de Apple (~99 USD/año), reservando el salto a nativo —con su mejor robustez offline en iOS— para cuando el crecimiento lo amerite. Los usuarios son no técnicos, lo que vuelve la fricción de instalación un factor real.

## Decisión

Construir el MVP como **PWA** sobre un stack web (HTML/CSS/JS), con un solo código para ambas plataformas. Se adopta **Capacitor (Ionic)** como ruta de migración: cuando convenga, ese mismo código se envuelve en una app nativa distribuible por App Store / TestFlight, sin reescritura.

Disparador de migración a nativo (lo que ocurra primero):
- Una pérdida real de datos atribuible a la fragilidad del offline en iOS, o
- Que la operación alcance un grupo de 4 vendedores.

## Alternativas consideradas

- **Nativo ×2 (Swift + Kotlin):** descartado. Duplica construcción y mantenimiento sin retorno a esta escala.
- **Cross-platform nativo desde ya (React Native / Flutter):** descartado *por ahora*. Es robusto y es la dirección del "después", pero forzaría el costo de Apple hoy, justo lo que el cliente quiere diferir.
- **PWA pura sin ruta de migración:** descartado. Volvería el salto futuro a nativo una reescritura desde cero (se pagaría dos veces).

## Consecuencias

**Se gana**
- Cero costo de Apple en el MVP; un solo código para iPhone y Android; despliegue instantáneo sin pasar por tienda ni revisión.
- El código sobrevive al salto a nativo: con Capacitor la migración es envoltura, no reescritura, y ahí se gana almacenamiento nativo robusto.

**Se sacrifica**
- Mientras sea PWA, el offline en iPhone es frágil (purga de almacenamiento por iOS, sin background sync, sincronización solo en primer plano). Mitigación: solicitar almacenamiento persistente, sincronización agresiva en primer plano (acota la ventana de dato sin subir) y capas de resiliencia.
- Instalación manual y escondida en iPhone (Safari → Compartir → Agregar a inicio), sin aviso automático. Cae en el riesgo R3 (adopción). Mitigación: instrucciones claras y acompañamiento en el arranque con los vendedores.
- Se asume vivir con esta fragilidad de forma consciente y acotada hasta que se cumpla el disparador de migración.
