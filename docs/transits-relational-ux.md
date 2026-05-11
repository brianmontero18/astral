# Tránsitos Relacionales UX

- **Fecha:** 2026-05-10
- **Estado:** propuesta UX de superficie, subordinada a Context Workspace
- **Documentos base:** [transits-time-selector-adr.md](./transits-time-selector-adr.md), [bodygraph-relacional.md](./bodygraph-relacional.md), [context-workspace-ux.md](./context-workspace-ux.md), [context-workspace-architecture.md](./context-workspace-architecture.md), [competencia.md](./competencia.md)

Este documento propone cómo extender la experiencia de Tránsitos para soportar una lectura relacional entre dos bodygraphs, sin reemplazar el ADR actual. El ADR resuelve la pregunta "qué tránsito me afecta ahora" para una carta individual. Esta propuesta agrega una capa previa: "sobre qué carta o conexión estoy mirando ese tránsito".

No define arquitectura técnica, base de datos, endpoints ni contratos finales. Es un wireframe de producto para validar alcance V1.

Nota importante: esta pantalla no debe ser la dueña del selector de contexto global. Después del sparring, la decisión recomendada es que Tránsitos sea una **superficie dentro de un workspace contextual**. El usuario entra a un sujeto o conexión, y luego abre Tránsitos dentro de ese contexto. Este documento queda como especificación UX de la superficie Tránsitos, no como modelo de navegación global.

## Tesis UX

La pantalla de Tránsitos tiene que manejar dos ejes:

| Eje | Pregunta | Control principal |
|---|---|---|
| Contexto | ¿Sobre qué carta o conexión estoy leyendo? | Contexto activo del workspace |
| Tiempo | ¿En qué momento estoy leyendo el tránsito? | `Hoy`, slider diario, `Próximos 7 días` |

La extensión relacional no debería crear una sección separada ni duplicar la lógica mental. Debería usar la misma pantalla y cambiar la interpretación según el contexto seleccionado:

- si el contexto es una carta individual, se mantiene la experiencia del ADR;
- si el contexto es una conexión A+B, el mismo tránsito se lee en tres capas: impacto en A, impacto en B e impacto en la dinámica A+B.

## Principios

1. **Contexto primero, tiempo después.** Antes de hablar de "ahora", la UI debe dejar claro "ahora para qué sujeto o conexión".
2. **No vender compatibilidad.** El lenguaje debe ser activación, condicionamiento, completitud, amplificación, fricción y observación. No ranking, score ni predicción vincular.
3. **Una pantalla, dos modos.** Carta individual y conexión viven en la misma sección, pero con jerarquía editorial distinta.
4. **El tránsito es uno; las lecturas son varias.** El snapshot colectivo del cielo es el mismo, pero cambia la lectura según carta A, carta B y el campo relacional.
5. **V1 de dos bodygraphs.** Penta, equipos, grupos y conexiones de más de dos quedan fuera de esta propuesta.
6. **El chat hereda contexto explícito.** Preguntar al agente desde esta pantalla debe llevar contexto + hora + capa seleccionada.

## Modelo Mental De Pantalla

```text
Tránsitos
  ├─ Selector de contexto
  │    ├─ Carta individual
  │    └─ Conexión A+B
  ├─ Selector temporal
  │    ├─ Hoy / Ahora
  │    ├─ Slider diario
  │    └─ Próximos 7 días
  ├─ Lectura principal
  │    ├─ Carta individual: qué se activa en esa carta
  │    └─ Conexión: qué se activa en la dinámica A+B
  ├─ Capas de detalle
  │    ├─ En A
  │    ├─ En B
  │    └─ Dinámica
  └─ Chat contextual
```

## Navegación Propuesta

En el modelo global, el usuario no debería descubrir el contexto recién en Tránsitos. Primero abre un workspace de sujeto/conexión y después entra a la superficie `Tránsitos`.

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
- conexiones guardadas;
- acción `Crear conexión`;
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

## Wireframe 2: Conexión A+B Hoy

Cuando el contexto es una conexión, el hero no debería decir "cómo te toca" en singular. Tiene que explicar qué está pasando en el campo relacional.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Brian + Negocio AUREA      ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ Ahora · 11:42                      ↻        │
│ Sábado 9 mayo                               │
├─────────────────────────────────────────────┤
│ LO PRINCIPAL DE LA CONEXIÓN                 │
│ El tránsito completa una conexión entre     │
│ la dirección del negocio y tu capacidad     │
│ de respuesta.                               │
│ Hechos: 20-34 · Sacral · Garganta           │
├─────────────────────────────────────────────┤
│ [ Resumen ] [ En Brian ] [ En AUREA ]       │
│ [ Dinámica ]                                │
├─────────────────────────────────────────────┤
│ Resumen                                     │
│ ┌ Activación compartida ─────────────────┐  │
│ │ Sacral y Garganta toman protagonismo   │  │
│ │ para esta conexión durante este momento│  │
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
│ Centros de la conexión                      │
│ Amplificados      [Sacral]                  │
│ Condicionados     [Garganta]                │
│ Definidos temp.   [Raíz]                    │
├─────────────────────────────────────────────┤
│ Detalle planetario                      ▼   │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente sobre la conexión ] │
└─────────────────────────────────────────────┘
```

La pestaña `Resumen` debería ser editorial. No tiene que mostrar todas las tarjetas de A y B. Su trabajo es responder rápido: "qué cambia en esta dinámica bajo este tránsito".

## Wireframe 3: Capas De La Conexión

Las capas evitan mezclar lecturas. La usuaria puede pasar de la síntesis a una lectura orientada por sujeto.

```text
┌─────────────────────────────────────────────┐
│ Contexto: Brian + Cliente X            ▼    │
│ Ahora · 11:42                               │
│ [ Resumen ] [ En Brian ] [ En Cliente X ]   │
│ [ Dinámica ]                                │
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
│ Dinámica                                    │
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

## Wireframe 4: Hora Seleccionada En Una Conexión

El slider del ADR se conserva. La diferencia es que la etiqueta debe dejar claro que estamos mirando una hora seleccionada para una conexión.

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
│ y completa expresión en B. En la conexión,  │
│ el tema es hablar sin resolver de más.      │
├─────────────────────────────────────────────┤
│ [ Resumen ] [ En Cliente X ] [ En Pareja ]  │
│ [ Dinámica ]                                │
├─────────────────────────────────────────────┤
│ Explorar el día                             │
│ 00  03  06  09  12  15  18  21             │
│                 ● 14:00                     │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente sobre esta hora ]   │
└─────────────────────────────────────────────┘
```

La acción `Ahora` no vuelve a la muestra horaria más cercana. Vuelve a tomar una foto actual, como define el ADR.

## Wireframe 5: Próximos 7 Días En Una Conexión

La vista semanal en conexión debería ser un panorama de ventanas relacionales, no un calendario astrológico denso.

```text
┌─────────────────────────────────────────────┐
│ Tránsitos                                   │
│ Contexto: [ Brian + Negocio AUREA      ▼ ]  │
│ [ Hoy ] [ Próximos 7 días ]                 │
├─────────────────────────────────────────────┤
│ 9 mayo - 15 mayo                            │
├─────────────────────────────────────────────┤
│ TEMA DE LA CONEXIÓN ESTA SEMANA             │
│ Más presión para convertir respuesta        │
│ interna en mensaje visible del negocio.     │
├─────────────────────────────────────────────┤
│ Ventanas relevantes                         │
│ Hoy        Sacral amplificado en la dinámica│
│ Lunes      Canal temporal para expresión    │
│ Jueves     Más actividad mental en A        │
├─────────────────────────────────────────────┤
│ Capas rápidas                               │
│ En Brian       Respuesta corporal           │
│ En AUREA       Voz / posicionamiento        │
│ Dinámica      Decisión comunicable          │
├─────────────────────────────────────────────┤
│ Centros relevantes                          │
│ [Sacral] [Garganta] [Ajna]                  │
├─────────────────────────────────────────────┤
│ [ Preguntarle al agente por esta semana ]   │
└─────────────────────────────────────────────┘
```

Mientras el sistema no tenga una ephemeris real de siete días, la UI debe mantener la advertencia conceptual del ADR: venderlo como panorama semanal, no como cálculo fino día por día.

## Selector De Contexto

El selector de contexto ya no debería ser un invento local de Tránsitos. Debe ser el mismo patrón del workspace contextual. En Tránsitos puede mostrarse en el header para claridad y cambio rápido, pero la fuente de verdad de navegación es el workspace.

```text
┌ Cambiar contexto ───────────────────────────┐
│ Buscar carta, persona o conexión            │
│ [_______________________________________]   │
├─────────────────────────────────────────────┤
│ Cartas                                      │
│ ✓ Mi carta - Brian                          │
│   Cliente X                                 │
│   Negocio AUREA                             │
│   Carta temporal: Lanzamiento Mayo          │
├─────────────────────────────────────────────┤
│ Conexiones                                  │
│   Brian + AUREA                             │
│   Cliente X + Pareja                        │
│   Cliente X + Negocio                       │
├─────────────────────────────────────────────┤
│ + Crear conexión                            │
│ + Cargar nueva carta                        │
└─────────────────────────────────────────────┘
```

Reglas de producto:

- mostrar si el item es carta individual o conexión;
- mostrar nombres legibles, no IDs;
- permitir alias;
- no exponer datos de nacimiento en el selector principal;
- recordar último contexto usado, pero entrar por defecto a `Mi carta` si no hay historial claro.

## Crear Conexión Desde Tránsitos

V1 puede permitir crear una conexión sin salir de Tránsitos, pero debe ser un atajo hacia el flujo global de biblioteca. No debería ser el único lugar donde se crean conexiones.

```text
┌ Crear conexión ─────────────────────────────┐
│ Carta A                                     │
│ [ Brian                                ▼ ]  │
│ Carta B                                     │
│ [ Seleccionar o cargar carta           ▼ ]  │
│ Tipo de vínculo                             │
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
| Conexión, resumen, ahora | `Preguntarle al agente sobre esta conexión` |
| Conexión, capa A | `Preguntarle al agente sobre Brian en este tránsito` |
| Conexión, capa B | `Preguntarle al agente sobre Cliente X en este tránsito` |
| Conexión, hora seleccionada | `Preguntarle al agente sobre esta conexión a las 14:00` |
| Conexión, próximos 7 días | `Preguntarle al agente por esta semana` |

La respuesta del agente debería nacer dentro del thread del contexto seleccionado. Si el contexto es `Cliente X + Pareja`, no debería caer en el monothread general del usuario.

## Empty States

### Sin Cartas Guardadas

```text
Tránsitos
Para leer tránsitos necesitamos una carta.

[ Cargar mi carta ]
```

### Carta Individual Pero Sin Conexiones

```text
Contexto: Mi carta - Brian

Podés leer tránsitos sobre esta carta o crear una conexión
para ver cómo el tránsito impacta entre dos bodygraphs.

[ Crear conexión ]
```

### Conexión Incompleta

```text
Esta conexión necesita dos cartas válidas.

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
6. Tabs compactos de capa, solo si es conexión.
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
│ La conexión activa... │
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

- header de contexto activo heredado del workspace;
- carta individual como modo compatible con el ADR actual;
- conexión de dos bodygraphs como modo relacional;
- `Hoy` por defecto con `Ahora`;
- slider diario heredado del ADR;
- `Próximos 7 días` como vista secundaria;
- capas `Resumen`, `En A`, `En B`, `Dinámica`;
- centros visibles en carta individual y conexión;
- CTA de chat contextual;
- creación liviana de conexión desde selector o CTA.

Fuera de alcance:

- penta, equipos o grupos de más de dos bodygraphs;
- ranking de compatibilidad;
- scoring amoroso;
- timeline colaborativo;
- compartir conexiones con terceros;
- consentimiento verificable o workflows legales avanzados;
- reportes exportables;
- modo coach completo;
- bodygraph visual coloreado en vivo;
- comparación de múltiples horas en simultáneo.

## Decisiones Recomendadas Para V1

| Decisión | Recomendación |
|---|---|
| Entrada por defecto | `Mi carta` + `Hoy` + `Ahora` |
| Ubicación del contexto | Encima del selector temporal |
| Nombre del objeto relacional | Usar `Conexión` de cara al usuario y `Cruce` internamente si hace falta en discovery |
| Conexiones soportadas | Solo dos bodygraphs |
| Capa inicial en conexión | `Resumen` |
| Chat | Thread por contexto, no monothread |
| Legal UX | Copy liviana al cargar terceros, privacidad por defecto y alias visibles |
| Pricing | No decidir desde esta pantalla; el valor está en profundidad/chat/informes, no solo en guardar otra carta |

## Riesgos UX

| Riesgo | Señal | Mitigación |
|---|---|---|
| La pantalla se vuelve demasiado densa | El usuario no sabe si cambiar carta, hora o capa | Separar visualmente contexto, tiempo y lectura |
| La conexión parece compatibilidad amorosa | Usuarios esperan score o veredicto | Usar lenguaje de dinámica, activación y observación |
| Se mezclan personas en chat | El agente responde como si Cliente X fuera el usuario | Thread y CTA siempre scopiados al contexto |
| El selector de contexto se vuelve biblioteca completa | Demasiadas cartas/conexiones en un dropdown | Buscar, agrupar y mostrar recientes |
| La vista semanal promete precisión falsa | El usuario cree que cada día fue calculado fino | Mantener copy de panorama hasta tener ephemeris real |
| El flujo de terceros genera fricción | Crear conexión se siente legalista | Alias + responsabilidad breve + delete fácil |

## Preguntas Resueltas Para V1

1. La usuaria debería ver `Conexión` como objeto. `Comparar` puede ser verbo. `Dinámica` funciona como capa de lectura.
2. El selector de contexto no debe vivir solo en Tránsitos; pertenece al workspace contextual.
3. Crear conexión desde Tránsitos no alcanza; V1 necesita biblioteca mínima y Tránsitos solo puede ofrecer un atajo.
4. El primer caso de uso optimizado debe ser `mi carta + otra entidad`. Tercero + tercero se permite, pero no guía la UX inicial.
5. `Dinámica` debe ser una capa explícita. El `Resumen` inicial ya debe ser relacional y no una suma de A+B.
6. El chat no se abre automáticamente al crear una conexión. La conexión abre un workspace; el thread se crea al entrar a Chat o enviar primer mensaje.
7. Si existen cartas temporales, se descartan por defecto. Para chat, informe o reabrir luego, pedir guardar/nombrar.
8. Copy mínima: "Usá alias si corresponde. Cargá datos que tengas permiso de usar. Todo queda privado y podés borrarlo cuando quieras."

## Preguntas Abiertas

1. En `Próximos 7 días`, ¿cuánto cálculo real entra en V1 y cuánto queda como panorama editorial basado en muestras disponibles?
2. ¿La capa `Dinámica` necesita bodygraph visual compuesto en V1 o alcanza con tarjetas semánticas?
3. ¿Qué datos de conexión se incluyen en el prompt del agente sin volverlo demasiado largo?
4. ¿Qué límites de plan aplican a tránsitos de conexiones si el cálculo es más caro?

## Próximo Paso

Validar este wireframe contra el ADR actual y contra 3-5 escenarios reales:

- usuaria mira su carta hoy;
- usuaria mira ella + negocio hoy;
- coach mira cliente + pareja a una hora seleccionada;
- usuaria explora próximos 7 días de una conexión;
- usuaria pregunta al agente desde una capa específica.

Si estas pantallas cierran, continuar con [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md) y [context-workspace-migration-plan.md](./context-workspace-migration-plan.md). No implementar Tránsitos relacionales antes de tener Biblioteca y Context Shell.
