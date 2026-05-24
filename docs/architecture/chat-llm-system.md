# Cómo funciona el chat con LLM en Astral

**Último update**: 2026-05-24 (`astral-e2h.1`: v2 canónico, legacy eliminado).
**Audiencia**: PMs, founders, engineers nuevos al proyecto.
**Objetivo**: entender qué pasa cada vez que una usuaria manda un mensaje al chat, dónde gastamos tokens, qué cacheamos, y por qué.

---

## TL;DR

El chat de Astral mezcla 3 cosas para responder:

1. **Knowledge HD curado** (qué significa cada centro, tipo, perfil — interpretativo).
2. **Datos canónicos verificables** (qué puerta forma qué canal, qué centro tiene qué puerta — tabla cerrada).
3. **Contexto del usuario** (su perfil HD, su intake de negocio, su memoria persistente, los tránsitos de la semana).

El LLM **lee** lo curado, **consulta** los datos canónicos vía tools (no los recuerda), y **aterriza** todo en el contexto del usuario para responder. El historial de la conversación se trunca a los últimos 60 mensajes — el resto vive como memoria estructurada (`users.memory_md`) que se actualiza después de cada turn.

Default actual: `gpt-4o-mini` vía Vercel AI SDK + tools HD. El legacy fetch directo y `FEATURE_CHAT_USE_TOOLS` ya no existen.

---

## A — Flujo del primer mensaje (turn 1)

```
┌─────────────────────────────────────────────────────────────────────┐
│  USUARIA                                                             │
│  "qué me dice mi luna nueva del 16 de mayo"                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  POST /api/chat/stream
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND — capa de orquestación (routes/chat.ts)                     │
│                                                                       │
│  1. Auth + rate limit + carga datos del user de DB:                  │
│     • users.profile        (perfil HD)                               │
│     • users.intake         (negocio/objetivo)                        │
│     • users.memory_md      (Living Document)                         │
│                                                                       │
│  2. Calcula determinístico (NO LLM):                                 │
│     • Tránsitos de la semana (Swiss Ephemeris WASM)                  │
│     • analyzeTransitImpact() → canales/centros activados             │
│                                                                       │
│  3. Trunca historial a últimos 60 mensajes (CHAT_HISTORY_TURNS)      │
│                                                                       │
│  4. Ejecuta el agente canónico:                                      │
│     agent-service-v2.ts (Vercel AI SDK + tools HD deterministas)     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AGENT v2 — agent-service-v2.ts + agent-service-v2-prompt.ts         │
│                                                                       │
│  ARMA EL SYSTEM PROMPT (~33K chars = ~10K tokens):                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────┐            │
│  │ [BLOQUE ESTÁTICO — ~8K tokens]   ← se cachea        │            │
│  │   1. Rol + objetivo                                  │            │
│  │   2. INSTRUCCIÓN OBLIGATORIA: "usá tools antes      │            │
│  │      de afirmar puerta/canal/centro"                 │            │
│  │   3. Filosofía + tono + reglas                       │            │
│  │   4. HD_CONDENSED (sin tabla canales — ahora tool)  │            │
│  │   5. BUSINESS_PACK_V1                                │            │
│  │   6. 9 detection rules                               │            │
│  │   7. Formato salida (reporte semanal)                │            │
│  └─────────────────────────────────────────────────────┘            │
│  ┌─────────────────────────────────────────────────────┐            │
│  │ [BLOQUE DINÁMICO — ~2K tokens] ← varía por user      │            │
│  │   8. <user_profile> (su HD)                          │            │
│  │   9. <business_context> (intake)                     │            │
│  │  10. <user_memory> (memory_md)                       │            │
│  │  11. <transits> (semana actual)                      │            │
│  │  12. <impact> (cruce HD × transits)                  │            │
│  └─────────────────────────────────────────────────────┘            │
│                                                                       │
│  REGISTRA 5 TOOLS (Zod schemas + descriptions):                      │
│    • findChannelByGates(a, b)  → canal que une dos puertas o null    │
│    • findChannelsByGate(g)     → lista canales con esa puerta        │
│    • findChannelById(id)       → canal por id ("1-8")                │
│    • getCenterForGate(g)       → centro al que pertenece la puerta   │
│    • listAllChannels()         → tabla completa                      │
│                                                                       │
│  Llama a streamText({                                                │
│    model: openai(CHAT_MODEL),    ← gpt-4o-mini por default           │
│    system: <prompt 10K tokens>,                                      │
│    messages: [...history (últimos 60), { user: "qué luna..." }],    │
│    tools: hdTools,                                                   │
│    stopWhen: stepCountIs(5)      ← max 5 iteraciones agentic loop   │
│  })                                                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OpenAI GPT-4o-mini — loop agentic (multi-step si hace falta)        │
│                                                                       │
│  Step 1: lee el prompt + historial. Decide si necesita tools.        │
│                                                                       │
│  Si pregunta toca puertas/canales/centros:                           │
│    → emite tool_call: findChannelsByGate({gate: 8})                  │
│    → backend ejecuta la función pura, devuelve [{id: "1-8", ...}]    │
│    → step 2: LLM recibe el resultado, ahora SABE la verdad           │
│                                                                       │
│  Step final: genera texto streaming token a token                    │
│  (chunks salen al frontend vía SSE)                                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND — post-stream                                               │
│                                                                       │
│  1. Persistir user msg + assistant msg en chat_messages              │
│  2. Persistir llm_calls con: tokens_in/out, cached_tokens,           │
│     tool_calls_count/json, context_breakdown_json, cost_usd,         │
│     latency_ms                                                       │
│  3. Disparar memory_writer (fire-and-forget):                        │
│     gpt-4o-mini extrae hechos del turn, mergea en users.memory_md    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼ SSE
                          USUARIA recibe respuesta
```

---

## B — Flujo del turn N (donde se ven los ahorros)

```
╔═══════════════════════════════════════════════════════════════════╗
║  TURN 2+ (usuaria responde algo después de la primera respuesta)   ║
╚═══════════════════════════════════════════════════════════════════╝

  USUARIA: "ok y cómo aprovecho eso?"
                              │
                              ▼
  ┌────────────────────────────────────────────────────────────────┐
  │ BACKEND rebuilds el system prompt                               │
  │   • Bloque ESTÁTICO (8K tokens): IDÉNTICO al turn 1            │
  │     ← OpenAI lo detecta y lo trae del cache (50% off input)    │
  │   • Bloque DINÁMICO (2K tokens): puede haber cambiado un poco  │
  │     (memory_md updated, transits iguales si misma semana)      │
  │                                                                  │
  │   messages: [                                                    │
  │     system: <10K tokens, mayoría cacheado>,                     │
  │     ...últimos 60 msgs (truncated, ~6-10K tokens history),      │
  │     { user: "ok y cómo aprovecho eso?" }                        │
  │   ]                                                              │
  │                                                                  │
  │   TOTAL ENVIADO: ~14K tokens                                    │
  │   COSTO REAL (con cache hit): ~$0.0011/turn                     │
  │                              vs ~$0.0018 sin cache              │
  └────────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────┐
  │ Telemetría en llm_calls:                                        │
  │   tokens_in:     10,000                                         │
  │   cached_tokens:  8,000    ← cache HIT del bloque static       │
  │   tokens_out:       600                                         │
  │   tool_calls_count:   1    ← compliance anti-alucinación         │
  │   cost_usd:        0.0011                                       │
  │   cache_hit_rate:    0.8   ← lo que vamos a observar en prod   │
  └────────────────────────────────────────────────────────────────┘

  CRECIMIENTO DEL HISTORIAL:
  ────────────────────────────────────────────────────────────
  Turn 1: ~14K tokens total
  Turn 5: ~14K tokens total (history truncado a 30)
  Turn 30: ~14K tokens total (history sigue truncado a 30)
  ↑ memory_md preserva los hechos clave; mensajes viejos
    se cortan sin perder identidad/contexto del user
```

---

## C — Las capas de abstracción

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 5 — UX (frontend React)                                    │
│  Streaming SSE; chunks aparecen en pantalla                     │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4 — Orquestación (routes/chat.ts)                          │
│  Auth · Rate limit · Truncate history · Routing por flag         │
│  Persistencia · Memory writer fire-and-forget                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3 — Agent (agent-service-v2.ts)                            │
│  Vercel AI SDK · streamText/generateText · stopWhen 5 steps     │
│  Mapping de usage (tokens + cache) a LlmUsage interno            │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2 — Knowledge + Tools                                      │
│   ── System prompt (estático) ──────────────                     │
│      Rol · Filosofía · HD_CONDENSED · BUSINESS_PACK              │
│      9 detection rules · Formato salida                          │
│   ── User context (dinámico) ───────────────                     │
│      Profile · Intake · Memory · Transits · Impact               │
│   ── Tools deterministas ───────────────────                     │
│      hdTools (5) sobre HD_CHANNELS_FULL y GATE_TO_CENTER         │
│   ── Memory layer ──────────────────────────                     │
│      users.memory_md (Living Document tipo Mem0)                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1 — Datos canónicos                                        │
│  HD_CHANNELS_FULL (36 canales) · GATE_TO_CENTER (64→9)          │
│  Swiss Ephemeris WASM (tránsitos) · DB SQLite                    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 0 — Modelo (OpenAI gpt-4o-mini por default, env var)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## D — Antes vs Ahora (mismo input, lo que cambió)

|  | ANTES (Daniela 2026-05-15) | AHORA (post refactor) |
|---|---|---|
| Modelo | gpt-4o-mini hardcoded | env var (default mini) |
| Knowledge HD | inline 11K tokens fijos | tools que se consultan |
| Tabla canales | inline en prompt | tool `findChannelByGates` |
| Cache OpenAI | roto (static+dynamic mix) | activo (orden fijo) |
| Historial enviado | completo (crece lineal) | últimos 60 (constante) |
| Memory | `memory_md` (correcto) | `memory_md` (igual) |
| Anti-alucinación | nada | 5 tools + regla obligatoria |
| Validación HD | el LLM se acuerda mal | consulta tabla canónica |
| Accuracy (Puerta 8) | 0% en prod, 40% en test | 100% en test (5/5) |
| Costo / turn | ~$0.0024 | ~$0.0011 (con cache) |
| Telemetría cache | no medíamos | `cached_tokens` en DB |
| Rollback | git revert | 1 var de Render |

---

## E — Checklist contra industria 2026

Sintetizado de los reports de los sub-agents que tiramos durante el refactor.
Fuentes detalladas en `docs/research/2026-05-*.md`.

| Práctica recomendada 2026 | Astral hoy | Comentario |
|---|---|---|
| **Layered prompt** (rol → knowledge → tools → user → history → query) | ✅ | Orden exacto en `buildSystemPromptV2` |
| **Static prefix estable** para activar prompt cache | ✅ | Reordenado en Fase 1 |
| **Prompt cache headers** (Anthropic explícito) | N/A | Usamos OpenAI (cache automático) |
| **Tools deterministas para data verificable** | ✅ | 5 HD tools registradas |
| **Tool use por instrucción** ("DEBES llamar...") | ✅ | Sección obligatoria al inicio del prompt |
| **Tool choice = 'required'** (forzar SIEMPRE tool calls) | ❌ | Híbrido por instrucción funciona |
| **Structured outputs (Zod)** para steps internos | ⚠️ | Los inputs de tools sí (Zod). El output final es texto natural |
| **Memory pattern Mem0** (Living Document) | ✅ | `users.memory_md` desde antes |
| **Sliding window de history** (30 turns) | ✅ | `CHAT_HISTORY_TURNS=60` (~30 pares) |
| **Compaction de history viejo** | ⚠️ | No comprimimos historial viejo. Lo cortamos. Memory_md compensa |
| **Threads / `conversation_id`** | ❌ | Aún no. Decidido prematuro en beta (<10 users) |
| **Multi-provider abstraction** (Anthropic + OpenAI) | ⚠️ | Vercel AI SDK lo permite con 1 línea, no lo usamos hoy |
| **Retry con exponential backoff** | ❌ | Falla de OpenAI propaga hoy |
| **Batch API para tareas async** (memory writer) | ❌ | Memory writer corre síncrono fire-and-forget |
| **Streaming SSE** | ✅ | Mantenido en v2 |
| **Cost telemetry per route** | ✅ | `llm_calls` con `cached_tokens` persistido |
| **Feature flag para rollback sin redeploy** | ❌ | Eliminado por decisión founder en `astral-e2h.1` |

**Veredicto**: ~85% del estado del arte 2026 para una app pequeña en beta. Las gaps están todas trackeadas como beads.

---

## F — Archivos clave

| Capa | Archivo | Qué hace |
|---|---|---|
| Orquestación | `backend/src/routes/chat.ts` | Recibe HTTP y delega en `services/guide-service.ts` |
| Agent v2 | `backend/src/agent-service-v2.ts` | Wrapper sobre Vercel AI SDK con HD tools |
| Prompt builder v2 | `backend/src/agent-service-v2-prompt.ts` | Arma el system prompt con orden cache-friendly |
| Tipos compartidos | `backend/src/types/agent.ts` | `UserProfile`, mensajes y metadata de agente |
| Config LLM | `backend/src/llm/model-config.ts` | `CHAT_MODEL` + hash de prompt |
| Context budget | `backend/src/llm/context-budget.ts` | Estima tokens por bloque + shape de `/me/chat/context-budget` |
| Helpers compartidos | `backend/src/agent-prompt-helpers.ts` | `buildBusinessContextBlock`, `buildUserMemoryBlock` |
| Tools | `backend/src/hd-tools/index.ts` | 5 HD tools con Zod schemas |
| Datos canónicos | `backend/src/hd-channels.ts` | 36 canales + helpers |
| Datos canónicos | `backend/src/hd-gates.ts` | `GATE_TO_CENTER` (64→9) |
| Knowledge | `backend/src/knowledge/hd-condensed.ts` | HD interpretativo (tipos, perfil, centros, variables) |
| Knowledge | `backend/src/knowledge/business-pack-v1.ts` | Advisory pack para mentoras |
| Knowledge | `backend/src/knowledge/detection-rules.ts` | 13 reglas (v1) / 9 (v2) anti-alucinación |
| Memory | `backend/src/memory-writer.ts` | Living Document writer (gpt-4o-mini, fire-and-forget) |
| Tránsitos | `backend/src/transit-service.ts` | Swiss Ephemeris + `analyzeTransitImpact` |
| Flags | `backend/src/config/flags.ts` | Flags restantes (`FEATURE_REMOTE_MCP`, memory, telemetry, intake) |

---

## G — Cómo cambiar el modelo sin redeploy de código

Desde el dashboard de Render, editar la env var:

| Variable | Default | Cambiar para... |
|---|---|---|
| `CHAT_MODEL` | `gpt-4o-mini` | Probar `gpt-4o` (más calidad, 17x costo) o futuro Claude |
| `MEMORY_WRITER_MODEL` | `gpt-4o-mini` | Mantener mini casi siempre (escribe markdown, no critical) |
| `REPORT_MODEL` | `gpt-4o-mini` | Subir si las usuarias piden mejor reporte |
| `EXTRACTION_MODEL` | `gpt-4o` | **Fallback Vision only**. El flujo real (PDF de MyHumanDesign / Genetic Matrix) es 100% determinístico vía `pdfjs-dist` + parser custom — no usa LLM. Esta var existe por si llega un asset legacy / no-PDF |
| `CHAT_HISTORY_TURNS` | `60` | Bajar si los costos suben; reabrir compaction si hay quejas de "no se acuerda" |

Cualquier cambio requiere redeploy de Render (pero NO de código).

---

## H — Context budget en tiempo real

`GET /api/me/chat/context-budget` devuelve el estado actual del contexto de chat
para la usuaria autenticada. El endpoint recompone el mismo prompt por bloques
que usa el agente, estima tokens con `js-tiktoken` (`o200k_base`) y devuelve:
`used`, `limit`, `percentUsed`, `breakdown` (`system`, `memory`, `history`,
`tools`, `response`) y `blocks` canónicos.

La telemetría post-call guarda el snapshot completo en
`llm_calls.context_breakdown_json`, incluyendo calibración contra los tokens
reales reportados por el provider. `cached_tokens` reduce costo/latencia, pero
no reduce uso de context window.

---

## I — Qué medir en producción

```sql
-- Cache hit rate por route (últimos 7 días)
SELECT route, COUNT(*) calls,
       AVG(tokens_in) avg_in,
       AVG(cached_tokens) avg_cached,
       AVG(CAST(cached_tokens AS REAL) / NULLIF(tokens_in, 0)) cache_hit_rate,
       AVG(latency_ms) avg_latency_ms,
       SUM(cost_usd) total_cost_usd
FROM llm_calls
WHERE created_at > datetime('now', '-7 day')
GROUP BY route;
```

Target del path canónico con tools:
- `cache_hit_rate` para `chat_stream`: > 0.5 (turn 2+)
- `avg_latency_ms` para `chat_stream`: < 20,000 ms (incluyendo 1-2 tool calls)
- `total_cost_usd` semanal: -40% a -70% vs baseline pre-tools

---

## J — Para profundizar

- **Research de industria** (mayo 2026): `docs/research/2026-05-*.md`
- **Decisiones técnicas del refactor**: `docs/architecture/refactor-2026-05-decisions.md`
- **Caso de origen del bug**: `docs/architecture/bug-investigation-daniela-2026-05.md`
- **Plan de roll-out v2**: `docs/chat-v2-rollout.md`
- **Referencia técnica HD**: `docs/human-design-reference.md`
