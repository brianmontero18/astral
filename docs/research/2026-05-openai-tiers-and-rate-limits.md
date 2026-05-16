# OpenAI Tiers & Rate Limits — investigación 2026

**Investigación**: sub-agent multi-source (OpenAI docs, Inference.net guides, TokenMix, ScriptbyAI).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta operativa "estamos en Tier 1 con TPM 30K para gpt-4o, ¿cómo escalamos?"

---

## 1. Tabla de tiers (qualification + límites gpt-4o)

| Tier | Pago mínimo acumulado | Espera desde primer pago | gpt-4o (TPM / RPM / RPD) | gpt-4o-mini (TPM / RPM) |
|------|----------------------|--------------------------|---------------------------|--------------------------|
| Free | $0 | — | no aplica gpt-4o | limitado |
| **Tier 1** | **$5** | inmediato | **30K / 500 / 10K** | 200K / 500 |
| Tier 2 | $50 | 7+ días | ~450K / 5K | 2M / 5K |
| Tier 3 | $100 | 7+ días | ~800K / 5K | 4M / 5K |
| Tier 4 | $250 | 14+ días | ~2M / 10K | 10M / 10K |
| **Tier 5** | **$1,000** | **30+ días** | **~800K-30M / 10K** | 150M / 30K |

Total mínimo para llegar a Tier 5: **~58 días calendario** desde el primer pago (no se puede saltear con un solo pago grande — es anti-fraude).

**Advertencia de inconsistencia**: las fuentes de terceros dan números levemente distintos para Tier 2-4 (algunas citan 450K TPM gpt-4o en Tier 2, otras 800K). Los oficiales de OpenAI hay que verificarlos en `platform.openai.com/settings/organization/limits` con la cuenta logueada — esa página no es accesible por scraping.

## 2. gpt-4o vs versiones específicas

**No hay diferencias** de rate limit entre `gpt-4o` (alias) y snapshots como `gpt-4o-2024-08-06`. Comparten el mismo pool por modelo-family. `gpt-4o-mini` sí tiene pool separado con **~10x más TPM** que `gpt-4o` en cualquier tier.

## 3. Precios standard (por 1M tokens, mayo 2026)

| Modelo | Input | Cached input | Output |
|---|---|---|---|
| gpt-4o | $2.50 | $1.25 | $10.00 |
| gpt-4o-mini | $0.15 | $0.075 | $0.60 |
| gpt-4.1 | ~$2.00 | — | ~$8.00 |

Para el caso de Astral (10K input + 750 output con gpt-4o): **~$0.0325 por request**. A 3 req/min sostenido = ~$5.85/hora si la beta corre saturada.

## 4. Opciones para mitigar rate limit en beta

- **Batch API**: -50% en input/output, ventana 24h, **pool de rate limit separado** del síncrono. Inútil para chat en vivo, pero perfecto para generar reportes semanales pre-computados o memory_writer async.
- **Flex tier**: -50% precio, latencia variable, modelos selectos. No documentado oficialmente para gpt-4o en Tier 1.
- **Priority Processing**: 2x-5x precio, latencia más baja y consistente. No resuelve rate limit, solo latencia.
- **Prompt caching automático**: cached input 50% más barato. Para el system prompt de 10K de Astral que se repite — esto es el mayor ahorro real. Funciona automáticamente si el prefijo se mantiene idéntico entre requests.

## 5. Monitoreo runtime

Headers en cada response (no requieren dashboard):

- `x-ratelimit-limit-requests` / `x-ratelimit-limit-tokens`
- `x-ratelimit-remaining-requests` / `x-ratelimit-remaining-tokens`
- `x-ratelimit-reset-requests` / `x-ratelimit-reset-tokens`

Dashboard: `platform.openai.com/usage` y `platform.openai.com/settings/organization/limits`.

## 6. Recomendación accionable para Astral

1. **Cargá $50** para activar el cronómetro de 7 días hacia Tier 2 (gpt-4o pasa de 30K → ~450K TPM, 15x más capacidad). Solo necesario si decidís usar gpt-4o para chat.
2. **Activá prompt caching** asegurando que el system prompt vaya como prefijo idéntico — bajás input cost de $2.50 → $1.25 por 1M. ✅ Hecho en Fase 1 del refactor.
3. **Considerá gpt-4o-mini** para tier 1 mientras escalás: 200K TPM ya (~6x más chats/min) y 17x más barato. Para chat de tránsitos puede ser suficiente. ✅ Default actual en Astral.
4. **Pre-generá reportes semanales con Batch API** (-50%) en lugar de chat en vivo cuando se pueda. **Pendiente como bead** (memory_writer también puede beneficiarse).

## Fuentes

- [Rate limits | OpenAI API (developers.openai.com)](https://developers.openai.com/api/docs/guides/rate-limits)
- [Pricing | OpenAI API (developers.openai.com)](https://developers.openai.com/api/docs/pricing)
- [Inference.net OpenAI Rate Limits Guide 2026](https://inference.net/content/openai-rate-limits-guide/)
- [TokenMix Batch API Pricing 2026](https://tokenmix.ai/blog/openai-batch-api-pricing)
- [ScriptbyAI Rate Limits 2026](https://www.scriptbyai.com/rate-limits-openai-api/)

**Caveats**: `platform.openai.com` y `openai.com/pricing` devolvieron 403 a scraping. Los números exactos de TPM/RPM por tier para Tier 2-4 vienen de agregadores de terceros con leves discrepancias. **Para confirmar los límites de la org real**: logueate y revisá `platform.openai.com/settings/organization/limits` — es la única fuente autoritativa.
