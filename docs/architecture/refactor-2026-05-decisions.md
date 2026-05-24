# Refactor AI 2026-05 — decisiones técnicas y journey

**Branch**: `feature/refactor-design-ai-model`.
**Sesión**: 2026-05-15 / 2026-05-16.
**Trigger**: caso Daniela (ver `bug-investigation-daniela-2026-05.md`).
**Audiencia**: engineer que toca la capa de AI a futuro y necesita entender el *por qué* detrás del *qué*.

> Update 2026-05-24 (`astral-e2h.1`): la decisión de rollout cambió. El path v2 con tools es canónico; `agent-service.ts`, `FEATURE_CHAT_USE_TOOLS` y el fallback v1 fueron eliminados por decisión founder.

---

## TL;DR de las decisiones

1. **El modelo NO era el problema** — la arquitectura sí. Con tools deterministas, `gpt-4o-mini` iguala la accuracy de `gpt-4o` a 1/22 del costo.
2. **No post-output validator** — descartamos el spec del architect (50 líneas + parser regex + retry loop) a favor de **tool use por diseño** (el LLM consulta antes de afirmar).
3. **Sin migrar a Claude/Anthropic todavía** — el ahorro de prompt caching de Anthropic se ve a escala. En beta con 10 users no compensa el cambio de provider.
4. **Sin feature flag de chat tools** — `agent-service-v2.ts` es el único path. Mantener v1 confundía diagnóstico y permitió el caso Daniela en prod.
5. **Knowledge curado queda inline; datos canónicos van como tools** — knowledge interpretativo (qué significa ser Generador) lo consume el LLM; datos discretos verificables (qué puerta forma qué canal) los consulta.

---

## A — El journey en 5 fases

### Fase 1 — Fix de calidad sin refactor

Cambios:
- `CHAT_MODEL`, `MEMORY_WRITER_MODEL`, `REPORT_MODEL`, `EXTRACTION_MODEL` como env vars (defaults seguros).
- Tabla canónica de 36 canales HD (`HD_CHANNELS_FULL` + helpers).
- Inyección de la tabla en el system prompt + regla #13 detection ("verificá puerta-canal contra tabla").
- Reorden del system prompt: TODO static al inicio, dynamic al final → activa OpenAI prompt caching automático.
- Truncate de historial a `CHAT_HISTORY_TURNS=60` mensajes.
- Persistencia de `cached_tokens` en `llm_calls` para medir si el cache realmente se activa.

Resultado medido localmente:
- Con `gpt-4o-mini` + tabla + regla #13: **40% accuracy** (2/5 PASS) en caso Daniela. Mejor que el estado original (0%) pero no aceptable.
- Con `gpt-4o` + tabla + regla #13: **100% accuracy** (4/4 visible). Costo 17x.

### Fase 2 (intermedio) — Sparring para evitar la decisión obvia

Antes de aceptar "subimos a gpt-4o", invocamos `/sparring`. Blind spots detectados:

1. **N=5 es anécdota, no eval.** La diferencia 40% vs 100% no es estadísticamente significativa con muestras tan chicas.
2. **El test no replica el modo de falla real.** Daniela no preguntó "qué canal forma la Puerta 8?" — el LLM *espontáneamente* metió canal incorrecto en una respuesta narrativa. El verify_daniela_followup pregunta directo.
3. **Cambiaron 3 variables a la vez** (modelo + tabla + regla); le atribuimos todo al modelo sin medir las celdas intermedias del cuadrado.
4. **El cálculo de costo asume 10 msg/día/user** pero Daniela hizo 0.86 msg/día siendo la usuaria más activa. La proyección de $1.3K/mes a 100 users puede ser 5-10x pesimista.
5. **Reframe crítico**: el problema no es "qué modelo elijo" sino "cómo me aseguro que el chat no diga macanas". Resolver eso con arquitectura, no con dinero.

### Fase 2 (continuación) — Architect produce spec

Pedimos a `/architect` el spec del **post-output validator**:
- Parser regex sobre el draft del LLM
- Extraer claims tipo "Puerta X forma canal Y-Z"
- Validar contra `HD_CHANNELS_FULL`
- Si inválido, regenerar con feedback al LLM (max 2 retries)
- 22 horas estimadas, ~1,350 LoC

Estaba bien diseñado pero era **reactivo** (parchea alucinaciones después del hecho).

### Fase 2 (refactor real) — pivote a tool use

Tras un nuevo round de research multi-agent (3 sub-agents: context engineering, memory/history, agentic patterns 2026), el patrón ganador para el caso de Astral resultó ser **tool use deterministas**:
- El LLM consulta funciones que envuelven `HD_CHANNELS_FULL` y `GATE_TO_CENTER`
- Knowledge interpretativo se queda inline (qué significa cada centro)
- Datos discretos verificables se sacan del prompt y se exponen como capability

Implementación: Vercel AI SDK + `@ai-sdk/openai` + Zod schemas + `streamText` con `stopWhen=stepCountIs(5)`.

Resultado:
- `gpt-4o-mini` + 5 tools + instrucción obligatoria + prompt slim (33K chars vs 38K): **100% PASS (5/5)** en caso Daniela.
- Costo: ~$0.0018/turn (sin cache) o ~$0.0011/turn (con cache hit del 60%).
- Comparado con `gpt-4o`: **17x más barato a paridad de calidad**.

### Fase 3 — Triple barrido de calidad

Después de tener el path v2 funcionando, hicimos 3 barridos sistemáticos buscando AI slop, smells e inconsistencias:

- 7 issues encontrados, 7 fixeados: dedup helpers, comment outdated, test engañoso, mapUsage con casts, migración sin test, memory-writer sin cached_tokens, chat.ts:106 sin propagar cached_tokens.
- 8 issues identificados pero no fixeados (justificados): dup intencional de detection rules content, doc "~10 users" aprox, await pattern de SDK, sin test del flag.

Resultado final: **453/453 tests verde, tsc clean, 6 commits cohesivos**.

---

## B — Decisiones técnicas con justificación

### B.1 — ¿Por qué Vercel AI SDK y no llamada directa a OpenAI con function calling?

| Eje | Vercel AI SDK | OpenAI SDK directo |
|---|---|---|
| Tool use loop | Manejado por SDK (`stopWhen`) | Tenés que implementar el loop |
| Multi-provider futuro | 1 línea para swap a Anthropic | Reescribir adapter |
| Streaming SSE | Nativo (`textStream`) | Nativo |
| Type safety | Zod schemas + types exportados | Manual |
| Peso | +3 deps (`ai`, `@ai-sdk/openai`, `zod`) | 0 |

Ganaba Vercel AI SDK por **multi-provider futuro** y **tool loop fuera de la caja**. Si la beta no funciona y migramos a Claude por ahorro de prompt caching explícito, es 1 línea (`anthropic(MODEL)` en vez de `openai(MODEL)`).

### B.2 — ¿Por qué NO `toolChoice: 'required'`?

Significaría que el LLM **debe** llamar tool en CADA turn. Rompe casos triviales: "hola, ¿cómo estás?" no requiere HD tools, pero `required` forzaría una llamada innecesaria → +200ms latencia + tokens desperdiciados.

Alternativa adoptada: **instrucción explícita** en el prompt ("DEBES llamar la tool antes de afirmar puerta-canal"). El LLM decide cuándo invocar — funciona en 100% de los casos medidos.

### B.3 — ¿Por qué `MAX_AGENT_STEPS=5`?

Cada step = 1 llamada al LLM. Con 5 tools registradas, el ceiling realista es:
- Step 1: LLM decide consultar tool A → emite tool_call
- Step 2: LLM ve resultado de A → decide consultar tool B → emite tool_call
- Step 3: LLM ve resultado de B → genera respuesta final

Eso son 3 steps típicos. `5` deja margen para casos complejos sin permitir runaway loops infinitos (cap dura). Si la métrica de producción muestra que casi nadie llega a step 4, se puede bajar a 3.

### B.4 — ¿Por qué knowledge HD interpretativo queda inline?

`HD_CONDENSED` tiene secciones como "LOS 5 TIPOS", "AUTORIDADES", "PERFIL". Es contenido que **el LLM consume** para razonar sobre la situación del usuario, no datos discretos que **consulta** para un fact específico.

Si convirtiéramos "qué significa ser Generador" en tool, el LLM tendría que llamarlo en cada turn que mencione tipos → +1 roundtrip + tokens del schema. Para conocimiento interpretativo, inline funciona mejor.

Lo que **sí** convertimos en tool: data tabular finita y cerrada (36 canales, 64 puertas → 9 centros).

### B.5 — ¿Por qué ya no dejamos el path v1 vivo?

La hipótesis de rollout 2026-05-16 asumía que v1 era un fallback seguro. El diagnóstico de Daniela mostró lo contrario: el flag quedó OFF y prod siguió usando el path sin tools, que era precisamente la causa de alucinaciones puerta/canal. La decisión founder 2026-05-24 fue eliminar el fallback para que no existan dos verdades operativas.

### B.6 — ¿Por qué `CHAT_HISTORY_TURNS=60` y no compaction ahora?

Mainstream (ChatGPT, Claude.ai, Cursor): 10-20 turns. Pero Astral tiene `memory_md` que captura los hechos persistentes → podemos cortar más agresivo sin perder identity. 60 = ~30 pares user/assistant = una conversación reciente completa para la beta actual.

Si emerge feedback "no se acuerda lo que dije hace 5 mensajes", subir. Si el costo escala mal, bajar. Es un knob env var.

### B.7 — ¿Por qué prompt cache automático de OpenAI y no Anthropic explícito?

OpenAI cachea automáticamente prefijos >1024 tokens estables. Sin código adicional, sin headers, 50% off input. Anthropic ofrece 90% off pero requiere refactor a `system: [bloques con cache_control]`.

Para Astral en beta con un solo provider (OpenAI), automático es suficiente. Cuando se justifique multi-provider (beads `astral-???-multi-provider`), también activamos cache headers Anthropic.

---

## C — Lo que descartamos explícitamente

| Descartado | Razón |
|---|---|
| Upgrade a `gpt-4o` global | 17x costo, calidad alcanzable con tools en mini |
| Migrar a Claude Sonnet/Haiku ahora | Ahorro real con prompt caching se ve a escala; en beta no compensa |
| Post-output validator (architect spec) | Reactivo. Tool use ataca la causa raíz |
| `toolChoice: 'required'` | Sobrecorrige; rompe casos triviales |
| Threads (`conversation_id`) | Prematuro en beta <10 users |
| RAG sobre history | Overkill para <100 turns por conversación |
| Migrar memory_md a Mem0/Letta | Ya implementamos el mismo patrón artesanal |
| LangChain.js | Heavy abstraction injustificada para el caso |
| Subir a Tier 2 OpenAI ($50 deposit + 7 días) | Si chat queda en gpt-4o-mini, Tier 1 (200K TPM mini) alcanza sobradamente |

---

## D — Estado de tracking

Esta sección es histórica del refactor 2026-05. Para estado operativo actual,
usar `bd show astral-e2h` y la sección de P0 abiertos en `AGENTS.md`; varios
beads listados originalmente ya fueron cerrados o absorbidos por epics nuevas.

| Bead | Estado 2026-05-24 | Qué |
|---|---|---|
| `astral-0b7` | cerrado | Bug A: `/me/assets` con `fileType=hd` deja profile vacío |
| `astral-bdt` | cerrado | Bug B: `PUT /users/:id` admin permite escribir profile de otro user |
| `astral-m25` | abierto P0 | Data fix manual para premium afectadas |
| `astral-4ue` | abierto P0 | Sucesor operativo de `astral-m25`: script `migrate-user-to-swiss.ts` |
| `astral-e2h.1` | cerrado | Eliminar v1 + flag; v2 canónico |
| `astral-7i8` | abierto P1/P4 según epic | Compact endpoint/UX, reencuadrado dentro de `astral-e2h` |
| TBD | futuro | Multi-provider abstraction, retry/backoff y Batch API para `memory_writer` siguen como ideas, no como fuente de verdad de tracking |

---

## E — Métricas para validar el refactor en producción

Con el path canónico en producción, los thresholds:

| Métrica | Target | Cómo medir |
|---|---|---|
| Cache hit rate para `chat_stream` | >0.5 | `AVG(cached_tokens / tokens_in)` desde turn 2 |
| Latencia P95 `chat_stream` | <20,000 ms | `MAX(latency_ms)` percentil 95 |
| Costo agregado semanal `chat_stream` | -40% a -70% vs baseline pre-refactor | `SUM(cost_usd)` |
| Tasa de feedback negativo HD | 0 reportes en 7 días | `chat_messages.feedback_thumb='down'` + revisión manual de `feedback_note` |
| Smoke `npm run smoke:chat-v2 -- 5` | 5/5 sostenido en 3 corridas distintas del día | exit code |

Si todas verde por 7 días, cerrar los beads de validación del Bloque A.

---

## H — Deliberación 2026-05-16: compaction de history (DIFERIDO)

> Update 2026-05-24 (`astral-e2h.11`): `docs/adr/chat-compaction-policy.md`
> descarta el endpoint V1 destructivo (`summary` en `memory_md` + truncado /
> borrado de `chat_messages`). Si se reabre compaction, debe usar summary
> separado y semantica reversible, probablemente dentro de V2 threads/per-profile.

**Trigger**: el founder propuso 4 opciones (A/B/C/D) para resolver "si una conversación cruza 30 mensajes, los mensajes 31+ se cortan y se pierde info que no esté en memory_md". Inclinación inicial: opción C (rolling summary, mainstream pattern de ChatGPT/Claude).

**Proceso**: deliberación paralela con sub-agents `sparring` y `architect`.

**Sparring detectó**:
1. El problema no existe en data real — ningún user cruzó 30 turns en prod. Daniela (la más activa, 0.86 msg/día) necesitaría 35 días seguidos para tocar el límite.
2. "Industry standard 2026" no es la industry de Astral — ChatGPT/Claude son long-thread genéricos; Astral es coaching app donde los users mezclan 4 temas en 7 días (NO long thread).
3. memory_writer no fue auditado — agregar compaction encima de un writer no validado es "dos cosas rotas en cascada".
4. Compaction "fire-and-forget" agrega race conditions no modeladas.
5. Inclinación por C viene de leer que ChatGPT lo hace, no de data de Astral — mismo error que llevó al post-output validator descartado.

**Architect cuantificó**:
- Opción C: costo permanente +$0.0002/turn pero **rompe cache hit >0.5** del prefix static → costo REAL sube +40%. Solapamiento >90% con memory_md ya existente.
- Opción E (no contemplada por el founder): bump `CHAT_HISTORY_TURNS` 30 → 60. Costo $0.11/mes para toda la beta. 1 línea. Empuja el cliff de 5 a 10 semanas.
- Opción F: E + counter de truncate → recolección de data real para decidir B/C/D con evidencia.
- Si counter sube en el futuro: D (threads) > C (compaction). El patrón observado es topic-mixing, no longitud — y C no resuelve topic-mixing, solo lo comprime.

**Veredicto adoptado**:
1. Implementado: `CHAT_HISTORY_TURNS=60` + counter `chat_history_truncated` en `routes/chat.ts:68-85`.
2. Diferido: B/C/D hasta data real (bead `astral-7i8`, P4).
3. Foco operativo original: volver a los bugs P0. Estado actual: `astral-0b7` y `astral-bdt` están cerrados; quedan `astral-m25` y `astral-4ue` según `AGENTS.md`.

**Reportes completos**: ver outputs del sparring + architect en el thread de la sesión 2026-05-16.

---

## F — Si tenés que tocar esto a futuro

1. **Antes de cambiar el system prompt**, corré `npm run smoke:chat-v2 -- 10` para tener baseline.
2. **No mezcles static y dynamic** en el system prompt — rompe OpenAI cache.
3. **No agregues content al system prompt** sin medir tokens_in antes/después. Cada KB extra son centavos al día y dólares al mes a escala.
4. **Si el LLM alucina algo verificable**, la respuesta default es **agregar un tool**, no agregar reglas al prompt. Las reglas son frágiles, los tools son determinísticos.
5. **No reintroduzcas fallback v1**. Si el path canónico falla, arreglá v2 o escalá; el rollback por `FEATURE_CHAT_USE_TOOLS=false` ya no existe.
