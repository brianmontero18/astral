# ADR: Tránsitos en tiempo actual y selector diario/semanal

Estado: Propuesto
Fecha: 2026-05-09
Área: Tránsitos, chat, lectura de impacto HD

## Documentos relacionados

- Plan técnico: `docs/transits-time-selector-technical-plan.md`
- Plan de tests: `docs/transits-time-selector-test-plan.md`

## Intención

Astral necesita que la experiencia principal de tránsitos responda a la pregunta
del usuario: "¿qué me está pasando ahora?". La vista semanal sigue siendo útil
como contexto, pero no debe ser la vista primaria.

La experiencia objetivo es:

- Al entrar en Tránsitos, mostrar el impacto del tránsito para el momento actual
  del usuario, usando su zona horaria y la hora exacta de apertura.
- Permitir explorar el día actual hora por hora con un slider temporal.
- Permitir cambiar a una vista secundaria de "próximos 7 días" para conservar el
  valor del panorama semanal.
- Asegurar que cualquier pregunta al chat que use tránsitos tome una foto actual
  del tránsito en ese request, no una foto semanal stale.
- Mostrar centros como dato de primera clase, no solo puertas y canales.

## Problema

Hoy la app presenta tránsitos como semanales. Técnicamente, el sistema actual no
calcula una ephemeris de siete días: calcula una foto de un momento y la cachea
por semana/zona horaria. Eso vuelve ambigua la experiencia: el usuario espera un
estado temporal útil para hoy, pero recibe una lectura con lenguaje semanal.

Además, la UI muestra puertas, canales y algunos centros condicionados, pero no
expone claramente qué centros están siendo activados o definidos temporalmente
por el tránsito. Para Diseño Humano esto es un gap de producto: los centros son
parte central de la interpretación.

## Decisión propuesta

La vista principal de Tránsitos pasa a tener un selector de rango con dos modos:

1. **Hoy**
   - Es el modo default.
   - Al cargar, selecciona "Ahora".
   - "Ahora" significa la fecha, hora y minuto reales del usuario al momento de
     abrir/refrescar la sección.
   - La vista incluye un slider de 00:00 a 23:00 para explorar el día por hora.
   - Mover el slider no dispara un cálculo remoto por cada movimiento; usa las
     muestras del día ya cargadas.
   - Volver a "Ahora" o refrescar la vista sí toma una nueva foto actual.

2. **Próximos 7 días**
   - Es secundario.
   - Conserva la experiencia actual como panorama semanal mientras se define una
     ephemeris real de siete días.
   - La copia de UI debe ser honesta: si se sigue usando una sola foto cacheada,
     no debe prometer que cada día de los próximos siete fue calculado.

## Definición de "tiempo real"

Para este producto, "tiempo real" no significa recalcular cada segundo ni cada
microsegundo. Significa:

- Cada entrada a la sección de Tránsitos calcula contra el momento actual.
- Cada refresh manual calcula contra el momento actual.
- Cada request de chat que necesite tránsitos calcula contra el momento actual.
- La exploración del slider usa muestras precomputadas del día para dar feedback
  inmediato sin latencia por arrastre.

Contrato de frescura:

- "Ahora" debe usar el timestamp exacto del request del cliente.
- Las horas del slider pueden ser muestras discretas por hora.
- La app debe mostrar cuándo fue calculada la foto activa.
- Si el usuario deja la sección abierta, no se actualiza sola en silencio; el
  usuario puede volver a "Ahora" o refrescar.

## Contrato de datos UI

### Deliberación Architect / Sparring

**Tensión principal:** si el backend devuelve directamente la pantalla lista para
renderizar, el frontend queda rápido de construir pero la UI futura queda
acoplada a copy, orden y composición actual. Si la UI consume el shape técnico
actual (`planets`, `activatedChannels`, `impact`), cada rediseño debe volver a
entender reglas HD y se repite el riesgo de mezclar "activado", "condicionado" y
"definido".

**Veredicto:** separar dos contratos:

1. **Contrato domain/API**: hechos semánticos de tránsito e impacto HD. No conoce
   layout ni componentes.
2. **Contrato ViewModel/UI**: modelo estable para renderizar la pantalla. Lo arma
   una capa adapter del frontend a partir del contrato domain/API.

La UI no debe consumir `TransitsResponse` crudo ni calcular reglas HD desde
planetas. Los componentes de pantalla consumen solamente un `TransitScreenModel`
o equivalente.

### Principios del contrato

- Backend owns HD semantics: puertas, canales, centros activados, centros
  condicionados y centros temporalmente definidos.
- Frontend owns presentation: orden visual, labels, secciones colapsables,
  density mobile/desktop y microcopy.
- UI components no hacen fetch directo. Reciben `model` + callbacks.
- Data adapters pueden cambiar endpoints, cache o sampling sin cambiar
  componentes.
- El contrato debe estar versionado para permitir evolución sin migraciones
  dolorosas.
- El contrato no debe incluir copy largo generado por LLM en MVP. Puede incluir
  facts, labels y metadata; la narrativa visible se deriva en el adapter.

### Capas propuestas

```text
Swiss Ephemeris / HD rules
        ↓
Backend domain contract
        ↓
frontend/src/api.ts o transits repository
        ↓
TransitExperienceAdapter
        ↓
TransitScreenModel
        ↓
TransitViewer / presentational components
```

El límite importante es entre `TransitExperienceAdapter` y los componentes. Si
mañana cambia la UI, se reemplaza el armado del `TransitScreenModel` o sus
componentes, no el contrato semántico ni la lógica HD.

### Domain/API contract recomendado

Nombre conceptual: `TransitExperienceResponse`.

```ts
type TransitMode = "today" | "next7Days";

interface TransitExperienceResponse {
  version: "transits.v2";
  mode: TransitMode;
  timeZone: string;
  generatedAt: string;      // cuándo respondió el backend
  selectedAt: string;       // momento interpretado por la foto activa
  range: TransitRange;
  selectedSnapshotId: string;
  snapshots: TransitSnapshot[];
}

interface TransitRange {
  kind: "today" | "next7Days";
  label: string;            // "Hoy" / "9 mayo - 15 mayo"
  startsAt: string;
  endsAt: string;
  step: "now" | "hour" | "day" | "panorama";
}

interface TransitSnapshot {
  id: string;
  targetAt: string;         // hora/día que representa esta muestra
  calculatedAt: string;     // cuándo se calculó
  label: string;            // "Ahora", "14:00", "Lunes"
  collective: CollectiveTransitFacts;
  personal?: PersonalTransitFacts;
}

interface CollectiveTransitFacts {
  planets: PlanetTransitFact[];
  activatedGates: TransitGateFact[];
  activatedChannels: TransitChannelFact[];
  activatedCenters: TransitCenterFact[];
  temporarilyDefinedCenters: TransitCenterDefinitionFact[];
}

interface PersonalTransitFacts {
  reinforcedGates: ReinforcedGateFact[];
  personalChannels: PersonalChannelFact[];
  educationalChannels: TransitChannelFact[];
  conditionedCenters: TransitCenterFact[];
  activatedCenters: TransitCenterFact[];
  temporarilyDefinedCenters: TransitCenterDefinitionFact[];
}
```

Notas:

- `activatedCenters` y `temporarilyDefinedCenters` son campos distintos.
- `temporarilyDefinedCenters` se deriva de canales completos, no de puertas
  aisladas.
- `personal` puede faltar para usuarias pending/no autenticadas; la UI debe
  degradar a lectura colectiva.
- `PlanetTransitFact` puede conservar longitud/signo/retrogradación para detalle
  técnico, pero los componentes no dependen de eso para decidir la narrativa.

### ViewModel/UI contract recomendado

Nombre conceptual: `TransitScreenModel`.

```ts
interface TransitScreenModel {
  mode: "today" | "next7Days";
  header: TransitHeaderModel;
  selector: TransitModeSelectorModel;
  timeline?: TransitTimelineModel;
  primaryInsight: TransitPrimaryInsightModel;
  personalSections: TransitImpactSectionModel[];
  centerGroups: TransitCenterGroupModel[];
  planetDetails: TransitPlanetDetailModel[];
  actions: TransitScreenActionsModel;
  loadingState: "ready" | "refreshing" | "timelineLoading" | "error";
}

interface TransitPrimaryInsightModel {
  eyebrow: string;           // "LO PRINCIPAL AHORA"
  title: string;             // "Sacral + Garganta activos"
  body: string;              // copy corto derivado de facts
  supportingFacts: string[]; // trazabilidad: puertas/canales/centros
}

interface TransitImpactSectionModel {
  id: string;
  kind:
    | "temporaryChannel"
    | "conditionedCenter"
    | "reinforcedGate"
    | "educationalChannel";
  title: string;
  subtitle?: string;
  items: TransitImpactCardModel[];
}

interface TransitCenterGroupModel {
  kind: "temporarilyDefined" | "conditioned" | "activated";
  label: string;
  centers: Array<{
    id: string;              // canonical: Sacral, Throat, Root, etc.
    displayName: string;
    sourceIds: string[];     // gate/channel ids que justifican el centro
  }>;
}
```

Los componentes presentacionales no deben conocer `TransitExperienceResponse`.
Renderizan `TransitScreenModel` y emiten callbacks.

### Eventos que la UI emite

```ts
type TransitScreenEvent =
  | { type: "mode.change"; mode: "today" | "next7Days" }
  | { type: "time.select"; snapshotId: string }
  | { type: "time.now" }
  | { type: "refresh" }
  | { type: "askAgent"; payload: TransitAskAgentPayload };

interface TransitAskAgentPayload {
  source: "now" | "selectedTime" | "weekly";
  snapshotId: string;
  targetAt: string;
  timeZone: string;
  prefill: string;
}
```

Esto evita que `TransitViewer` sepa cómo navegar al chat o cómo serializar el
contexto. La pantalla solo declara intención.

### Chat context contract

Cuando el usuario pregunta desde Tránsitos, el chat no debe reconstruir contexto
desde texto libre. Debe recibir metadata estructurada:

```ts
interface TransitChatContext {
  source: "transitScreen";
  mode: "today" | "next7Days";
  snapshotId: string;
  targetAt: string;
  timeZone: string;
}
```

El backend puede usar esa metadata para recalcular la foto correspondiente o
validar que la foto usada siga siendo consistente. Si no llega
`TransitChatContext`, chat usa "Ahora".

### Estrategia de carga

El contrato debe permitir carga en dos fases:

1. Foto `Ahora` primero, para que la pantalla no espere las 24 muestras.
2. Timeline horario después, para que el slider tenga datos locales.

El `TransitScreenModel.loadingState` debe poder representar `timelineLoading`
sin bloquear la lectura principal. Si el timeline falla, la pantalla conserva la
lectura de "Ahora" y muestra el slider como no disponible/reintentar.

### Guardrails para next agents

- No hacer que `TransitViewer` importe `fetchTransits()` directamente.
- No pasar `UserProfile` a componentes visuales para recalcular impacto.
- No inferir centros en la UI desde `planets`. La UI puede agrupar, pero no
  decidir semántica HD.
- No meter strings largos de UI en backend salvo labels/facts mínimos.
- No usar `activatedChannels: string[]` como único contrato de canales; cada canal
  necesita `id`, `name`, gates, source y centros involucrados.
- Mantener compatibilidad temporal con `/api/transits`, pero el contrato nuevo no
  debe quedar limitado por el shape semanal actual.

## Experiencia de usuario

La pantalla debe seguir una jerarquía editorial, no una jerarquía técnica.
El usuario no entra a Tránsitos para ver primero planetas; entra para entender
qué energía está activa, cómo le toca y qué mirar hoy. Los datos planetarios son
una capa de confianza y detalle para quien quiera abrirla.

Orden recomendado:

1. Qué está activo ahora.
2. Cómo te toca personalmente.
3. Exploración temporal del día.
4. Centros.
5. Detalle planetario expandible.

### Entrada a Tránsitos

La primera pantalla muestra:

- Selector de rango: `Hoy` seleccionado por defecto.
- Indicador de hora activa: por ejemplo `Ahora · 08:15`.
- Slider del día.
- Resumen del impacto actual.
- Puertas, canales y centros activos/condicionados/definidos según corresponda.
- Última actualización visible.

Wireframe conceptual:

```text
┌─────────────────────────────────────┐
│ Tránsitos                           │
│ [ Hoy ] [ Próximos 7 días ]         │
├─────────────────────────────────────┤
│ Ahora · 08:15              ↻        │
│ Sábado 9 mayo                       │
├─────────────────────────────────────┤
│ LO PRINCIPAL AHORA                  │
│ Sacral + Garganta están activados   │
│ por tránsito. Hay impulso para      │
│ responder y poner voz a algo.       │
├─────────────────────────────────────┤
│ Cómo te toca                        │
│ ┌ Canal temporal ────────────────┐  │
│ │ Tu Puerta 20 + tránsito en 34  │  │
│ │ Energía disponible: acción     │  │
│ └────────────────────────────────┘  │
│ ┌ Centro condicionado ───────────┐  │
│ │ Sacral                         │  │
│ │ Más presión para hacer/decidir │  │
│ └────────────────────────────────┘  │
├─────────────────────────────────────┤
│ Explorar el día                     │
│ 00  03  06  09  12  15  18  21     │
│          ● Ahora                    │
├─────────────────────────────────────┤
│ Centros                             │
│ Definidos temp.   [Garganta]        │
│ Condicionados     [Sacral] [Raíz]   │
│ Activados         [Ajna]            │
├─────────────────────────────────────┤
│ Detalle planetario                  │
│ Sol      Puerta 34 · Línea 2    ▼   │
│ Luna     Puerta 41 · Línea 5    ▼   │
│ Venus    Puerta 22 · Línea 1    ▼   │
└─────────────────────────────────────┘
```

### Slider diario

El slider representa el día local del usuario, de 00:00 a 23:00.

- Cuando el usuario arrastra a una hora, la UI cambia la foto activa.
- La respuesta debe sentirse inmediata.
- La etiqueta cambia a la hora seleccionada, por ejemplo `14:00`.
- Si vuelve a "Ahora", se usa una foto actual, no necesariamente la muestra de
  la hora redonda.
- Cuando hay una hora seleccionada, la pantalla debe decir explícitamente
  `A las 14:00` y ofrecer un control claro para volver a `Ahora`.
- El CTA hacia chat desde una tarjeta del slider debe preservar esa hora:
  `Preguntale al agente sobre las 14:00`.

### Vista próximos 7 días

La opción de siete días preserva una lectura de contexto semanal. No debe
competir con "Hoy" como pantalla principal.

En MVP puede reutilizar el contenido actual, siempre que la UI no prometa una
granularidad que todavía no existe. Una versión posterior puede convertir este
modo en una línea de siete días con muestras diarias reales.

Wireframe conceptual:

```text
┌─────────────────────────────────────┐
│ Tránsitos                           │
│ [ Hoy ] [ Próximos 7 días ]         │
├─────────────────────────────────────┤
│ 9 mayo - 15 mayo                    │
├─────────────────────────────────────┤
│ Tema de la semana                   │
│ Garganta y Raíz toman protagonismo  │
├─────────────────────────────────────┤
│ Centros relevantes                  │
├─────────────────────────────────────┤
│ Detalle planetario                  │
└─────────────────────────────────────┘
```

### Chat

Cuando el usuario pregunta al agente por tránsitos:

- El agente usa una foto actual tomada para ese request.
- El prompt debe saber la hora/zona horaria de esa foto.
- Si la pregunta viene desde una tarjeta del slider, el agente debe poder recibir
  esa hora seleccionada como contexto explícito y responder sobre esa hora.
- Si no hay hora seleccionada, el default es "Ahora".

## Centros: semántica de producto

La UI debe diferenciar tres conceptos. No son intercambiables.

1. **Centros activados por tránsito**
   - Centros donde hay al menos una puerta activada por un planeta en tránsito.
   - Esto no implica que el centro quede definido.

2. **Centros condicionados del usuario**
   - Centros que el usuario tiene indefinidos y que reciben activación por
     puertas en tránsito.
   - Este concepto ya existe parcialmente, pero debe integrarse mejor en la
     experiencia.

3. **Centros temporalmente definidos**
   - Centros que quedan definidos porque hay un canal completo temporal.
   - Puede venir de un canal personal, cuando el usuario tiene una puerta y el
     tránsito completa la otra.
   - Puede venir de un canal colectivo/educacional, cuando ambas puertas vienen
     del tránsito.
   - No se debe llamar "definido" a un centro solo porque una puerta aislada fue
     activada.

Esta distinción evita lecturas HD incorrectas y prepara el camino para una vista
futura de bodygraph coloreado.

## Alcance del MVP

Incluido:

- Selector `Hoy` / `Próximos 7 días`.
- `Hoy` como default.
- Foto "Ahora" al entrar/refrescar.
- Slider horario para el día actual.
- Uso de muestras del día en frontend para que el slider no dependa de roundtrips
  por arrastre.
- Chat usando tránsito actual por request.
- Sección de centros con la semántica anterior.
- Copia de UI que diferencia "actual", "hora seleccionada" y "panorama semanal".

Fuera de alcance:

- Bodygraph visual coloreado.
- Auto-refresh silencioso en segundo plano.
- Streaming de tránsitos cada minuto.
- Predicción real día por día para siete días con muestras diarias completas.
- Cambios en memoria/chat histórico.
- Nuevas dependencias o cambios de tooling.

## Criterios de aceptación de producto

- Al abrir Tránsitos a las 08:15, la vista default muestra `Hoy` y una foto
  calculada para las 08:15 locales del usuario.
- Al refrescar Tránsitos a las 09:03, la foto activa cambia a una calculada para
  las 09:03 locales del usuario.
- Al mover el slider a las 14:00, la UI muestra la foto de las 14:00 sin pedir
  un cálculo remoto por cada paso del arrastre.
- Al elegir `Próximos 7 días`, el usuario ve el panorama semanal existente como
  vista secundaria.
- La UI nunca llama "definido" a un centro que solo tiene una puerta aislada en
  tránsito.
- El chat usa una foto de tránsito actual cuando la pregunta no viene de una hora
  seleccionada.
- El chat usa la hora seleccionada cuando la pregunta nace desde una tarjeta del
  slider.
- La respuesta de tránsitos incluye puertas, canales y centros suficientes para
  sostener la lectura sin inferencias del LLM.

## Riesgos

- **Latencia del día completo**: calcular todas las muestras horarias puede ser
  más lento que la foto actual. La experiencia debe priorizar cargar "Ahora" y
  permitir que el timeline termine de cargar después si hace falta.
- **Copy engañosa en 7 días**: la vista semanal actual no es una ephemeris real
  de siete días. Si se mantiene, el texto debe venderla como panorama, no como
  cálculo día por día.
- **Semántica HD de centros**: activado, condicionado y definido temporalmente
  deben modelarse por separado. Mezclarlos produce lecturas incorrectas.
- **Chat sin zona horaria**: para responder "ahora" de verdad, el backend necesita
  conocer la zona horaria/timestamp del usuario o recibir la hora seleccionada.
- **Carga móvil**: slider, selector y tarjetas colapsables deben seguir siendo
  usables en mobile sin aumentar densidad visual de forma torpe.

## Preguntas abiertas

- ¿El slider debe moverse en pasos de una hora exacta o permitir medias horas?
  Decisión MVP: una hora exacta.
- ¿"Próximos 7 días" debe quedar como label literal o conviene llamarlo
  "Panorama semanal" hasta tener siete días reales?
  Decisión MVP: `Próximos 7 días`.
- ¿La foto diaria debe incluir 24 muestras o 25 muestras incluyendo "ahora" como
  punto especial?
  Recomendación MVP: 24 muestras horarias + "ahora".
- ¿El chat debe exponer explícitamente en la respuesta la hora del tránsito usado?
  Recomendación MVP: sí, al menos en metadata interna y en debug/telemetría.

## Decisiones cerradas

- El slider diario avanza en pasos de una hora exacta.
- El selector visible usa `Próximos 7 días` como segundo modo.
- Chat directo usa "Ahora".
- Chat disparado desde una tarjeta del slider usa la hora seleccionada.
- La UI de Tránsitos prioriza interpretación y orientación antes que detalle
  planetario. El detalle planetario queda como sección expandible al final.

## Siguiente paso

Si esta intención se aprueba, el próximo documento debe ser una spec técnica de
implementación. Esa spec debe bajar el contrato de datos, estrategia de cache,
impacto en chat, pruebas backend/frontend/e2e y plan de migración de la UI.
