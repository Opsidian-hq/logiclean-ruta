# Logiclean — Brief de sistema de diseño
### Entrada a Fase 3 (Diseño de experiencia y prototipo) · proyecto Opsidian

**Persona única del prototipo:** vendedor de ruta. PWA offline-first, operada a una mano, bajo el sol, por usuario no técnico, con conectividad intermitente. Cada decisión visual se optimiza para ella sin concesiones.

---

## 1. Flujos críticos a prototipar
Los únicos que el prototipo *tiene que* demostrar (los demás cuelgan de estos y se diseñan después):

- **Registro de venta offline** — el driver diario; lo más tocado.
- **Seguimiento de prospectos / vencimientos** — la apuesta de crecimiento.

Fuera de la ruta crítica del prototipo (frontera intencional, no olvido): cobro, corte semanal / panel del gerente.

> Trazabilidad: cada pantalla del prototipo nace de una historia del PRD (H-01…H-11). Si no está en el PRD, no se prototipa.

---

## 2. Restricciones heredadas de arquitectura (no negociables)
- **Estado de sincronización siempre visible** como elemento permanente de la interfaz (ADR-0001, offline-first).
- Blancos de toque **≥ 44–48 px**; acción primaria al alcance del pulgar.
- **Alto contraste** para legibilidad bajo el sol.
- Mínimos pasos por tarea; inputs tolerantes al error.

---

## 3. Color — marca traducida a rol de interfaz

| Rol | Color | Hex | Nota |
|---|---|---|---|
| Texto principal · encabezados | Navy | `#001D51` | 15:1 sobre claro |
| Texto de cuerpo · numerales | Casi negro | `#1C1C1E` | 16:1 sobre claro |
| Acción primaria (botón) | Azul eléctrico | `#0606FE` | con texto **blanco** (8:1); no usar como texto fino |
| Acento / identidad (solo sobre oscuro) | Cian | `#33E2FF` | ilegible sobre claro (1.5:1) |
| Identidad / chip | Lima | `#63F714` | solo como relleno con texto oscuro encima |
| Fondo · superficie base | Casi blanco | `#FAFAFA` | superficie elevada: `#FFFFFF` |

**Regla:** cian y lima no pueden portar significado por sí solos sobre fondo claro. Son identidad y chips, nunca texto ni estados sobre claro.

---

## 4. Color funcional (añadido fuera de marca — decisión cerrada)
La marca no trae rojo ni ámbar; el sistema de estado de sincronización los exige.

| Estado | Relleno | Texto sobre claro | Uso |
|---|---|---|---|
| Sincronizado | Lima `#63F714` + texto `#001D51` | — | chip "sincronizado" |
| Pendiente | Ámbar `#F79009` + texto oscuro | `#B54708` | en cola de sincronización |
| Error / fallido | Rojo `#D92D20` + texto blanco | `#B42318` | venta no subió, acción requerida |

**Neutros a añadir:** 2–3 grises para texto secundario, bordes y estados deshabilitados (la marca solo da casi-negro y casi-blanco).

---

## 5. Tipografía
- **Display / marca:** Groovy Smooth — solo momentos de marca (splash, encabezado de marca). Nunca cuerpo ni números.
- **Interfaz / cuerpo:** Aaux Next — peso **≥ medio** por la legibilidad al sol (la Light se evapora al aire libre). Base de cuerpo ~17–18 px.
- **Validar numerales** de Aaux Next: distinción clara 0/O y 1/l, cifras tabulares para cantidades y precios (lo más leído de la app).

---

## 6. Ícono / PWA
- Usar el **isotipo** (la L con el ala) para el ícono de la PWA y el encabezado in-app.
- No usar el lockup con tagline a tamaño pequeño: "Distribuidora de productos de limpieza" es ilegible como ícono.

---

## 7. Gate de salida de Fase 3 (recordatorio)
Para cerrar la fase se exige:
1. **Prototipo aprobado**
2. **Sistema de diseño definido** ✓ (este brief)
3. **Flujos críticos cubiertos** (venta offline + prospectos/vencimientos)

Al cierre de Fase 3 se redacta el **README de handoff** (Design → Code) que traslada la intención del prototipo a Fase 4.

---

*Insumos previos: PRD v1.0 firmado (Fase 1) · ADR-0001 a 0004 aceptados, modelo de datos y plan de incrementos (Fase 2).*
