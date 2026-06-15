# ADR-0004: Usar Supabase Auth + RLS para identidad y segmentación de datos por rol

- Estado: aceptado · Aceptado por el PM el 2026-06-10
- Fecha: 2026-06-09 · Decide: PM (Opsidian)
- Requisito que lo origina: NFR de seguridad (PRD §6) — cada vendedor ve su ruta y su cartera; el gerente ve el consolidado; los datos de cliente quedan protegidos. Actores del PRD §3 (vendedor ×2, gerente). Depende de ADR-0003 (Supabase) y ADR-0001 (propiedad exclusiva de cada vendedor).

## Contexto

Hay tres usuarios con dos roles (vendedor, gerente) y una regla de visibilidad estricta: cada vendedor es dueño exclusivo de su cartera y solo ve lo suyo; el gerente ve el consolidado. El backend Supabase expone los datos a través de un API automática, así que la segmentación debe vivir donde no se pueda eludir: en la base de datos misma, no en la app.

## Decisión

Resolver la **identidad** con **Supabase Auth** (login, sesiones, hasheo de contraseñas). Resolver la **autorización y segmentación** con **Row Level Security (RLS)** en Postgres: políticas que atan cada fila a su dueño. El rol vendedor accede solo a las filas de su propia cartera y ruta; el rol gerente accede al consolidado, de solo lectura. La llave `service_role` nunca sale al cliente; la PWA usa únicamente la llave pública (`anon`), segura precisamente porque el RLS guarda las filas.

## Alternativas consideradas

- **Filtrar solo en la app (que el cliente decida qué mostrar):** descartado. El API de Supabase es accesible directamente; sin RLS, cualquiera con la llave pública leería todo. La autorización no puede vivir solo en el cliente.
- **Auth y permisos propios (sistema de login a la medida):** descartado. Supabase Auth ya lo entrega hecho y probado; reinventarlo solo añade superficie de bugs de seguridad.
- **Un backend intermedio que filtre (gateway propio):** descartado por ahora. Añade una capa que construir y mantener; el RLS resuelve la segmentación en la propia base sin código extra.

## Consecuencias

**Se gana**
- La regla de visibilidad del PRD queda forzada por la base de datos misma, no por la app: resiste incluso a que alguien intente saltarse el cliente.
- Login, sesiones y recuperación de contraseña gestionados, sin construirlos.

**Se sacrifica**
- El RLS hay que diseñarlo y probarlo con cuidado: una política mal escrita filtra datos o bloquea de más. Cada política se convierte en caso de prueba en Fase 5 (traza directa con el NFR §6).
- Disciplina operativa permanente: la llave `service_role` jamás en la PWA ni en el repositorio; solo del lado servidor si llega a usarse.
- El dato en el dispositivo (IndexedDB sin cifrar) queda fuera del alcance del RLS; se cubre con bloqueo de dispositivo y minimizando lo guardado localmente (ya anotado en ADR-0003).
