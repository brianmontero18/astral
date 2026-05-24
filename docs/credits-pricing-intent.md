# Credits-Based Pricing — Product Intent (v2 direction)

## Status

**INTENT — NOT A CONTRACT.**

This document captures a product direction Brian wants to explore for migrating
Astral Guide away from the current "fixed messages per month" model toward a
**subscription + credits** model where consumption is proportional to depth.

It is **not** a closed spec. It exists so any session (Claude / Codex / human)
can pick up this thread and continue with:

1. levantamiento (discovery + competitive research)
2. unit-economics modeling with real `llm_calls` data
3. design of the credit-mapping rules
4. implementation plan and migration path

The current implemented contract is still
[docs/freemium-spec.md](/Users/brmontero/astral/docs/freemium-spec.md)
(Access Model v1, 2026-04-19, message-count based).

## Why this exists

A 2026-05-05 sparring session with ChatGPT (full transcript captured by Brian)
landed on a clear discomfort with the current model:

- Today a "user message" is the unit, regardless of cost.
- A `"hola"` and a deep cross-analysis of HD + business + transit + offer
  consume **the same quota**.
- That is **unfair to the user** (cheap messages "burn" quota) and
  **risky for margin** (heavy users on `basic = 120` can blow the OpenAI bill).
- Costs are dominated by the LLM (`gpt-4o`-class). Render USD 7/mo, Resend,
  Turso, auth — all on free tier or symbolic. The variable cost is tokens.

The proposed direction: **credits**, where credit consumption is mapped
internally from real token usage but exposed to the user as
"depth of reading", not as tokens.

## Proposed direction (subject to levantamiento)

### Pricing surface

| Plan | Price | Monthly credits |
|------|-------|-----------------|
| Free | USD 0 | 15 |
| Basic | USD 19 | 120 |
| Pro | USD 39 | 350 |
| Mentor / Business | USD 79 | 900 (later, not v2.0) |

These numbers are **placeholders from the sparring**. They must be re-validated
against:

- real per-user token distribution from `llm_calls`
- target gross margin per active user
- Daniela's brand positioning (price floor, perceived value)
- competitor benchmark (see "Open questions")

### Credit consumption (illustrative)

User-facing wording (no tokens exposed):

| Action | Credits |
|--------|---------|
| Saludo / typo / mensaje incompleto | 0 |
| Pregunta simple | 1 |
| Lectura breve | 2 |
| Análisis profundo | 5 |
| Reporte completo / estrategia extendida | 8–10 |

### Internal mapping (illustrative)

`tokens_total = input_tokens + output_tokens` (including system prompt, RAG
context, history window — everything billed by the provider).

| `tokens_total` | Credits |
|----------------|---------|
| 0 – 1.500 | 1 |
| 1.501 – 4.000 | 2 |
| 4.001 – 8.000 | 5 |
| 8.001 – 15.000 | 10 |

### Fairness rules (must-haves of the model)

These are non-negotiable for the credits model to feel fair:

- Mensajes < N caracteres no descuentan créditos salvo que generen respuesta sustancial.
- Errores técnicos / respuesta vacía → no descuentan créditos.
- Cancelación temprana del usuario → no descuenta créditos.
- El descuento se calcula **post-respuesta** sobre tokens reales, no a priori.

### Communication line for the UI

> "Tus créditos se consumen según la profundidad de cada lectura.
> Una pregunta simple usa menos créditos; un análisis profundo usa más.
> Los saludos, errores de tipeo o mensajes incompletos no descuentan créditos."

## What this replaces (if adopted)

The current `freemium-spec.md` v1 contract:

- `free = 20` user messages / month
- `basic = 120` user messages / month
- `premium = 300` user messages / month
- Calendar-month window, hard cap, `role = 'user'` count

The replacement would change:

- Unit of measurement: message → credit
- Counting logic in `backend/src/db.ts`
- Limit constants in `backend/src/chat-limits.ts` and
  `frontend/src/chat-limits.ts`
- Cap-reached payload contract (`message_limit_reached` → e.g.
  `credits_exhausted` with `creditsUsed`, `creditsLimit`)
- Frontend usage display (counter semantics)
- Plan names (`premium` may become `pro`, plus a possible `mentor` tier)
- Premium report access gating (today coupled to `plan === 'premium'`)

## Open questions for levantamiento

These must be answered **before** committing to this direction.

### Pricing & business

- [ ] What is the real per-user token distribution today? (`llm_calls` analysis)
- [ ] What does p50 / p90 / p99 monthly token consumption look like per plan?
- [ ] At the proposed prices, what is the gross margin in the realistic, heavy,
      and worst-case usage scenarios?
- [ ] Does USD 19 / USD 39 align with Daniela's brand positioning and her
      audience's willingness to pay?
- [ ] Should `free` exist at all, or be a one-time trial?

### Industry research

- [ ] How do comparable AI products price?
  - per message (current Astral)
  - per credit (Midjourney, ElevenLabs, many LLM wrappers)
  - per outcome (Intercom Fin)
  - usage-based with soft cap
  - flat with rate limits (ChatGPT Plus)
- [ ] What is the dominant pattern for "consumer-facing AI advisor" products
      in 2026? Credits? Flat? Tiered usage?
- [ ] Examples of credit-based pricing that explain credit cost well to
      non-technical users?

### Premium deliverable

- [ ] Does `premium` (the business/mentorship report continuation defined in
      `premium-report-v2-spec.md`) stay as a plan-gated feature, or does it
      cost N credits and become accessible to lower tiers if they pay credits?
- [ ] Can the report-vs-chat split survive in a unified credits model, or do
      we need two separate budgets (e.g. "lectura/chat credits" vs "report
      credits")?

### UX

- [ ] Does the user need to **see** credit cost **before** sending a message,
      or only **after**? (Pre-estimation is hard, post is honest but reactive.)
- [ ] How do we explain "this message cost 5 credits" without making the user
      feel surveilled?
- [ ] Top-up packs (buy extra credits without changing plan) — yes/no in v2.0?
- [ ] Roll-over of unused credits — yes/no? (Today: no roll-over.)

### Implementation

- [ ] Token measurement: do we already capture `input_tokens` and
      `output_tokens` per call in `llm_calls`? (See cost work in `astral-y3c.8`.)
- [ ] How do we handle in-flight credit reservation for streaming responses
      that can balloon mid-stream?
- [ ] Migration path for existing paying users (`premium` today): grandfather
      the message-based plan? force migration on next renewal? offer
      equivalent credits?
- [ ] Billing: does this require a payment provider before launching, or can
      we run credits with manual provisioning the same way `astral-0xw`
      handles premium today?

## Explicit non-goals (right now)

This intent doc is **not**:

- a commitment to any specific number (USD 19, 120 credits, 5-credit threshold)
- a commitment to migrate at all — message-based may still win after analysis
- an implementation plan
- a change to the live `freemium-spec.md` contract

## Source / context

- Sparring transcript: ChatGPT 2026-05-05, captured by Brian in chat history.
- Current implementation: `freemium-spec.md` (Access Model v1).
- Adjacent work: `astral-y3c.8` (cost budget + alerting on `llm_calls`) is a
  hard pre-requisite — we cannot price credits without trustworthy per-call
  token + cost data.
- Premium deliverable spec: `premium-report-v2-spec.md`.

## Next steps

1. Wait for `astral-y3c.8` (or its data) to land, so per-call cost is real.
2. Run a `llm_calls` analysis: distribution of tokens per message, per user,
   per plan, last 30–90 days.
3. Industry research pass on credit-based pricing for consumer AI products.
4. Re-do unit economics with real numbers, not the placeholders above.
5. Decide go / no-go on credits model.
6. If go: write the v2 contract spec to replace `freemium-spec.md` and a
   migration plan for existing users.
