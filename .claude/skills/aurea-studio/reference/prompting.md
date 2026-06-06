# Talking to Stitch / Gemini — prompt craft

Stitch generates with Gemini. The quality of the screen is mostly the quality of
your prompt. Your job in this skill is to **translate a non-technical founder's
intention + brand + Human Design into a prompt Gemini renders beautifully** — so
she never has to learn design language and never spends a Claude token on layout.

## The anatomy of a strong Stitch prompt

Always assemble, in roughly this order:

1. **What it is** — "Landing page for a 1:1 Human Design reading service."
2. **Who it's for / vibe** — audience + emotional tone in adjectives:
   "for conscious women entrepreneurs; warm, grounded, premium, unhurried."
3. **Aesthetic direction** — concrete style words:
   "minimalist editorial, quiet luxury, generous whitespace, warm neutral palette
   (cream, sand, soft oak, terracotta accent), soft natural light."
4. **Sections, in order** — be explicit:
   "Hero with headline + one-line tagline + single CTA; then a 3-step process;
   then testimonial; then offer/pricing; then closing CTA with calendar."
5. **Type & color if known** — "Serif display headlines (Playfair-style),
   humanist sans body; primary #9a6a3c, background #f5f3ee."
6. **Anti-instructions** — what to avoid is as powerful as what to ask:
   "No generic SaaS/startup look, no blue gradients, no stock-corporate imagery,
   no emojis, no neon."
7. **Copy language** — "All copy in Spanish (rioplatense, warm, no corporate
   jargon)." (Stitch writes placeholder copy; give it the real/approved copy when
   you have it — see the copy step in SKILL.md.)

Keep it one dense paragraph or tight bullet list. Gemini handles long, specific
prompts well; vagueness is what produces the "generic startup look" the user hates.

### Worked example (the POC that started this skill)

> "Landing page for a female entrepreneur. Minimalist, warm tones, premium feel.
> Hero section with headline, short tagline, and CTA button. No generic startup look."

→ produced clean editorial landings (Playfair + DM Sans, cream palette). Good
baseline; everything above just makes it sharper and more on-brand.

## Using a screenshot as inspiration

A founder can paste a screenshot of a site/Pinterest/Instagram she loves. You
(Claude) can **see** it. Don't pass the image to Stitch — instead **describe what
makes it work** and fold that into the prompt:

1. Look at the image. Extract: layout structure, color palette (name hexes if you
   can), type style (serif/sans, weight, contrast), spacing/density, mood,
   signature details (oversized type, thin rules, arch shapes, grain, etc.).
2. Turn that into prompt language: "inspired by editorial fashion lookbooks —
   oversized serif headline, hairline dividers, lots of negative space, muted
   earth palette, full-bleed warm photography."
3. Tell the founder what you took from it, so she can correct ("I liked the type
   but want it warmer").

## Using a URL as a reference

If she gives a link to a site she likes, fetch it (`WebFetch`) to read its
structure/copy/positioning, summarize the design language, and translate that into
the prompt the same way as a screenshot. Reference, don't clone — and say so.

## Brand intake — what to require before generating

Push for these (use [branding-checklist.md](branding-checklist.md)). If she
doesn't have them, propose defaults from her Human Design + business context and
confirm:

- **Brand name** + one-line what-she-does
- **Audience** (who, their pain, their aspiration)
- **Tone words** (3–5 adjectives)
- **Palette** (hexes or named direction — "warm earth", "cool moon")
- **Typography** (or let us pick from the Stitch font enum)
- **Imagery direction** (photography style, illustration, none)
- **Sections wanted** + the **single primary CTA**
- **Anti-references** (what she does NOT want to look like)
- **Copy language + voice**

## Talking to Gemini well — principles

- **Specific > adjective soup.** "Terracotta CTA on cream, serif display" beats
  "make it pretty and premium."
- **Name the sections and their order.** Gemini follows structure.
- **Give it constraints to push against.** Anti-instructions sharpen output.
- **One concept per generation.** To compare directions, use `generate_variants`,
  don't cram three vibes into one prompt.
- **Iterate with `edit_screens` in small, named changes**, not full rewrites:
  "warm the background to #f5f3ee and make the hero headline 20% larger."
- **Generated images are prompts too.** Stitch may emit a hero image from an
  image-prompt screen; describe the photo you want (subject, light, palette,
  "no people", resolution) in the main prompt.
