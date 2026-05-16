# UX patterns para rate limits y fallos LLM — 2026

**Investigación**: sub-agent multi-source (ChatGPT, Claude.ai, Cursor, Perplexity, Gemini, UX Content Collective, hermes-agent issues).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta "si el chat falla por rate limit, ¿cómo lo comunicamos a la usuaria sin frustrarla?"

---

## 1. Mensajes exactos en apps populares

**ChatGPT (chat.openai.com)** — varía según el límite:
- "You've reached our limit of messages per hour. Please try again later."
- "You've reached our limit of messages per 24 hours. Please try again later."
- "You've reached your GPT-5 limit." (model-specific)
- "You've hit the free plan limit for GPT-4o." con CTA "Switch to GPT-4o mini" o "Upgrade to Plus"
- Errores transitorios: "Hmm…something seems to have gone wrong." y "Something went wrong. Please try again later." Botón "Regenerate response" al lado del mensaje fallido.

**Claude.ai** — pantalla con copy: "You've reached your usage limit" / "You've hit your limit for Claude messages. Please wait before trying again." Acompañado de **hora de reset explícita** ("Your limit will reset at 3pm") porque opera en ventana móvil de 5 hs, no diaria. CTA: esperar o "Upgrade plan".

**Cursor** — UX cuestionada por la comunidad: "We've hit a rate limit with the provider. Please…" o "You've hit the rate limit on this model." **No tiene contador previo** — el usuario se entera al ser bloqueado. Sugiere cambiar de modelo manualmente.

**Perplexity** — los Pro searches limitados degradan silenciosamente al modelo base (Sonar). No banner explícito; el sistema **falla en cascada** hacia el modelo gratis. Para errores de infra usa "Unable to search" y se autoresuelve en 1–2 minutos.

**Google AI Studio / Gemini** — "You've reached your rate limit. Please try again later."

**GitLab Duo Chat** — referencia citada por UX writers: "I'm sorry, I couldn't respond in time. Please try a more specific request or enter /clear to start a new chat." (tono empático + acción concreta).

## 2. Patrones que se repiten

- **Reset time explícito gana**: Claude muestra hora, ChatGPT solo dice "later" y genera fricción documentada en foros.
- **CTA secundario "downgrade"**: ChatGPT y Perplexity ofrecen modelo más chico en vez de bloquear. Patrón clave para Astral con fallback gpt-4o → gpt-4o-mini si en el futuro escalamos a 4o.
- **Botón "Regenerate"** después de un fallo es estándar — el usuario no reescribe.
- **Tono**: apps con audiencia técnica (Cursor, AI Studio) usan jerga "rate limit"; apps mainstream (ChatGPT, Claude) lo evitan y dicen "limit of messages" o "usage limit". Para mentoras/coaches (audiencia Astral), **evitar "rate limit"** literal.

## 3. Retry transparente vs visible

Consenso (UX Content Collective, blogs de infra LLM):

- **Transparente (sin avisar)**: errores transitorios <2s, exponential backoff 1s/2s/4s, fallo único del provider. ChatGPT/Claude reintentan internamente sin mostrar nada.
- **Visible**: espera >3s, fallback a otro modelo (debe avisarse: "Respondiendo con un modelo más liviano"), 3+ reintentos fallidos.

## 4. Streaming: abrir vs mid-stream

- **Falla al abrir el stream** (429 antes del primer token): tratar como request normal fallido, mostrar error inline en la burbuja del asistente vacía, ofrecer "Reintentar".
- **Falla mid-stream**: práctica observada en ChatGPT/Claude — **conservar el texto parcial ya renderizado**, agregar un footer discreto "La respuesta se interrumpió" + botón "Continuar"/"Reintentar". Descartar todo es la peor opción (issue documentado en anything-llm, opencode).
- Hermes y otros agentes documentan el anti-patrón: no dejar mensajes de retry acumulados en el thread tras un éxito.

## 5. Recomendaciones para Astral (español neutro/argentino cálido)

"Esperá X segundos antes de enviar otro mensaje" es correcto pero seco. Alternativas más alineadas con el tono cosmos/mentoría:

- **429 antes de empezar**: "Estamos recibiendo muchos mensajes en este momento. Probá de nuevo en {X} segundos." + botón "Reintentar". **Evitar "rate limit"**.
- **Fallback a gpt-4o-mini** (si se implementa cascada futura): no mostrar nada, o un sutil "Respondiendo con una versión más rápida" para no romper expectativas.
- **Mid-stream cut**: conservar lo escrito + footer en gris: "La respuesta se cortó. ¿Querés que continúe?" con botón "Continuar".
- **Falla persistente (3 reintentos)**: "Algo no salió como esperábamos. Probá de nuevo en un ratito." + "Reintentar". Tono empático, sin culpa al usuario, sin tecnicismos.
- **Cuándo retry silencioso**: 1er fallo <2s, error 502/503/timeout corto.
- **Cuándo mostrar**: 429 con `retry-after`, fallo de extracción Vision, mid-stream con >50% del texto perdido.

Regla de oro de UX Content Collective: di **qué pasó** (1 frase) + **qué puede hacer la persona** (1 acción clara), sin jerga ni traceback. Para audiencia no-técnica: nunca exponer "rate limit", "429", "token", "model". Sí: "mensaje", "respuesta", "intentar de nuevo".

## 6. Aplicación a Astral (estado actual + pendiente)

**Estado actual** (sin retry implementado): un 429 de OpenAI propaga al frontend como error HTTP. El usuario ve "Error al generar respuesta" sin detalle. UX pobre, no llega a producir pérdida porque el volumen es chico.

**Plan futuro** (cuando se implemente retry — bead `astral-???-retry`):
- Retry silencioso para fallas <2s + max 2 attempts.
- Si excede, mensaje empático en español: "Estamos recibiendo muchos mensajes en este momento. Probá de nuevo en X segundos." (parsear `Retry-After` del 429).
- Si mid-stream se corta: conservar texto + botón "Continuar".

## Fuentes

- [ChatGPT prompts "You've reached our limit of messages per hour" — OpenAI Community](https://community.openai.com/t/chatgpt-prompts-youve-reached-our-limit-of-messages-per-hour-please-try-again-later/206307)
- [Rate Limit "per 24 hours" — OpenAI Community](https://community.openai.com/t/rate-limit-youve-reached-our-limit-of-messages-per-24-hours-please-try-again-later/345536)
- [ChatGPT Limits Explained — Merlio](https://merlio.app/blog/chatgpt-limits-explained-why-you-see-you-ve-hit-your-limit)
- [You've hit your limit for Claude messages — RemoteOpenClaw](https://www.remoteopenclaw.com/blog/youve-hit-your-limit-for-claude-messages-please-wait-before-trying-again)
- [How do usage and length limits work? — Claude Help Center](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work)
- [Cursor "hit rate limit on this model" — Cursor Forum](https://forum.cursor.com/t/cursor-shows-unlimited-access-to-claude-4-sonnet-but-i-hit-a-rate-limit-error-after-just-two-prompt-uses/109014)
- [Constantly rate limited Sonnet/GPT-4o — Cursor Forum](https://forum.cursor.com/t/constantly-rate-limited-using-sonnet-3-5-gpt-4o/58133)
- [Perplexity AI Not Working — TechSifted](https://techsifted.com/guides/perplexity-ai-not-working/)
- [Google AI Studio "You've reached your rate limit"](https://discuss.ai.google.dev/t/youve-reached-your-rate-limit-please-try-again-later-i-need-help-to-fix-this/111823)
- [How to Build LLM Streams That Survive Reconnects — Upstash](https://upstash.com/blog/resumable-llm-streams)
- [Resumable LLM streaming — Stardrift Blog](https://stardrift.ai/blog/streaming-resumptions)
- [How to write error messages — UX Content Collective](https://uxcontent.com/how-to-write-error-messages/)
- [AI Chat UI Best Practices — thefrontkit](https://thefrontkit.com/blogs/ai-chat-ui-best-practices)
- [GitLab Duo Chat troubleshooting](https://docs.gitlab.com/user/gitlab_duo_chat/troubleshooting/)
- [HTTP 429 explained — HubSpot](https://blog.hubspot.com/website/http-error-429)
