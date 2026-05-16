# Refactor AI 2026-05 — decisiones técnicas y journey

**Branch**: `feature/refactor-design-ai-model`.
**Sesión**: 2026-05-15 / 2026-05-16.
**Trigger**: caso Daniela (ver `bug-investigation-daniela-2026-05.md`).
**Audiencia**: engineer que toca la capa de AI a futuro y necesita entender el *por qué* detrás del *qué*.

---

## TL;DR de las decisiones

1. **El modelo NO era el problema** — la arquitectura sí. Con tools deterministas, `gpt-4o-mini` iguala la accuracy de `gpt-4o` a 1/22 del costo.
2. **No post-output validator** — descartamos el spec del architect (50 líneas + parser regex + retry loop) a favor de **tool use por diseño** (el LLM consulta antes de afirmar).
3. **Sin migrar a Claude/Anthropic todavía** — el ahorro de prompt caching de Anthropic se ve a escala. En beta con 10 users no compensa el cambio de provider.
4. **Feature flag `FEATURE_CHAT_USE_TOOLS=false` por default** — rollout gradual sin redeploy. v1 (legacy) sigue vivo como fallback de 1 línea.
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

### B.5 — ¿Por qué dejamos el path v1 vivo?

Rollback: en producción Render, si v2 explota por algo no anticipado, `FEATURE_CHAT_USE_TOOLS=false` + redeploy de 30 segundos vuelve al path probado.

Costo de mantener v1: ~250 líneas de código que nadie toca. Aceptable durante el rollout (1-2 semanas). Se borra cuando v2 esté en 100% y estable por 14 días.

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

## D — Lo que dejamos pendiente (beads abiertos)

| Bead | Prio | Qué |
|---|---|---|
| `astral-0b7` | P0 | Bug A: `/me/assets` con `fileType=hd` deja profile vacío |
| `astral-bdt` | P0 | Bug B: `PUT /users/:id` admin permite escribir profile de otro user |
| `astral-m25` | P0 | Data fix manual para Daniela, Lucia, Agos, Jez, Mayra |
| `astral-typ` | P0 | Cerrar Fase 1 una vez validada en prod con cached_tokens reales |
| `astral-owv` | P1 | Cerrar Fase 2 una vez `FEATURE_CHAT_USE_TOOLS=true` validado en prod |
| `astral-aqh` | P1 | Auto-scroll del chat durante streaming (review Daniela #6) |
| `astral-7jk` | P2 | Cambiar carta sin re-subir (review Daniela #13) |
| TBD | P2 | Multi-provider abstraction (Anthropic + OpenAI swap por env var) |
| TBD | P2 | Retry con exponential backoff + parse `Retry-After` |
| TBD | P3 | Batch API para `memory_writer` (-50% costo, latencia no importa) |
| `astral-7i8` | P4 | Compaction de history — **DIFERIDO** hasta que el counter `chat_history_truncated` supere 0 por ≥7 días en prod. Mitigación intermedia: bump `CHAT_HISTORY_TURNS` de 30 → 60 (commit del 2026-05-16). Veredicto sparring+architect en sección H abajo. |

---

## E — Métricas para validar el refactor en producción

Una vez `FEATURE_CHAT_USE_TOOLS=true` por 7 días, los thresholds:

| Métrica | Target | Cómo medir |
|---|---|---|
| Cache hit rate para `chat_stream` | >0.5 | `AVG(cached_tokens / tokens_in)` desde turn 2 |
| Latencia P95 `chat_stream` | <20,000 ms | `MAX(latency_ms)` percentil 95 |
| Costo agregado semanal `chat_stream` | -40% a -70% vs baseline pre-refactor | `SUM(cost_usd)` |
| Tasa de feedback negativo HD | 0 reportes en 7 días | `chat_messages.feedback_thumb='down'` + revisión manual de `feedback_note` |
| Smoke `npm run smoke:chat-v2 -- 5` | 5/5 sostenido en 3 corridas distintas del día | exit code |

Si todas verde por 7 días, cerrar `astral-typ` y `astral-owv`. Empezar Etapa Cleanup del legacy v1.

---

## H — Deliberación 2026-05-16: compaction de history (DIFERIDO)

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
3. Foco operativo: volver a los 4 bugs P0 (`astral-0b7`, `astral-bdt`, `astral-m25`).

**Reportes completos**: ver outputs del sparring + architect en el thread de la sesión 2026-05-16.

---

## F — Si tenés que tocar esto a futuro

1. **Antes de cambiar el system prompt**, corré `npm run smoke:chat-v2 -- 10` para tener baseline.
2. **No mezcles static y dynamic** en el system prompt — rompe OpenAI cache.
3. **No agregues content al system prompt** sin medir tokens_in antes/después. Cada KB extra son centavos al día y dólares al mes a escala.
4. **Si el LLM alucina algo verificable**, la respuesta default es **agregar un tool**, no agregar reglas al prompt. Las reglas son frágiles, los tools son determinísticos.
5. **Si v1 muere por cualquier razón**, flippeá `FEATURE_CHAT_USE_TOOLS=false` y reportá. El path v2 cubre todo lo que v1 hace.
