# ADR: Shortlist OpenAI para Astral

Estado: Aceptado
Fecha: 2026-05-24
Area: Chat, reportes, memory writer, voz, routing LLM
Bead: `astral-e2h.17`

## Contexto

Este ADR existe porque la eval OpenAI-only de `astral-e2h.15` no debe arrancar
con una shortlist heredada o comoda. La decision tenia que volver a mirar todos
los modelos OpenAI actuales contra las superficies reales de Astral.

No se ejecuto ninguna llamada real a OpenAI ni a otros proveedores. No se
consumieron tokens reales. La investigacion uso:

- documentacion oficial de OpenAI (`developers.openai.com/api/docs/models/*`);
- codigo local de Astral;
- `docs/adr/model-selection-2026.md`;
- `docs/economics/model-cost-margin-analysis.md`;
- sparring documentado en `astral-e2h.17`.

## Superficies reales de Astral

| Surface | Hoy | Necesidad de modelo |
|---|---|---|
| `chat_stream` / `chat` / `mcp_ask` | `CHAT_MODEL ?? gpt-4o-mini`, Vercel AI SDK, 5 HD tools deterministas | Tool compliance perfecto antes de afirmar puertas/canales/centros, buen espanol, bajo costo por turno, streaming |
| `report` | `REPORT_MODEL ?? gpt-4o-mini`, Chat Completions directo, 1 llamada free / 3 llamadas premium | Mejor sintesis y estructura; latencia menos critica que chat; evitar claims HD no soportados |
| `memory_writer` | `MEMORY_WRITER_MODEL ?? gpt-4o-mini`, Chat Completions directo, fire-and-forget | NOOP correcto, no inventar facts, no borrar salvo contradiccion explicita, bajo costo |
| Voz / transcripcion | `whisper-1` hardcodeado en `/transcribe` | ASR en espanol, nombres/terminos HD, latencia user-facing |
| PDF / carta / transitos / bodygraph | Deterministico, sin LLM | No entra en ranking LLM V1; un LLM aca podria envenenar el perfil fuente de verdad |

## Criterios de seleccion

1. **Fit por route, no modelo global**. Chat, report, memory writer y ASR tienen
   metricas distintas.
2. **Anti-alucinacion HD primero**. Para chat, el modelo tiene que llamar tools
   cuando el prompt toca puertas/canales/centros. El caso Daniela se arreglo con
   arquitectura y datos canonicos, no pagando un modelo mas grande.
3. **Calidad/precio real de Astral**. Usar costo por turno/report observado,
   no solo precio por 1M tokens.
4. **Compatibilidad operativa**. Un modelo nuevo necesita registry de contexto,
   pricing, telemetry y eval antes de prod.
5. **No usar modelos deprecated, ChatGPT-only, preview o de otra modalidad como
   default backend**.

## Inventario OpenAI revisado

| Familia | Modelos revisados | Decision para Astral |
|---|---|---|
| Frontier / reasoning GPT-5.x | `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-pro`, `gpt-5.2`, `gpt-5.2-pro`, `gpt-5.1`, `gpt-5`, `gpt-5-pro` | Solo algunos entran por costo/fit. `gpt-5.4` queda como opcion premium/report. `gpt-5.5` queda descartado como default por costo. Versiones previas solo si hay razon de estabilidad o disponibilidad. |
| Mini / nano | `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1-mini`, `gpt-4o-mini` | Nucleo de la shortlist: mejor balance para chat, memory writer y tareas high-volume. |
| 4.x no-reasoning | `gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `gpt-4o-mini`, `gpt-4`, `gpt-4-turbo` | `gpt-4o-mini` se mantiene por evidencia local. `gpt-4.1` queda runner-up para report/strict instruction. `gpt-4o` y `gpt-4-turbo` no son buen paso intermedio por costo/edad. |
| o-series | `o3`, `o3-pro`, `o4-mini`, `o1*` | No entran en top 5: solapan con GPT-5.x, varios figuran sucedidos/deprecated o no tienen fit economico claro para V1. |
| ChatGPT-only | `chat-latest`, `gpt-5.x-chat-latest`, `chatgpt-4o-latest` | No usar en backend: la pagina oficial los separa como modelos de ChatGPT y no recomendados para API. |
| Audio / ASR / realtime / TTS | `gpt-4o-mini-transcribe`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize`, `whisper-1`, `gpt-audio*`, `gpt-realtime*`, `tts-*` | Solo ASR entra en este ADR. Realtime/TTS/audio output son para features futuras, no para chat textual actual. |
| Imagen / video | `gpt-image-*`, DALL-E, Sora | Fuera de scope core. No resuelven chat/report/memory/ASR. |
| Embeddings | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` | No son modelos generativos. Candidatos futuros para RAG/memoria semantica, no para `.15`. |
| Moderacion | `omni-moderation-*`, legacy text moderation | No son modelos de respuesta. Posible safety gate futuro, no routing LLM. |
| Codex / computer-use / deep-research / search preview | Codex, computer-use, deep-research, search-preview | Especializados o deprecated para este producto; no deben entrar en default backend V1. |

## Shortlist final de 5 modelos OpenAI

### Resumen calidad/precio

Precios en USD por 1M tokens segun documentacion oficial revisada. Para chat y
report se cruzan con `docs/economics/model-cost-margin-analysis.md`; para ASR,
el costo se debe medir en `.15` con fixtures de audio porque `whisper-1` usa
precio por minuto y `gpt-4o-mini-transcribe` usa otra metrica.

| Modelo | Input | Cached input | Output | Fit economico para Astral |
|---|---:|---:|---:|---|
| `gpt-4o-mini` | 0.15 | 0.075 | 0.60 | Default probado: chat avg real ~USD 0.002316/turn; margen sano con caps actuales. |
| `gpt-5.4-mini` | 0.75 | 0.075 | 4.50 | Viable como challenger: el analisis economico lo ubica en ~USD 0.012723/mensaje representativo; requiere lift claro. |
| `gpt-5.4-nano` | 0.20 | 0.020 | 1.25 | Viable para background: mas caro que `gpt-4o-mini` en output, pero barato para memoria/clasificacion si mejora estructura. |
| `gpt-5.4` | 2.50 | 0.25 | 15.00 | No default: solo report premium/retry si mejora calidad de forma visible. |
| `gpt-4o-mini-transcribe` | Audio 1.25 | n/a | Audio 5.00 | ASR separado: candidato costo/calidad contra `whisper-1`, no contra chat. |
| `whisper-1` | n/a | n/a | n/a | Baseline ASR actual; se compara por minuto, WER, latencia y terminos HD. |

### 1. `gpt-4o-mini`

**Rol recomendado:** baseline productivo para `CHAT_MODEL`, `REPORT_MODEL` y
`MEMORY_WRITER_MODEL`.

**Por que queda:** es el unico modelo con evidencia local verde en el path
canonico de Astral: chat v2, tools HD deterministas, selector model-aware de
historial y telemetria. Economicamente soporta los caps actuales con margen.

**Riesgo:** puede seguir fallando si no usa tools; por eso el criterio de eval
no es "respuesta linda", sino tool compliance y cero claims HD inventados.

### 2. `gpt-5.4-mini`

**Rol recomendado:** primer challenger OpenAI para `chat_stream`, `chat`,
`mcp_ask` y reportes.

**Por que queda:** es el upgrade mas razonable dentro de OpenAI para calidad sin
saltar a costo frontier. Tiene contexto grande, soporte de streaming, function
calling y structured outputs, y entra economicamente en escenarios premium si
demuestra lift medible.

**Riesgo:** cuesta bastante mas que `gpt-4o-mini`; si no mejora tool compliance,
tono o calidad de reportes, no justifica cambio.

### 3. `gpt-5.4-nano`

**Rol recomendado:** challenger para `memory_writer` y tareas background
estructuradas.

**Por que queda:** el memory writer no necesita prosa brillante; necesita NOOP,
no inventar facts, no borrar memoria y mantener markdown estable. `gpt-5.4-nano`
es el candidato moderno de bajo costo para clasificacion/extraccion/resumen con
structured outputs.

**Riesgo:** si "abarata" al costo de inventar facts persistentes, contamina la
memoria y empeora todos los chats futuros. Debe pasar fixtures especificos de
memoria antes de cualquier switch.

### 4. `gpt-5.4`

**Rol recomendado:** modelo de calidad para `report` premium o retry/escalamiento
manual, no default global de chat.

**Por que queda:** report premium es menos sensible a latencia que chat y tiene
un volumen/costo observado bajo. Si un modelo mayor agrega profundidad real en
negocio, estructura y aplicacion HD, puede justificar uso selectivo. `gpt-5.4`
queda por encima de `gpt-5.5` en calidad/precio para Astral: frontier enough,
pero bastante mas barato que la opcion mas nueva.

**Riesgo:** si se usa como default global, erosiona margen y puede esconder que
el problema real era falta de tools/report fixtures. Solo route report o
escalamiento medido.

### 5. `gpt-4o-mini-transcribe`

**Rol recomendado:** candidato para reemplazar o comparar contra `whisper-1` en
`/transcribe`.

**Por que queda:** Astral ya tiene grabacion de voz/transcripcion. Es una
superficie real del producto, pero no compite con `CHAT_MODEL`. La mejora
buscada es ASR en espanol y terminos/nombres propios, no razonamiento.

**Riesgo:** no debe mezclarse con la eval de chat/report. Requiere fixtures de
audio o grabaciones consentidas, costo separado y telemetria propia.

## Runner-ups y descartes relevantes

| Modelo / familia | Motivo |
|---|---|
| `gpt-4.1` | Muy buen runner-up para report/strict instruction por contexto y tool support, pero en top 5 queda desplazado por `gpt-5.4` como opcion premium y `gpt-5.4-mini` como challenger costo/calidad. Reconsiderar si `gpt-5.4-mini` falla en report pero `gpt-5.4` resulta demasiado caro. |
| `gpt-5-mini`, `gpt-5-nano` | Validos, pero la documentacion actual empuja los nuevos trabajos hacia `gpt-5.4-mini` / `gpt-5.4-nano`; no conviene duplicar evals sin hipotesis diferenciada. |
| `gpt-5.5`, `gpt-5.5-pro` | Alta calidad probable, mala relacion costo/precio para V1. Solo manual/offline/premium extremo, no `.15` inicial. |
| `gpt-4o` | Historicamente mejoro Daniela sin tools, pero hoy es un intermedio caro frente a mini moderno + tools. No agrega una arquitectura distinta. |
| `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize` | Buenos ASR runner-ups si `gpt-4o-mini-transcribe` falla. Diarize solo tiene sentido con audio multi-speaker, que Astral no tiene como necesidad V1. |
| `whisper-1` | Default actual y barato, pero no debe ser la unica opcion si la app depende mas de voz. Comparar contra `gpt-4o-mini-transcribe` antes de migrar. |
| Embeddings / moderation / image / realtime / TTS | Pueden ser features futuras, pero no resuelven el routing LLM de `.15` ni el caso Daniela. |
| Deprecated / preview / ChatGPT-only | No crear nuevas dependencias de backend con estos modelos. |

## Implicacion para `astral-e2h.15`

`astral-e2h.15` debe dejar de ser "probar 3 modelos por intuicion" y pasar a
una eval OpenAI-only route-specific:

| Route | Modelos a evaluar | Fixtures minimos |
|---|---|---|
| `chat_stream` / `chat` / `mcp_ask` | `gpt-4o-mini`, `gpt-5.4-mini` | Daniela, pares HD invalidos, pares validos, small talk sin tool innecesaria, tool calls obligatorias en claims verificables |
| `report` | `gpt-4o-mini`, `gpt-5.4-mini`, `gpt-5.4` | Secciones completas, orden, espanol, valor de negocio, no claims fuera del profile |
| `memory_writer` | `gpt-4o-mini`, `gpt-5.4-nano` | NOOP, ADD, UPDATE, DELETE por contradiccion explicita, no facts inventados, markdown estable |
| `transcribe` | `whisper-1`, `gpt-4o-mini-transcribe` | ASR espanol, nombres propios, terminos HD, latencia y costo; solo con audio consentido o fixtures no sensibles |

Antes de correr cualquier cosa live, `.15` debe pedir consentimiento explicito
con:

- modelos exactos;
- cantidad maxima de llamadas;
- cap USD;
- confirmacion de que se consumiran tokens reales.

## Decision

La shortlist OpenAI para Astral queda:

1. `gpt-4o-mini`
2. `gpt-5.4-mini`
3. `gpt-5.4-nano`
4. `gpt-5.4`
5. `gpt-4o-mini-transcribe`

Ninguno se promueve a produccion por este ADR. La decision productiva sigue
siendo: default `gpt-4o-mini` hasta que una eval route-specific demuestre que
otro modelo mejora calidad real sin romper margen, telemetria ni arquitectura.

## Fuentes oficiales

- OpenAI all models: <https://developers.openai.com/api/docs/models/all>
- `gpt-4o-mini`: <https://developers.openai.com/api/docs/models/gpt-4o-mini>
- `gpt-5.4-mini`: <https://developers.openai.com/api/docs/models/gpt-5.4-mini>
- `gpt-5.4-nano`: <https://developers.openai.com/api/docs/models/gpt-5.4-nano>
- `gpt-5.4`: <https://developers.openai.com/api/docs/models/gpt-5.4>
- `gpt-4o-mini-transcribe`: <https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe>
- `whisper-1`: <https://developers.openai.com/api/docs/models/whisper-1>
- OpenAI pricing: <https://developers.openai.com/api/docs/pricing>
