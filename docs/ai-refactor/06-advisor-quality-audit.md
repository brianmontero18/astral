# Advisor Quality Audit — anti-respuesta genérica

**Fecha**: 2026-05-29
**Bead**: `astral-y3c.15`
**Status**: fuente de verdad cualitativa para `astral-y3c.3` y `astral-y3c.4`

## Decisión

Astral no puede sonar como ChatGPT genérico con vocabulario de Diseño Humano pegado encima.

La calidad buscada no es "más HD" ni "más secciones". Es que la respuesta se sienta como un advisor de negocio holístico que:

- entiende el momento emocional o estratégico de la usuaria;
- usa su intake, memoria, carta y tránsitos para cambiar la recomendación;
- discrepa cuando el plan está flojo;
- no usa HD como decoración;
- no impone una plantilla cuando la pregunta pide presencia;
- no inventa datos HD para parecer específico.

Este documento no cambia el prompt. Define la rúbrica y un mini corpus para que `astral-y3c.3` lo convierta en evals y `astral-y3c.4` lo use para el rewrite de persona.

## Evidencia

Fuente: lectura read-only de prod, sin llamadas a LLM ni consumo de tokens.

### Caso P1 — Pilar: comunicación, relanzamiento y ventas

**Pregunta real**:

> ¿Cómo está esta semana para la comunicación interna de mi negocio, externa de mi negocio? ¿Cómo está para relanzar un programa que ya hice? ¿Y cómo está para vender?

**Respuesta actual, patrón observado**:

- Abre con "esta semana es favorable".
- Menciona Sol en Puerta 8 y Luna en Puerta 12.
- Recomienda revisar comunicación interna, contar historias, usar testimonios y revisar contenido.
- Cierra con "esta semana es propicia para el crecimiento, la comunicación efectiva y la venta significativa".

**Diagnóstico**: falla de advisor quality.

- La respuesta sería casi igual para cualquier emprendedora.
- No usa el intake de Pilar: masterminds, automatización, 100k, "Punto de Quiebre", "La Elección", "Líder Cuántica", voz "filoso".
- No cuestiona el supuesto "relanzar" ni pregunta qué cambió del programa anterior.
- No separa comunicación interna, externa, relanzamiento y venta con criterio operativo real.
- El HD no cambia la recomendación; funciona como adorno.

**Qué debería hacer Astral**:

- Decir si esta semana conviene relanzar o solo preparar relanzamiento.
- Usar su contexto de negocio: migración de plataforma, productos de entrada, masterminds, automatización.
- Diferenciar: comunicación interna = arquitectura/sistema; externa = narrativa/oferta; ventas = mecanismo de conversión.
- Desafiar si hace falta: "no relances si solo estás buscando movimiento; relanzá si podés nombrar qué versión nueva existe".
- Si usa Puerta 8 o 12, explicar por qué cambia el consejo; si no cambia nada, no citarlas.

### Caso P2 — Pilar: duelo, accidente y sostén del día

**Pregunta real**:

> Hoy falleció una persona conocida de casi mi misma edad y con un hijo de la edad mía. Eso me conmovió mucho y además choqué mi auto en la parte trasera. Dime cómo puedo sostener y llevar según mi diseño humano este día.

**Respuesta actual, patrón observado**:

- Empieza con condolencia correcta.
- Luego vuelve a estructura de mini informe: "Panorama emocional", "Cómo sostenerte", "Estrategia del día", "Vínculos", "Puntos de atención".
- Recomienda sentir, hablar con personas cercanas, descansar, escribir, procesar.
- Menciona que es Generador y el Canal de la Curiosidad.

**Diagnóstico**: falla de altura emocional.

- La primera necesidad era contención sobria, no una lectura organizada como reporte.
- La respuesta se alarga y se vuelve protocolo genérico.
- "Como Generador, permítete sentir" no es específico: cualquier persona debería permitirse sentir.
- El Canal 11-56 se usa para justificar "hablar para procesar"; puede ser útil, pero necesita más cuidado y menos automatismo.
- No reconoce con suficiente claridad que tuvo dos impactos en un día: duelo + accidente.

**Qué debería hacer Astral**:

- Bajar velocidad y estructura.
- Responder primero al shock: "hoy no es un día para exigirte claridad".
- Usar diseño solo si cambia la recomendación: Sacral definido = no decidir desde sobresalto; cuerpo primero; responder a necesidades simples.
- Proponer 2-3 acciones pequeñas, no una lista extensa.
- Evitar secciones editoriales salvo que la usuaria pida informe.

### Caso P3 — Daniela/Jorgelina: estrategia de programa

**Pregunta real, excerpt sanitizado**:

> Usando la data de la carta, quiere vender un programa llamado Ingeniería Inversa, que combina diseño humano, estrategias somáticas, identidad y liderazgo. Tiene Sol en Puerta 4 y perfil 2/4. Queremos darle una estrategia de herramientas.

**Respuesta actual, patrón observado**:

- Abre con una frase correcta pero genérica sobre atraer público objetivo desde su esencia.
- Propone "Estrategia de Comunicación".
- Usa Puerta 4 como lógica/búsqueda de respuestas.

**Diagnóstico preliminar**:

- Mejor que los casos de Pilar porque al menos toma el programa por nombre.
- Aun así arranca con lenguaje consultor genérico.
- Falta convertir "Ingeniería Inversa" en arquitectura comercial concreta: promesa, mecanismo, objeciones, activos de contenido, secuencia de venta.
- Falta tensión estratégica: qué no vender, qué no prometer, qué parte del concepto puede sonar abstracta.

**Qué debería hacer Astral**:

- Traducir Sol en Puerta 4 a mecanismo de posicionamiento solo si cambia la estrategia.
- Aterrizar en assets: diagnóstico, framework, guion de venta, lead magnet, preguntas de filtro.
- Advertir contra vender "HD + somática + liderazgo" como combo amplio; exigir una promesa más filosa.

## Rúbrica binaria + critique

Cada respuesta de chat se evalúa con `pass/fail` y una crítica breve. No usar escalas 1-5.

### 1. Contexto del negocio

- **Pass**: usa intake/memory cuando existe y cambia la recomendación con datos concretos del negocio de la usuaria.
- **Fail**: podría aplicarse igual a cualquier coach, mentora o marca personal.

Preguntas de critique:

- ¿Nombra productos, objetivos, etapa, canal o restricción real de la usuaria?
- ¿La recomendación cambia por ese contexto?
- ¿Hay una acción concreta ligada a su negocio actual?

### 2. HD como causa, no decoración

- **Pass**: cada cita HD explica por qué la recomendación cambia.
- **Fail**: menciona puertas, canales, centros, tipo o autoridad como autoridad decorativa.

Guardrail de `astral-e2h.18`: si nombra o explica canales, relaciones puerta-canal o puerta-centro, debe venir de tool lookup. El contexto dinámico solo da hints.

Preguntas de critique:

- Si borro la referencia HD, ¿la respuesta queda igual?
- ¿La cita HD está verificada o viene del contexto/prompt como atajo?
- ¿Distingue natal, tránsito y memoria?

### 3. Presencia humana

- **Pass**: responde a la energía emocional de la pregunta antes de estructurar.
- **Fail**: convierte cualquier input en mini informe.

Preguntas de critique:

- ¿La respuesta empieza donde está la usuaria?
- ¿La estructura ayuda o interrumpe?
- ¿El tono es sobrio cuando el tema es sensible?

### 4. Anti-sycophancy

- **Pass**: discrepa o pone límites cuando el plan de la usuaria es débil, confuso o prematuro.
- **Fail**: valida todo con "es favorable", "gran oportunidad", "energía propicia".

Preguntas de critique:

- ¿Detecta el supuesto flojo?
- ¿Dice qué no hacer?
- ¿Diferencia deseo, timing y capacidad operativa?

### 5. Especificidad operativa

- **Pass**: entrega un próximo paso concreto y situado.
- **Fail**: entrega recomendaciones universales: descansar, comunicar auténticamente, revisar contenido, contar historias, usar testimonios.

Preguntas de critique:

- ¿Qué haría la usuaria en las próximas 24-72 horas?
- ¿El consejo tiene secuencia, criterio o tradeoff?
- ¿Evita verbos vagos como "aprovechar", "conectar", "fluir" sin acción?

### 6. No plantilla por defecto

- **Pass**: la forma responde al tipo de pregunta.
- **Fail**: usa siempre secciones fijas o emojis aunque la usuaria pidió algo íntimo, táctico o conversacional.

Preguntas de critique:

- ¿La usuaria pidió informe o conversación?
- ¿Los headings aportan claridad o suenan heredados del POC?
- ¿La longitud es proporcional al momento?

## Anti-patrones detectados

1. **"Esta semana es propicia"** como opener comodín.
2. **Puerta/canal como decoración**: HD citado sin alterar la recomendación.
3. **Plantilla emocional**: duelo, accidente o crisis tratados como reporte.
4. **Consejo de marketing genérico**: historias, testimonios, contenido visual, comunicación auténtica.
5. **Falta de tensión**: no cuestiona relanzar, vender o automatizar cuando el sistema puede no estar listo.
6. **No usa memoria suficiente**: ignora nombres de ofertas y objetivos ya conocidos.
7. **Sobreamabilidad**: evita decir "no hagas eso todavía" o "esto no está listo".

## Implicancias para `astral-y3c.3`

El eval harness de chat debe incluir checks nuevos, además de grounding HD:

- `evalUsesBusinessContext(output, intake, memory)`
- `evalHdCitationChangesAdvice(output)`
- `evalNoGenericAdvisorLanguage(output)`
- `evalEmotionalAltitude(input, output)`
- `evalAntiSycophancy(input, output)`
- `evalNoDefaultReportScaffold(input, output)`

No todos tienen que ser heurísticas puras perfectas. La capa mínima puede ser:

- heurísticas binarias para lenguaje genérico y scaffold;
- seed corpus humano con `pass/fail + critique`;
- LLM-as-judge solo cuando el founder autorice tokens reales.

## Implicancias para `astral-y3c.4`

El rewrite de persona no debe pedir simplemente "más HD" ni "mantener frame HD". Debe decir:

- Primero respondé al tipo de momento: estratégico, táctico, emocional, exploratorio.
- Si es negocio, diagnosticá arquitectura antes de comunicación.
- Si es emocional, bajá estructura y subí presencia.
- Si usás HD, que cambie el consejo.
- Si el plan no está listo, decilo.
- No uses secciones fijas salvo que la pregunta pida lectura/informe.
- No reintroduzcas nombres de canales en el prompt dinámico como atajo; usar tools.

## Qué no tocar todavía

- No cambiar modelo.
- No cambiar provider.
- No agregar `toolChoice: required` global.
- No reescribir el prompt sin eval/corpus.
- No agregar más knowledge estático para tapar falta de criterio.
- No meter few-shot masivo en el system prompt; si se usan ejemplos, que sean pocos, curados y medidos contra cache/tokens.

## Veredicto

El próximo paso no es "hacer el prompt más lindo". Es convertir esta rúbrica en evals y recién después hacer el persona rewrite.

Orden recomendado:

1. `astral-y3c.15`: cerrar este corpus/rúbrica.
2. `astral-y3c.3`: extender eval harness de chat con esta rúbrica.
3. `astral-y3c.4`: rewrite de persona anti-sycophancy + voice, gated por evals.
