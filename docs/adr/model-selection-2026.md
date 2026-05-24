# ADR: Seleccion objetiva de modelos LLM para Astral

Estado: Aceptado
Fecha: 2026-05-24
Area: Chat, reportes, memory writer, routing LLM
Bead: `astral-e2h.8`

## Contexto

El caso Daniela no se resolvio cambiando a un modelo mas caro. Se resolvio
eliminando el path legacy sin tools y haciendo canonico el chat v2 con tools HD
deterministas. Por eso esta ADR no busca "el modelo magico"; busca definir que
modelos vale la pena evaluar por route sin volver a confundir calidad de
arquitectura con calidad de modelo.

Estado actual de Astral:

- `CHAT_MODEL`: `gpt-4o-mini` por default, via Vercel AI SDK + `@ai-sdk/openai`.
- `REPORT_MODEL`: `gpt-4o-mini` por default, fetch directo a OpenAI Chat
  Completions.
- `MEMORY_WRITER_MODEL`: `gpt-4o-mini` por default, fetch directo a OpenAI Chat
  Completions.
- Extraccion de carta: deterministica; no usa LLM en el flujo canonico.
- `model-registry.ts` y `pricing.ts` conocen solo `gpt-4o-mini` y `gpt-4o`.
- El contexto de chat ya se selecciona por token budget model-aware.

## Decision

Mantener `gpt-4o-mini` como default operativo de chat, report y
`memory_writer` hasta tener evals live multi-provider con la misma suite de
Astral. No migrar a Claude, Gemini, Groq, Together ni GPT-5.x por intuicion,
benchmarks genericos o precio nominal.

Adoptar esta shortlist para las siguientes etapas:

| Route | Default actual | Candidatos a evaluar | No usar como default V1 |
|---|---|---|---|
| `chat_stream` | `gpt-4o-mini` | `gpt-5.4-mini`, `claude-sonnet-4-6`, `gemini-2.5-flash`, Groq `openai/gpt-oss-120b` | modelos preview, Opus/frontier caros, open models sin tool compliance medido |
| `report` | `gpt-4o-mini` | `gpt-5.4-mini`, `claude-sonnet-4-6`, `gemini-2.5-pro`, `gpt-5.5` como escalamiento premium | `gpt-4o` como intermedio permanente, modelos con output cap chico |
| `memory_writer` | `gpt-4o-mini` | `gpt-5.4-nano`, `gpt-5-mini`, `claude-haiku-4-5`, `gemini-2.5-flash-lite`, Groq/Together `gpt-oss-20b` | Sonnet/Opus/frontier salvo que los baratos fallen estructuralmente |
| `extraction` | deterministica | Ninguno en V1; fallback futuro solo si hay bead especifico | cualquier LLM que reemplace el parser canonico sin regression suite |

Regla operativa: ningun modelo nuevo puede entrar a prod si no existe en:

1. registry de contexto (`contextWindowTokens`, `maxOutputTokens`, provider,
   tokenizer, reservas);
2. tabla de pricing usada por telemetria;
3. eval suite de route con metricas comparables;
4. telemetria que preserve `route`, `model`, tokens, cache, tool calls,
   latencia y costo.

## Datos disponibles

### Lo medido en Astral

| Experimento Astral | Resultado |
|---|---|
| Legacy v1 sin tools, `gpt-4o-mini` | Daniela alucino canal 12-20/20-34 en prod. |
| Prompt con tabla + regla, `gpt-4o-mini` | 40% PASS en caso Daniela local historico. |
| Prompt con tabla + regla, `gpt-4o` | 100% PASS local historico, costo mucho mayor. |
| Chat v2 canonico con tools, `gpt-4o-mini` | 5/5 PASS en smoke Daniela y regression suite HD con tools. |

Interpretacion: el salto de calidad vino de tool compliance y datos canonicos,
no de pagar un modelo mayor. Cualquier A/B de modelos debe preservar ese
invariante: el modelo no puede "recordar" canales/puertas; debe consultar tools.

### Limite honesto de esta investigacion

No se corrio la misma suite live contra todos los proveedores. El entorno local
solo tiene `OPENAI_API_KEY`; no hay `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`,
`GROQ_API_KEY` ni `TOGETHER_API_KEY`, y el backend aun no tiene adapters para
esas rutas. Por lo tanto:

- la comparacion de costo/contexto/tool support viene de documentacion oficial;
- la medicion de calidad Astral solo existe para el stack OpenAI actual;
- `.10` no debe implementar routing prod a modelos nuevos sin una corrida live
  de evals por provider.

## Comparacion cuantitativa

Costos en USD por 1M tokens. El costo por turno usa un turno representativo de
Astral: 13K input tokens y 600 output tokens. Cuando aplica cache-read, se
modela 8K input tokens cacheados y 5K no cacheados.

| Provider | Modelo | Contexto / output | Input | Cached/read input | Output | Costo turno sin cache | Costo turno cache-read | Tool / structured support | Estado para Astral |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| OpenAI | `gpt-4o-mini` | 128K / 16K | 0.15 | 0.075 | 0.60 | 0.00231 | 0.00171 | Si | default actual |
| OpenAI | `gpt-4o` | 128K / 16K | 2.50 | 1.25 | 10.00 | 0.03850 | 0.02225 | Si | no recomendado como intermedio |
| OpenAI | `gpt-5-mini` | 400K / 128K | 0.25 | 0.025 | 2.00 | 0.00445 | 0.00265 | Si | candidato background |
| OpenAI | `gpt-5.4-nano` | 400K / 128K | 0.20 | 0.020 | 1.25 | 0.00335 | 0.00191 | Si | candidato memory/extraction fallback |
| OpenAI | `gpt-5.4-mini` | 400K / 128K | 0.75 | 0.075 | 4.50 | 0.01245 | 0.00705 | Si | primer challenger chat/report |
| OpenAI | `gpt-5.5` | 1,050K / 128K | 5.00 | 0.50 | 30.00 | 0.08300 | 0.04450 | Si | solo escalamiento premium |
| Anthropic | `claude-haiku-4-5` | 200K / 64K | 1.00 | 0.10 read | 5.00 | 0.01600 | 0.00880 | Si | candidato memory writer |
| Anthropic | `claude-sonnet-4-6` | 1M / 64K | 3.00 | 0.30 read | 15.00 | 0.04800 | 0.02640 | Si | challenger serio chat/report |
| Anthropic | `claude-opus-4-7` | 1M / 128K | 5.00 | 0.50 read | 25.00 | 0.08000 | 0.04400 | Si | escalamiento, no default |
| Google | `gemini-2.5-flash-lite` | 1M / 65K | 0.10 | 0.01 read | 0.40 | 0.00154 | 0.00082 | Si | candidato cheap background |
| Google | `gemini-2.5-flash` | 1M / 65K | 0.30 | 0.03 read | 2.50 | 0.00540 | 0.00324 | Si | challenger costo/contexto chat |
| Google | `gemini-2.5-pro` | 1M / 65K | 1.25+ | 0.125+ read | 10.00+ | 0.02225+ | 0.01325+ | Si | report/escalamiento |
| Groq | `openai/gpt-oss-120b` | 131K / 65K | 0.15 | 0.075 | 0.60 | 0.00231 | 0.00171 | Si | low-cost eval target |
| Groq | `llama-3.3-70b-versatile` | 131K / 32K | 0.59 | n/a | 0.79 | 0.00814 | n/a | Si | latency fallback candidate |
| Together | `openai/gpt-oss-120b` | 128K | 0.15 | n/a | 0.60 | 0.00231 | n/a | Si | compare vs Groq only if needed |
| Together | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | 131K | 0.88 | n/a | 0.88 | 0.01197 | n/a | Si | weaker economic fit |

Fuentes primarias: OpenAI pricing/model pages, Anthropic model overview,
pricing and prompt-caching docs, Google Gemini pricing/model/function-calling
docs, Groq model/pricing docs, Together serverless/OpenAI-compatibility docs.

## Metricas de seleccion

La ruta `chat_stream` debe rankear modelos por este orden:

1. **Tool compliance HD**: cuando el prompt afirma puerta/canal/centro, el
   modelo llama la tool correcta antes de responder.
2. **Tasa anti-alucinacion HD**: suite Daniela + invalid pairs + valid pairs.
3. **Context fit**: soporta prompt real, tools schema, current message y
   historial seleccionado por budget sin caer en modo conservador.
4. **Latencia p50/p90**: con prompt Astral real, no con prompts de benchmark.
5. **Costo observado**: `llm_calls.cost_usd`, cache hit real y output real.
6. **Voice/style fit**: Spanish rioplatense, tono Daniela/business pack, sin
   sonar generico o terapeutico.

Report y memory writer usan pesos distintos:

- `report`: calidad, estructura, completitud, costo total por reporte y
  degradacion controlada pesan mas que latencia.
- `memory_writer`: exactitud estructurada, NOOP correcto, costo y estabilidad
  pesan mas que prosa.
- `extraction`: no entra en ranking mientras el parser deterministico funcione.

## Recomendacion por route

### Chat

Mantener `gpt-4o-mini` por default. Es el unico modelo con evidencia local
verde en el path canonico: tools HD + selector model-aware + telemetria.

Primera ronda de A/B:

1. `gpt-5.4-mini`: upgrade natural dentro de OpenAI, 400K context window y
   tool/structured support. Cuesta ~5.4x mas por turno con cache-read que
   `gpt-4o-mini`, por lo que debe ganar claramente en calidad o reducir fallos.
2. `gemini-2.5-flash`: gran contexto y costo intermedio. Riesgo: semantics de
   tool-calling/provider adapter y estilo HD en espanol.
3. `claude-sonnet-4-6`: mejor candidato Anthropic para calidad, pero costo por
   turno cache-read ~15.4x mayor que `gpt-4o-mini`. Solo tiene sentido si
   reduce fallos que hoy no esten resueltos con tools.
4. Groq `openai/gpt-oss-120b`: costo similar al default y latencia atractiva,
   pero no se puede asumir voice fit ni tool compliance.

No recomendar `gpt-4o` como paso intermedio: cuesta mucho mas que modelos mini
modernos y no aporta una ventaja arquitectonica clara.

### Report

Mantener `gpt-4o-mini` hasta medir calidad de reportes con fixtures reales.
Evaluar `gpt-5.4-mini` y `claude-sonnet-4-6` como defaults alternativos.
Reservar `gpt-5.5`, `claude-opus-4-7` o `gemini-2.5-pro` para escalamiento
premium/retry manual si el analisis economico de `.9` lo permite.

### Memory writer

Mantener `gpt-4o-mini` hasta tener structured-output evals especificos.
La ruta debe buscar el modelo mas barato que preserve:

- NOOP cuando no hay cambio real;
- no inventar facts;
- no borrar facts salvo contradiccion explicita;
- salida markdown estable y dentro del cap.

Candidatos: `gpt-5.4-nano`, `gpt-5-mini`, `claude-haiku-4-5`,
`gemini-2.5-flash-lite`, Groq/Together `gpt-oss-20b`.

### Extraction

Seguir deterministica. Meter LLM en extraction seria un cambio de producto y de
riesgo: un error ahi envenena el perfil HD, y luego chat/report/transitos
razonan sobre una verdad falsa. Si se agrega fallback futuro, debe ser bead
separado con fixtures de PDFs problematicos y revision humana.

## Politica de eval antes de routing

El routing dinamico de `.10` solo puede promocionar modelos si existe un runner
que ejecute la misma suite por modelo y guarde una matriz asi:

| Route | Metrica | Target minimo |
|---|---|---|
| chat | Daniela / Gate 8 / invalid pairs | 100% pass, tool call requerido |
| chat | tool-call rate en prompts verificables | 100% |
| chat | no tool calls en small talk | no forzar tools innecesarias |
| chat | latencia p90 | dentro del SLA definido por `.9` |
| chat | costo/turno | dentro del margen definido por `.9` |
| report | secciones completas/en orden | 100% |
| report | no gates/centers fuera de contexto | 100% |
| memory_writer | NOOP correcto | >= 95% |
| memory_writer | no facts inventados | 100% |

La suite debe producir outputs comparables:

- provider;
- model;
- route;
- prompt fixture id;
- pass/fail por eval;
- tools usadas;
- tokens in/out/cached;
- costo;
- latency ms;
- texto output para revision manual cuando falla.

## Guardrails de implementacion futura

- No introducir `any`, adapters genericos opacos ni factories que escondan
  provider-specific behavior.
- No usar modelos preview como default de prod.
- No activar fallback silencioso entre providers en V1: si un modelo falla, la
  telemetria debe mostrarlo; un fallback automatico puede esconder regresiones.
- No sumar providers al runtime sin `pricing.ts` y `model-registry.ts`.
- No cambiar system prompt para compensar fallos de modelo en datos
  verificables; agregar/mejorar tools.
- No usar costo por 1M tokens aislado: comparar costo real por route con cache,
  output y latencia observada.

## Consecuencias

Esta ADR desbloquea `.9` para hacer analisis economico con una shortlist real
en vez de todos los modelos del mercado.

Esta ADR no desbloquea por si sola promocionar modelos a prod. Se creo
`astral-e2h.14` para cubrir la eval live multi-provider que el acceptance
original de `.8` no puede cumplir honestamente sin adapters/API keys. `.10`
queda bloqueado por `.9` y `.14`.

## Fuentes

- OpenAI API pricing and model docs: <https://openai.com/api/pricing/>
- Anthropic model overview: <https://docs.anthropic.com/en/docs/about-claude/models/overview>
- Anthropic pricing: <https://docs.anthropic.com/en/docs/about-claude/pricing>
- Anthropic prompt caching: <https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching>
- Google Gemini pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- Google Gemini function calling: <https://ai.google.dev/gemini-api/docs/function-calling>
- Groq pricing: <https://groq.com/pricing/>
- Groq model docs: <https://console.groq.com/docs/models>
- Together serverless models: <https://docs.together.ai/docs/serverless/models>
- Together OpenAI compatibility: <https://docs.together.ai/docs/inference/openai-compatibility>

## Handoff

Siguiente bead: `astral-e2h.9`. Antes de routing prod, `astral-e2h.14`.

Usar esta ADR como input para calcular si un modelo alternativo entra en el
precio cobrado por producto. La pregunta de `.9` no es "cual es mejor", sino
"que calidad incremental puede pagar Astral por chat/report/memory sin comerse
el margen".
