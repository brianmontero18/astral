# Premium Report v2 — Business/Mentorship Contract

## Problem & Scope

The monetization contract is already closed in [docs/freemium-spec.md](/Users/brmontero/astral/docs/freemium-spec.md): `premium` must differentiate through a business/mentorship deliverable, not only through more chat or deeper HD theory.

Before this session, the premium section model was still organized around legacy HD glossary depth:

- `definition`
- `channels`
- `undefined-centers`
- `incarnation-cross`
- `variables`
- `strengths-shadows`

That was the contract gap this spec was created to close.

### In scope

- Redefine the premium report content contract for v2.
- Define the exact premium promise, section set, ordering, and differentiation against the free report.
- Define what premium unlocks beyond chat volume.
- Reuse the current report architecture where it already works: report tiers, gating, caching, PDF/share surfaces, intake, and hybrid static+LLM generation.

### Out of scope

- Monthly quota logic, billing, pricing, auth, or plan gating changes.
- New intake fields.
- New dependencies, DB tables, config changes, or a full report-system rewrite.
- Reworking the free report beyond copy needed to explain the new premium promise.

### Closed product contract

There is only **one report surface**.

`free` and `basic` access the base layer of that report.

`premium` unlocks the additional applied business/mentorship layer of the same report. That premium continuation translates the user's design into:

- sustainable work rhythm
- decision timing
- positioning and offer fit
- client dynamics and boundaries
- visibility and selling style
- concrete next actions

The premium layer is not a separate artifact or alternate report. It is the same report, continued and completed with strategic mentoring value.

### Free vs premium surface

| Tier | What remains | What changes in v2 |
|------|--------------|--------------------|
| `free` | Same report surface, base layer unlocked | Premium continuation visible but locked |
| `basic` | Same report surface, base layer unlocked | Premium continuation visible but locked |
| `premium` | Same report surface, base layer unlocked | Premium continuation unlocked |

### Premium section contract

The report keeps a progressive structure: 4 base sections first, then 6 premium-gated sections. Premium is additive, not parallel.

The premium section order is:

1. `mechanical-chart` — `Tu Carta Mecánica`
2. `type` — `Tu Tipo`
3. `authority` — `Tu Autoridad`
4. `profile` — `Tu Perfil`
5. `work-rhythm` — `Cómo trabajás mejor`
6. `decision-style` — `Cómo decidir sin forzarte`
7. `positioning-offer` — `Dónde está tu mayor valor`
8. `client-dynamics` — `Con quién sí, con quién no`
9. `visibility-sales` — `Cómo te conviene comunicar y vender`
10. `next-30-days` — `Próximos 30 días`

Each section has a fixed job:

| Section | Job to be done | What it must use | What it must avoid |
|---------|----------------|------------------|--------------------|
| `work-rhythm` | Diagnose how the user sustains output, where they force, and which work conditions produce better flow | Type, authority, profile, definition, channels/variables when relevant, plus intake | Standalone explanation of definition/channels with no work implication |
| `decision-style` | Explain timing, clarity, and the user's most common wrong decision pattern | Authority, profile, emotional/energetic pattern, intake challenges | Generic "follow your authority" advice with no concrete timing pattern |
| `positioning-offer` | Identify where the user's natural value is strongest and what kind of offer/problem fit is more aligned | Profile, channels, incarnation-cross when useful, activity/objectives | Abstract purpose talk with no market or offer implication |
| `client-dynamics` | Describe ideal client fit, boundary needs, red flags, and relationship patterns that protect results | Undefined centers, channels, profile dynamics, challenges | Pure conditioning theory with no client/boundary translation |
| `visibility-sales` | Translate the design into a communication, content, and selling style that feels aligned | Throat/authority/profile patterns, strongest sense/environment when useful, activity | Generic marketing tips detached from the chart |
| `next-30-days` | Close with a short mentoring synthesis that the user can act on immediately | All prior sections plus intake | Inspirational closure with no concrete moves |

### Locked-preview contract for free/basic

`free` and `basic` users must be able to see that the report continues beyond the base layer.

That means:

- the same report screen shows the premium section titles in order
- each premium section appears as locked
- the premium block is framed as "continuación aplicada" or equivalent, not as a separate report
- locked users can understand what they would unlock, but cannot access the full premium content

Allowed locked-preview elements:

- section title
- icon
- one-line value statement or teaser
- premium CTA

Not allowed for locked users:

- full premium body copy
- actionable premium guidance
- full mentoring synthesis

### Output contract per premium section

For sections `work-rhythm` through `visibility-sales`, the output must read like:

- one diagnostic paragraph
- one business application paragraph
- one caution or anti-pattern paragraph

For `next-30-days`, the output must end with:

- `3 movimientos para hacer ahora`
- `3 cosas para dejar de forzar`
- `1 señal a observar este mes`

The report may mention HD mechanics, but only in service of a business/mentorship diagnosis.

### Positioning and tone contract

The premium report must feel closer to the applied value in [DANIELA_DESIGN_PROFILE.md](/Users/brmontero/marca_personal/DANIELA_DESIGN_PROFILE.md):

- pattern recognition over glossary depth
- mentoring usefulness over symbolic interpretation
- decision/rhythm guidance over abstract inspiration
- strategic value over decorative mystique

Tone:

- direct
- warm
- specific
- non-theatrical
- second person in Spanish

Not allowed:

- selling premium as "more sections" or "interpretación profunda" only
- framing the deliverable as a full business plan
- generic coaching filler that could fit any chart

## Acceptance Criteria

1. Given a `free` or `basic` user, the product still renders a single report surface with the 4 base sections first and the 6 premium sections visible as locked continuation.
2. Given a `free` or `basic` user, requesting `tier=premium` in report, share, or PDF endpoints still returns the existing `403 report_tier_not_allowed` contract; `.4` does not change access policy.
3. Given a premium user, the same report surface renders the 10 sections total in this exact order: `mechanical-chart`, `type`, `authority`, `profile`, `work-rhythm`, `decision-style`, `positioning-offer`, `client-dynamics`, `visibility-sales`, `next-30-days`.
4. The legacy premium ids `definition`, `channels`, `undefined-centers`, `incarnation-cross`, `variables`, and `strengths-shadows` no longer appear as the premium continuation model in payloads, UI lock cards, or PDF output.
5. The in-app premium CTA and lock copy describe the premium layer as the continuation/completion of the same report; strings equivalent to "otro reporte" or "secciones adicionales con interpretación profunda" are removed.
6. The same premium section titles and order are used consistently in API payloads, in-app rendering, locked previews, and PDF rendering.
7. Premium generation uses the existing intake contract only: `actividad`, `objetivos`, and `desafios` remain optional, no new fields are required, and missing intake does not block report generation.
8. When intake is present, premium sections use it as business context; when intake is absent, the copy remains coherent and never references missing user context.
9. `next-30-days` ends with explicit action guidance for the next month, not a generic inspirational close.
10. No quota, billing, auth, or plan-table behavior changes are introduced while implementing this spec.

## Backend Questions

None. This contract is closed enough to implement.

Executor may proceed unless new scope is added outside report content, rendering, or copy.

## Comparable Patterns

- [backend/src/routes/report.ts](/Users/brmontero/astral/backend/src/routes/report.ts) keeps the right tier-gating, owned-report loading, share, and PDF surface. Follow this behavior as-is.
- [backend/src/report/generate-report.ts](/Users/brmontero/astral/backend/src/report/generate-report.ts) already provides the reusable primitives for `profileHash`, tier branching, hybrid static+LLM generation, degraded mode, and report assembly. Reuse the pipeline, replace the premium content contract.
- [backend/src/report/prompts.ts](/Users/brmontero/astral/backend/src/report/prompts.ts) is the existing split-prompt pattern with intake injection. Follow this pattern, but rewrite prompts around applied business/mentorship outcomes.
- [backend/src/report/types.ts](/Users/brmontero/astral/backend/src/report/types.ts) is the current section metadata source. This is the place to replace the premium section ids/titles/order.
- [frontend/src/components/ReportView.tsx](/Users/brmontero/astral/frontend/src/components/ReportView.tsx) already groups base vs premium sections inside one report view, renders locks, and owns the current CTA copy. Preserve this single-surface interaction model, replace the premium framing and copy.
- [backend/src/__tests__/api-report.test.ts](/Users/brmontero/astral/backend/src/__tests__/api-report.test.ts) already captures the access-policy contract. Keep those protections intact while changing the premium content model.
- [docs/freemium-spec.md](/Users/brmontero/astral/docs/freemium-spec.md) is the monetization contract that this spec satisfies. Treat it as policy and this document as the premium deliverable definition.
- [docs/report-architecture-deliberation.md](/Users/brmontero/astral/docs/report-architecture-deliberation.md) remains useful for technical choices such as hybrid generation, PDF, intake, and caching, but its premium content model is superseded by this doc.

## Implementation Guardrails

- No new dependencies.
- No config, tooling, or env changes.
- No new DB tables and no plan/quota schema changes.
- Keep `ReportTier` as `free | premium`.
- Keep the existing intake model and `profile_hash` invalidation strategy.
- Keep the current route-level gating semantics and error payloads.
- Prefer the current generation architecture shape: one free-tier path and one premium-tier path, with at most 3 LLM calls total for premium.
- Do not add standalone theory sections for `definition`, `channels`, `variables`, or similar concepts. Those mechanics can appear only inside applied sections.
- Do not couple this slice to a new payment, billing, or upsell flow. The current CTA destination can stay as-is unless product copy needs to change to reflect the new "same report, more complete when you upgrade" promise.
- `eslint-disable`, `@ts-ignore`, and broad refactors are not allowed.

## Commit Strategy

1. Replace report section metadata and shared types to encode the new premium contract.
2. Rewrite report prompt/generation logic to produce the new premium sections while keeping the free path stable.
3. Update in-app and PDF copy/rendering to match the new premium promise.
4. Update or add focused tests for payload shape, gating stability, and premium CTA/rendering copy.
5. Reconcile docs that reference the old premium section model.

## Risks & Edge Cases

- The biggest failure mode is false compliance: changing section titles but keeping the old "more HD depth" prompt logic underneath.
- `next-30-days` can easily collapse into generic coaching filler. It needs explicit action structure or it will become decorative.
- If intake is weak or empty, the premium report still needs to feel applied; the fallback cannot mention missing goals/challenges directly.
- Copy drift is likely because the premium promise appears in multiple surfaces: web CTA, locked cards, PDF, docs, and any place that could incorrectly frame premium as a separate report.
- Reusing the current architecture is good; reusing the old premium section semantics is not. The executor should preserve the pipeline, not the content model.
