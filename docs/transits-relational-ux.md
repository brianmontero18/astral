# Tránsitos Relacionales UX

**Fecha:** 2026-05-09  
**Estado:** propuesta UX v0, no decisión final  
**Documentos base:** [transits-time-selector-adr.md](./transits-time-selector-adr.md), [bodygraph-relacional.md](./bodygraph-relacional.md), [competencia.md](./competencia.md)

Este documento propone cómo extender la experiencia de Tránsitos para soportar una lectura relacional entre dos bodygraphs, sin reemplazar el ADR actual. El ADR resuelve la pregunta "qué tránsito me afecta ahora" para una carta individual. Esta propuesta agrega una capa previa: "sobre qué carta o cruce estoy mirando ese tránsito".

No define arquitectura técnica, base de datos, endpoints ni contratos finales. Es un wireframe de producto para validar alcance V1.

## Tesis UX

La pantalla de Tránsitos tiene que manejar dos ejes:

| Eje | Pregunta | Control principal |
|---|---|---|
| Contexto | ¿Sobre qué carta o cruce estoy leyendo? | Selector de contexto |
| Tiempo | ¿En qué momento estoy leyendo el tránsito? | `Hoy`, slider diario, `Próximos 7 días` |

La extensión relacional no debería crear una sección separada ni duplicar la lógica mental. Debería usar la misma pantalla y cambiar la interpretación según el contexto seleccionado:

- si el contexto es una carta individual, se mantiene la experiencia del ADR;
- si el contexto es un cruce A+B, el mismo tránsito se lee en tres capas: impacto en A, impacto en B e impacto en la relación A+B.

## Principios

1. **Contexto primero, tiempo después.** Antes de hablar de "ahora", la UI debe dejar claro "ahora para quién o para qué cruce".
2. **No vender compatibilidad.** El lenguaje debe ser activación, condicionamiento, completitud, amplificación, fricción y observación. No ranking, score ni predicción vincular.
3. **Una pantalla, dos modos.** Carta individual y cruce viven en la misma sección, pero con jerarquía editorial distinta.
4. **El tránsito es uno; las lecturas son varias.** El snapshot colectivo del cielo es el mismo, pero cambia la lectura según carta A, carta B y el campo relacional.
5. **V1 de dos bodygraphs.** Penta, equipos, grupos y cruces de más de dos quedan fuera de esta propuesta.
6. **El chat hereda contexto explícito.** Preguntar al agente desde esta pantalla debe llevar contexto + hora + capa seleccionada.

## Modelo Mental De Pantalla

```text
Tránsitos
  ├─ Selector de contexto
  │    ├─ Carta individual
  │    └─ Cruce A+B
  ├─ Selector temporal
  │    ├─ Hoy / Ahora
  │    ├─ Slider diario
  │    └─ Próximos 7 días
  ├─ Lectura principal
  │    ├─ Carta individual: qué se activa en esa carta
  │    └─ Cruce: qué se activa en la dinámica A+B
  ├─ Capas de detalle
  │    ├─ En A
  │    ├─ En B
  │    └─ En el cruce
  └─ Chat contextual
```

## Navegación Propuesta

La sección seguiría entrando por `Tránsitos`, pero el header incorpora un selector de contexto.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Mi carta - Brian           ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
└─────────────────────────────────────────────┘
```

El selector no es un filtro técnico. Es una decisión de lectura. Podría listar:

- `Mi carta`;
- cartas/personas guardadas;
- cruces guardados;
- acción `Crear cruce`;
- acción `Carta temporal` si se decide permitir lecturas sin guardar.

## Wireframe 1: Carta Individual

Este modo conserva la intención del ADR actual. Es la pantalla base y no debería cambiar de manera dramática.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Mi carta - Brian           ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ Ahora · 11:42                      ↻        │
│ Sábado 9 mayo                               │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL AHORA                          │
│ Sacral + Garganta están activados           │
│ Hay impulso para responder y poner voz      │
│ a algo que ya está presente.                │
├─────────────────────────────────────────────┤
│ Cómo te toca                                │
│ ┌ Canal temporal ────────────────────────┐  │
│ │ Tu Puerta 20 + tránsito en 34          │  │
│ │ Energía disponible: acción con voz     │  │
│ └────────────────────────────────────────┘  │
│ ┌ Centro condicionado ───────────────────┐  │
│ │ Sacral                                 │  │
│ │ Más presión para hacer o decidir       │  │
│ └────────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ Explorar el día                             │
│ 00  03  06  09  12  15  18  21             │
│              ● Ahora                        │
├─────────────────────────────────────────────┤
│ Centros                                     │
│ Definidos temp.   [Garganta]                │
│ Condicionados     [Sacral] [Raíz]           │
│ Activados         [Ajna]                    │
├─────────────────────────────────────────────┤
│ Detalle planetario                      ▼   │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente sobre ahora ]       │
└─────────────────────────────────────────────┘
```

## Wireframe 2: Cruce A+B Hoy

Cuando el contexto es un cruce, el hero no debería decir "cómo te toca" en singular. Tiene que explicar qué está pasando en el campo relacional.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Brian + Negocio AUREA      ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ Ahora · 11:42                      ↻        │
│ Sábado 9 mayo                               │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL DEL CRUCE                      │
│ El tránsito completa una conexión entre     │
│ la dirección del negocio y tu capacidad     │
│ de respuesta.                               │
│ Hechos: 20-34 · Sacral · Garganta           │
├─────────────────────────────────────────────┤
│ [ Resumen ] [ En Brian ] [ En AUREA ]       │
│ [ En el cruce ]                             │
├─────────────────────────────────────────────┤
│ Resumen                                     │
│ ┌ Activación compartida ─────────────────┐  │
│ │ Sacral y Garganta toman protagonismo   │  │
│ │ para este cruce durante este momento.  │  │
│ └────────────────────────────────────────┘  │
│ ┌ Completitud relacional ────────────────┐  │
│ │ Brian aporta una puerta; el tránsito   │  │
│ │ completa el canal que el negocio       │  │
│ │ necesita expresar.                     │  │
│ └────────────────────────────────────────┘  │
│ ┌ Observación práctica ──────────────────┐  │
│ │ Buen momento para mirar decisiones     │  │
│ │ donde respuesta y voz del negocio      │  │
│ │ tienen que alinearse.                  │  │
│ └────────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ Explorar el día                             │
│ 00  03  06  09  12  15  18  21             │
│              ● Ahora                        │
├─────────────────────────────────────────────┤
│ Centros del cruce                           │
│ Amplificados      [Sacral]                  │
│ Condicionados     [Garganta]                │
│ Definidos temp.   [Raíz]                    │
├─────────────────────────────────────────────┤
│ Detalle planetario                      ▼   │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente sobre este cruce ]  │
└─────────────────────────────────────────────┘
```

La pestaña `Resumen` debería ser editorial. No tiene que mostrar todas las tarjetas de A y B. Su trabajo es responder rápido: "qué cambia en esta relación bajo este tránsito".

## Wireframe 3: Capas Del Cruce

Las capas evitan mezclar lecturas. La usuaria puede pasar de la síntesis a una lectura orientada por sujeto.

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian + Cliente X            ▼    │
│ Ahora · 11:42                               │
│ [ Resumen ] [ En Brian ] [ En Cliente X ]   │
│ [ En el cruce ]                             │
├─────────────────────────────────────────────┤
│ En Brian                                    │
│ ┌ Puerta reforzada ──────────────────────┐  │
│ │ El tránsito refuerza una puerta que    │  │
│ │ Brian ya trae definida.                │  │
│ └────────────────────────────────────────┘  │
│ ┌ Centro condicionado ───────────────────┐  │
│ │ Sacral: más presión para responder.    │  │
│ └────────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ En Cliente X                                │
│ ┌ Canal temporal ────────────────────────┐  │
│ │ El tránsito completa una puerta que    │  │
│ │ Cliente X no tiene consistente.        │  │
│ └────────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ En el cruce                                 │
│ ┌ Lo que uno activa en el otro ──────────┐  │
│ │ Brian aporta estabilidad en un centro  │  │
│ │ que Cliente X vive como variable.      │  │
│ └────────────────────────────────────────┘  │
│ ┌ Fricción a observar ───────────────────┐  │
│ │ Puede aparecer urgencia por decidir    │  │
│ │ antes de que haya claridad emocional.  │  │
│ └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

En mobile, estas capas deberían comportarse como tabs horizontales o un selector compacto. En desktop, pueden mostrarse como tabs o como columnas si hay espacio suficiente.

## Wireframe 4: Hora Seleccionada En Un Cruce

El slider del ADR se conserva. La diferencia es que la etiqueta debe dejar claro que estamos mirando una hora seleccionada para un cruce.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Cliente X + Pareja         ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ A las 14:00                      [Ahora]    │
│ Sábado 9 mayo                               │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL A LAS 14:00                    │
│ El tránsito activa presión mental en A      │
│ y completa expresión en B. En el cruce,     │
│ el tema es hablar sin resolver de más.      │
├─────────────────────────────────────────────┤
│ [ Resumen ] [ En Cliente X ] [ En Pareja ]  │
│ [ En el cruce ]                             │
├─────────────────────────────────────────────┤
│ Explorar el día                             │
│ 00  03  06  09  12  15  18  21             │
│                 ● 14:00                     │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente sobre las 14:00 ]   │
└─────────────────────────────────────────────┘
```

La acción `Ahora` no vuelve a la muestra horaria más cercana. Vuelve a tomar una foto actual, como define el ADR.

## Wireframe 5: Próximos 7 Días En Un Cruce

La vista semanal en cruce debería ser un panorama de ventanas relacionales, no un calendario astrológico denso.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Brian + Negocio AUREA      ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ 9 mayo - 15 mayo                            │
├─────────────────────────────────────────────┤
│ TEMA DEL CRUCE ESTA SEMANA                  │
│ Más presión para convertir respuesta        │
│ interna en mensaje visible del negocio.     │
├─────────────────────────────────────────────┤
│ Ventanas relevantes                         │
│ Hoy        Sacral amplificado en el cruce   │
│ Lunes      Canal temporal para expresión    │
│ Jueves     Más actividad mental en A        │
├─────────────────────────────────────────────┤
│ Capas rápidas                               │
│ En Brian       Respuesta corporal           │
│ En AUREA       Voz / posicionamiento        │
│ En el cruce    Decisión comunicable         │
├─────────────────────────────────────────────┤
│ Centros relevantes                          │
│ [Sacral] [Garganta] [Ajna]                  │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente por esta semana ]   │
└─────────────────────────────────────────────┘
```

Mientras el sistema no tenga una ephemeris real de siete días, la UI debe mantener la advertencia conceptual del ADR: venderlo como panorama semanal, no como cálculo fino día por día.

## Selector De Contexto

El selector de contexto es el cambio más importante de UX.

```text
┌ Cambiar contexto ───────────────────────────┐
│ Buscar carta, persona o cruce               │
│ [_______________________________________]   │
├─────────────────────────────────────────────┤
│ Cartas                                      │
│ ✓ Mi carta - Brian                          │
│   Cliente X                                 │
│   Negocio AUREA                             │
│   Carta temporal: Lanzamiento Mayo          │
├─────────────────────────────────────────────┤
│ Cruces                                      │
│   Brian + AUREA                             │
│   Cliente X + Pareja                        │
│   Cliente X + Negocio                       │
├─────────────────────────────────────────────┤
│ + Crear cruce                               │
│ + Cargar nueva carta                        │
└─────────────────────────────────────────────┘
```

Reglas de producto:

- mostrar si el item es carta individual o cruce;
- mostrar nombres legibles, no IDs;
- permitir alias;
- no exponer datos de nacimiento en el selector principal;
- recordar último contexto usado, pero entrar por defecto a `Mi carta` si no hay historial claro.

## Crear Cruce Desde Tránsitos

V1 puede permitir crear un cruce sin salir de Tránsitos, pero debe ser un flujo liviano.

```text
┌ Crear cruce ────────────────────────────────┐
│ Carta A                                     │
│ [ Brian                                ▼ ]  │
│ Carta B                                     │
│ [ Seleccionar o cargar carta           ▼ ]  │
│ Contexto del cruce                          │
│ [ Negocio / Cliente / Pareja / Familia ▼ ]  │
│ Nombre                                      │
│ [ Brian + AUREA                         ]   │
│                                             │
│ [ Cancelar ]          [ Crear y ver ]       │
└─────────────────────────────────────────────┘
```

La creación no debería pedir una definición perfecta. La usuaria puede nombrar y corregir después. Si hay carga de terceros, la UI puede incluir copy liviana de responsabilidad, pero no convertir el flujo en un formulario legal pesado.

## Chat Contextual

El CTA al agente debe cambiar según contexto, hora y capa.

| Estado de pantalla | CTA sugerido |
|---|---|
| Carta individual, ahora | `Preguntarle al agente sobre ahora` |
| Carta individual, hora seleccionada | `Preguntarle al agente sobre las 14:00` |
| Cruce, resumen, ahora | `Preguntarle al agente sobre este cruce` |
| Cruce, capa A | `Preguntarle al agente sobre Brian en este tránsito` |
| Cruce, capa B | `Preguntarle al agente sobre Cliente X en este tránsito` |
| Cruce, hora seleccionada | `Preguntarle al agente sobre este cruce a las 14:00` |
| Cruce, próximos 7 días | `Preguntarle al agente por esta semana` |

La respuesta del agente debería nacer dentro del thread del contexto seleccionado. Si el contexto es `Cliente X + Pareja`, no debería caer en el monothread general del usuario.

## Empty States

### Sin Cartas Guardadas

```text
Tránsitos
Para leer tránsitos necesitamos una carta.

[ Cargar mi carta ]
```

### Carta Individual Pero Sin Cruces

```text
Contexto: Mi carta - Brian

Podés leer tránsitos sobre esta carta o crear un cruce
para ver cómo el tránsito impacta entre dos bodygraphs.

[ Crear cruce ]
```

### Cruce Incompleto

```text
Este cruce necesita dos cartas válidas.

Brian está listo.
Falta cargar o seleccionar la segunda carta.

[ Seleccionar carta B ]
```

### Datos De Terceros

```text
Si cargás una carta de otra persona, usá un alias cuando tenga sentido
y asegurate de tener permiso para usar esos datos en tu contexto.
```

Este texto debería ser breve y contextual. El objetivo es conducta prudente, no fricción legal innecesaria.

## Mobile

En mobile, la prioridad es no convertir la pantalla en un panel de controles.

Orden recomendado:

1. Header `Tránsitos`.
2. Selector de contexto como botón full-width.
3. `Hoy / Próximos 7 días`.
4. Hora activa.
5. Insight principal.
6. Tabs compactos de capa, solo si es cruce.
7. Cards de lectura.
8. Slider.
9. Centros.
10. Detalle planetario colapsado.
11. CTA de chat sticky o al final.

Wireframe mobile:

```text
┌───────────────────────┐
│ Tránsitos             │
│ [Brian + AUREA     ▼] │
│ [Hoy] [7 días]        │
│ Ahora · 11:42    ↻    │
├───────────────────────┤
│ LO PRINCIPAL          │
│ El cruce activa...    │
├───────────────────────┤
│ Resumen | Brian | ... │
├───────────────────────┤
│ [Card de lectura]     │
│ [Card de lectura]     │
├───────────────────────┤
│ Explorar el día       │
│ 00 06 12 18 21        │
│        ●              │
├───────────────────────┤
│ Centros               │
├───────────────────────┤
│ [Preguntar al agente] │
└───────────────────────┘
```

## Alcance UX V1

Incluido:

- selector de contexto en Tránsitos;
- carta individual como modo compatible con el ADR actual;
- cruce de dos bodygraphs como modo relacional;
- `Hoy` default con `Ahora`;
- slider diario heredado del ADR;
- `Próximos 7 días` como vista secundaria;
- capas `Resumen`, `En A`, `En B`, `En el cruce`;
- centros visibles en carta individual y cruce;
- CTA de chat contextual;
- creación liviana de cruce desde selector o CTA.

Fuera de alcance:

- penta, equipos o grupos de más de dos bodygraphs;
- ranking de compatibilidad;
- scoring amoroso;
- timeline colaborativo;
- compartir cruces con terceros;
- consentimiento verificable o workflows legales avanzados;
- reportes exportables;
- modo coach completo;
- bodygraph visual coloreado en vivo;
- comparación de múltiples horas en simultáneo.

## Decisiones Recomendadas Para V1

| Decisión | Recomendación |
|---|---|
| Entrada default | `Mi carta` + `Hoy` + `Ahora` |
| Ubicación del contexto | Encima del selector temporal |
| Nombre del objeto relacional | Usar `Cruce` internamente en discovery; testear copy `Conexión` o `Comparación` con usuarias |
| Cruces soportados | Solo dos bodygraphs |
| Capa inicial en cruce | `Resumen` |
| Chat | Thread por contexto, no monothread |
| Legal UX | Copy liviana al cargar terceros, privacidad por defecto y alias visibles |
| Pricing | No decidir desde esta pantalla; el valor está en profundidad/chat/informes, no solo en guardar otra carta |

## Riesgos UX

| Riesgo | Señal | Mitigación |
|---|---|---|
| La pantalla se vuelve demasiado densa | El usuario no sabe si cambiar carta, hora o capa | Separar visualmente contexto, tiempo y lectura |
| El cruce parece compatibilidad amorosa | Usuarios esperan score o veredicto | Usar lenguaje de dinámica, activación y observación |
| Se mezclan personas en chat | El agente responde como si Cliente X fuera el usuario | Thread y CTA siempre scopiados al contexto |
| El selector de contexto se vuelve biblioteca completa | Demasiadas cartas/cruces en un dropdown | Buscar, agrupar y mostrar recientes |
| La vista semanal promete precisión falsa | El usuario cree que cada día fue calculado fino | Mantener copy de panorama hasta tener ephemeris real |
| El flujo de terceros genera fricción | Crear cruce se siente legalista | Alias + responsabilidad breve + delete fácil |

## Preguntas Abiertas

1. ¿La usuaria entiende mejor `Cruce`, `Conexión`, `Comparación` o `Dinámica`?
2. ¿El selector de contexto debería vivir solo en Tránsitos o convertirse en patrón global de Astral?
3. ¿Crear cruce desde Tránsitos es suficiente para V1, o hace falta una biblioteca dedicada primero?
4. ¿El primer cruce que debemos optimizar es persona+persona, persona+negocio o coach+cliente?
5. ¿La capa `En el cruce` debe aparecer como tab o como sección fija debajo de A/B?
6. ¿El chat debe abrir una conversación nueva automáticamente al crear un cruce?
7. ¿Las cartas temporales se guardan por defecto o se descartan salvo que el usuario elija guardar?
8. ¿Qué copy mínima baja el riesgo legal sin bloquear el caso natural de coaches?

## Próximo Paso

Validar este wireframe contra el ADR actual y contra 3-5 escenarios reales:

- usuaria mira su carta hoy;
- usuaria mira ella + negocio hoy;
- coach mira cliente + pareja a una hora seleccionada;
- usuaria explora próximos 7 días de un cruce;
- usuaria pregunta al agente desde una capa específica.

Si estas pantallas cierran, el siguiente documento debería bajar alcance funcional V1: flujos, nombres definitivos, estados, eventos de chat y criterios de aceptación de producto.
