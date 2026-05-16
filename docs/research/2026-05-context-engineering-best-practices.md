# Context Engineering — mejores prácticas 2026

**Investigación**: sub-agent multi-source (Anthropic docs, OpenAI docs, Mem0, blogs técnicos).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta operativa "¿estamos siguiendo las recomendaciones de la industria?"

---

## 1. Anthropic Prompt Caching (explícito)

- **Hasta 4 breakpoints** vía `cache_control: { type: "ephemeral" }`. TTL default **5 min**, opcional **1h** (escritura 2x base).
- **Pricing**: cache write 5min = **1.25x** input base, write 1h = **2x**, **cache read = 0.1x** (90% off).
- **Mínimo cacheable**: Sonnet 4.6 = **1,024 tokens**; Opus 4.7 y **Haiku 4.5 = 4,096 tokens**. Bajo el umbral no cachea silenciosamente.
- **Orden fijo**: `tools → system → messages`. Cualquier cambio invalida ese nivel y todos los posteriores.
- **Regla maestra**: el breakpoint va en el **último bloque idéntico entre requests**. System debe estructurarse como `system: [ {static + cache_control}, {dynamic} ]` — NO concatenar como string único.
- **Lookback de 20 bloques**: en historiales largos hay que poner breakpoints periódicos para evitar perder el cache write.
- Verificación: `usage.cache_read_input_tokens` y `usage.cache_creation_input_tokens`.

## 2. OpenAI Prompt Caching (automático)

- **Activa solo >1,024 tokens** de prefijo estable, en incrementos de **128 tokens**. Sin código adicional, sin headers.
- **Descuento**: hasta **90% en input** + 80% menos latencia. Sin costo extra de write.
- **TTL**: 5-10 min de inactividad, máximo **1 hora** (extended retention en modelos nuevos hasta 24h, no aplica a `gpt-4o-mini`).
- **Soporta gpt-4o y posteriores** (`gpt-4o-mini` incluido).
- Detección: `usage.prompt_tokens_details.cached_tokens`.
- **Regla**: estático al inicio, variable al final. Cualquier byte distinto en el prefijo = cache miss total.

## 3. Comparación Anthropic vs OpenAI

| Eje | Anthropic | OpenAI gpt-4o-mini |
|---|---|---|
| Activación | Explícita (`cache_control`) | Automática |
| Mínimo | 1,024 / 4,096 según modelo | 1,024 tokens |
| Breakpoints | Hasta 4 | 1 (prefijo automático) |
| TTL | 5min / 1h | 5-10 min (max 1h) |
| Costo read | 0.1x (90% off) | ~0.5x (50% off típico en gpt-4o-mini) |
| Costo write | 1.25x | Sin recargo |
| Multi-segmento dinámico | Soporta (4 cortes) | No — un solo prefijo |

## 4. Layered Context Pattern (consenso Anthropic + OpenAI)

Orden óptimo para cache + comprensión:

1. **Role / instructions** (static, top — primacy bias)
2. **Knowledge denso** (static)
3. **Tools** (si hay)
4. **User profile / memoria persistente** (semi-static, cambia en sesiones, no por turn)
5. **Per-turn dynamic** (transits, fecha, intake) — **AL FINAL del system o como primer message**
6. **Historial**
7. **Query actual** (recency bias)

Anthropic en *Effective Context Engineering* (Sep 2025) lo dice explícito: separar guía estática del runtime context; usar XML/Markdown headers; evitar "bloated prompts".

## 5. Lost-in-the-Middle (vigente 2026)

U-shape confirmado en gpt-4o y Claude Sonnet 4.x. **30%+ caída de accuracy** cuando info clave queda en el medio de contextos largos. Mitigación: knowledge crítico al inicio Y un eco corto al final, query del usuario siempre último.

## 6. Memory Patterns — Veredicto

| Patrón | Pros | Contras |
|---|---|---|
| **Full history** (Astral hoy antes del refactor) | Fidelidad total | Lineal, rompe cache, context rot |
| **Summary buffer** | Simple, bounded | Pierde detalle, summarizer cuesta tokens |
| **Mem0 / living memory** | 80-90% menos tokens, 92.5 LoCoMo | Infra extra, retrieval logic |
| **Compaction (Anthropic)** | Recomendado oficialmente | Requiere trigger por threshold |

Estándar 2026 para chats personalizados: **memoria persistida fuera de contexto + retrieval selectivo + compaction al acercarse al límite**.

## 7. Anti-patterns identificados en Astral (antes del refactor)

1. **System prompt monolítico** (11K static + 3-4K dynamic concatenados) → cache OpenAI rompe en cada turn porque dynamic está mezclado entre static.
2. **Rebuild por turn** sin separar capas.
3. **Historial sin truncation** → context rot y costo lineal creciente.
4. **Sin verificación** de `cached_tokens` en responses.

## 8. Veredicto operativo para Astral (post-refactor)

**Quick wins implementados** (sin cambiar modelo, sigue gpt-4o-mini):
1. ✅ Reordenado el string: 11K static al inicio absoluto, luego user_profile, intake/memory_md/transits/impact al final del system message, después historial, después query. Activa cache automático de OpenAI inmediatamente.
2. ✅ Logging de `usage.prompt_tokens_details.cached_tokens` para validar.
3. ⚠️ **Pendiente**: compaction de historial cuando >N mensajes (hoy cortamos, no comprimimos).
4. ⚠️ **Pendiente**: mover `memory_md` a un store retrievable (Mem0-style) cuando escale (hoy se inyecta full en el prompt — funciona porque memory_md tiene ~2KB).

**Si migran a Anthropic Sonnet 4.6**: ganan 4 breakpoints y 90% off en reads, pero requiere refactor a `system: [bloques]` con `cache_control` explícito. Pendiente como bead `multi-provider abstraction`.

## Fuentes

- [Anthropic — Prompt Caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic — Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [OpenAI — Prompt Caching Guide](https://developers.openai.com/api/docs/guides/prompt-caching)
- [OpenAI — Prompt Caching 201 Cookbook](https://developers.openai.com/cookbook/examples/prompt_caching_201)
- [Lost in the Middle — Liu et al.](https://arxiv.org/abs/2307.03172)
- [Mem0 — State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026)
- [Mem0 — Token-Efficient Memory Algorithm](https://mem0.ai/blog/mem0-the-token-efficient-memory-algorithm)
- [PromptHub — Caching comparison OpenAI/Anthropic/Google](https://www.prompthub.us/blog/prompt-caching-with-openai-anthropic-and-google-models)
