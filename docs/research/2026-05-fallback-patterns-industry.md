# Fallback chains y resiliencia LLM en producción — 2026

**Investigación**: sub-agent multi-source (Vercel AI SDK, Cursor architecture, Perplexity, Portkey, blogs técnicos).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta "¿qué hacen las empresas con rate limits/outages? ¿Deberíamos meter fallback chain?"

---

## 1. Fallback chains — qué hacen realmente

**Patrón dominante: misma familia primero, otro provider después.** El ejemplo canónico citado en docs y blogs de producción:

```
Claude Sonnet (primary) → Claude Haiku (cheap, same provider) → GPT-4o (other provider) → local model
```

- **Cursor** (70M+ req/día) opera con un "Model Selection Router" y soporta auto-mode con tiers `frugal/balanced/premium`. Usan integraciones tipo Portkey para load-balance OpenAI ↔ Anthropic. No tienen fallback "expensive→cheap" automático en el sentido clásico — el routing es por costo/calidad upfront, no por error.
- **Perplexity Computer** usa Claude Opus 4.6 como orquestador que decide cuál de 19 modelos atender: clasificador chico → Haiku (1 crédito) para queries simples, Opus (5-10 créditos) para reasoning complejo. Principio explícito: "el modelo más chico que dé buena UX".
- **Vercel AI Gateway** ofrece fallback automático declarativo via `providerOptions.gateway.models = [primary, fallback1, fallback2]`. Multi-provider nativo. Sin markup sobre tokens.

**Conclusión: multi-provider gana sobre multi-model del mismo provider** para resiliencia (un outage de OpenAI no te tira la app). Pero "expensive→cheap" del mismo provider es lo más común para *cost control*, no para uptime.

## 2. Retry: parámetros estándar

- **Backoff exponencial con jitter**: fórmula consensuada `2^attempt * random(0.5, 1.5)`, max 3-5 retries.
- **429 vs 500**: parsear `Retry-After` en 429 (rate limit) y respetarlo; `insufficient_quota` (también 429) **NO se reintenta** — es problema de billing. 5xx sí se reintenta con backoff.
- **Circuit breaker**: solo vale la pena con tráfico sostenido. Para una app en beta con 3 chats/min, está sobre-ingeniería. Se justifica recién cuando un provider caído te consume latencia y tokens en cascada.

## 3. Provider abstraction — comparación honesta para Astral

| Opción | Peso | Fricción para tu caso |
|---|---|---|
| **Vercel AI SDK + `ai-fallback`** | Ligero, zero-deps el wrapper | **~12 líneas para fallback completo**, mantiene tu streaming SSE actual |
| **Vercel AI Gateway** | Servicio externo | Cero código, declarativo, sin markup — pero agregás un hop de red |
| **LangChain.js** | Pesado, abstracción heavy | Reescribís `agent-service.ts` entero |
| **LiteLLM** | Python proxy | Mal fit para Node-only stack |

## 4. Model routing por complejidad

Patrón Perplexity/Notion: **clasificador chico al frente** que decide. Para Astral en beta con system prompt de 10K tokens denso de HD, esto NO te conviene todavía — perdés la riqueza del prompt si routeás a gpt-4o-mini sin re-engineering. El routing se justifica cuando tenés queries heterogéneas (search vs reasoning vs summarize).

## 5. Recomendación concreta para Astral

**Etapa 1 (próxima)**: mantener el OpenAI SDK actual y agregar **retry con backoff+jitter** respetando `Retry-After`. Esto solo ya elimina el 80% de los fallos transitorios en Tier 1. Bead `astral-???-retry`.

**Etapa 2 (cuando justifique)**: migrar a **Vercel AI SDK + `ai-fallback`** con esta chain:

```ts
createFallback({
  models: [openai('gpt-4o-mini'), anthropic('claude-haiku-4-5'), openai('gpt-4o')]
})
```

Razón: mantiene el streaming SSE, no nos casa con Vercel hosting, y es el wrapper más liviano que existe hoy. Anthropic como segundo eslabón nos saca del problema de TPM de OpenAI Tier 1 sin esperar el upgrade de tier. Bead `astral-???-multi-provider`.

**No meter circuit breaker ni Gateway todavía** — son overkill para 3 chats/min. El problema real de TPM 30K se resuelve más rápido subiendo a Tier 2 ($50 gastados) que rearquitectando.

## 6. Lo que Astral ya tiene a favor

- ✅ Usamos Vercel AI SDK desde el refactor 2026-05 (`agent-service-v2.ts`). El swap a multi-provider es 1 archivo.
- ✅ El `CHAT_MODEL` es env var. Cambiar provider implica cambiar también la importación del provider (no es 1 línea, pero es 5).
- ❌ Sin retry todavía. Un 429 actual de OpenAI propaga al frontend como error.

## Fuentes

- [ai-fallback (GitHub - remorses)](https://github.com/remorses/ai-fallback)
- [Vercel AI Gateway — Model Fallbacks](https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks)
- [Vercel AI Gateway pricing (sin markup)](https://vercel.com/docs/ai-gateway/pricing)
- [`ai-retry` npm — retry condicional por tipo de error](https://libraries.io/npm/ai-retry)
- [OpenAI Cookbook — How to handle rate limits](https://cookbook.openai.com/examples/how_to_handle_rate_limits)
- [OpenAI Rate Limits Guide 2026 (TPM/RPM tiers)](https://inference.net/content/openai-rate-limits-guide/)
- [Cursor architecture deep dive 2025](https://collabnix.com/cursor-ai-deep-dive-technical-architecture-advanced-features-best-practices-2025/)
- [How Perplexity Built an AI Google (ByteByteGo)](https://blog.bytebytego.com/p/how-perplexity-built-an-ai-google)
- [Portkey — Retries, fallbacks, and circuit breakers in LLM apps](https://portkey.ai/blog/retries-fallbacks-and-circuit-breakers-in-llm-apps/)
- [DEV — Stop Worrying About LLM Downtime (ai-fallback walkthrough)](https://dev.to/simplr_sh/stop-worrying-about-llm-downtime-build-resilient-ai-apps-with-ai-fallback-1bkc)
- [Maxim — Retries, Fallbacks, and Circuit Breakers in LLM Apps](https://www.getmaxim.ai/articles/retries-fallbacks-and-circuit-breakers-in-llm-apps-a-production-guide/)
- [LangChain.js fallbacks docs](https://js.langchain.com/v0.1/docs/guides/fallbacks/)
