# Human Design intake — the Astral layer

This skill is not a generic web-design tool. Its users are **conscious women
entrepreneurs** — coaches, holistic practitioners, astrologers/Human-Design
readers, healers, creators in the astral/wellness space (the same ICP as the
sister product **Astral Guide**; see `proyectos/astral/AGENTS.md`). For them, a
landing isn't "a web page" — it's an expression of their energy. So we ground the
design in **her Human Design bodygraph** + **her business context** before writing
a word of copy.

The bodygraph comes from the **Astral_Guide MCP** (`mcp__claude_ai_Astral_Guide__*`).
Load it with `ToolSearch "select:mcp__claude_ai_Astral_Guide__ask_astral_guide_v1,..."`.

## Astral_Guide tools

| Tool | Use |
|---|---|
| `ask_astral_guide_v1` | **Read-only Q&A** using her active profile, memory, **business context**, and transits. Your main way to pull HD + business background. |
| `get_active_bodygraph_image_v1` | View her active bodygraph as an image |
| `get_active_bodygraph_pdf_v1` | Export bodygraph PDF |
| `create_my_bodygraph_from_birth_v1` | **Calculate & persist** a chart from birth data. ⚠️ `confirmReplace:true` **wipes** chat/memory/intake/reports tied to the previous chart. |
| `open_bodygraph_form_v1` | Open Astral's embedded birth-data form for her to fill |
| `search_birth_places_v1` | Geocode a birthplace → `{lat, lon, label}` for the form |

## Intake flow (do this before designing)

1. **Greet warmly and ask for the bodygraph.** Non-technical:
   > "Hola 🌙 Estoy para ayudarte a dar forma a tu idea. Para que el diseño hable
   > tu energía, ¿tenés tu bodygraph de Diseño Humano? Si lo tenés, adjuntámelo.
   > Si no, lo calculamos juntas acá mismo."

2. **Check for an existing chart first.** Try `ask_astral_guide_v1` ("¿Cuál es mi
   tipo, autoridad y perfil de Diseño Humano?") or `get_active_bodygraph_image_v1`.
   If she already has an active chart, **don't recalculate** — confirm it's hers.

3. **If no chart, calculate it:**
   - Collect name, birth **date** (YYYY-MM-DD), local **time** (HH:mm, 24h), and
     **birthplace**.
   - `search_birth_places_v1` to resolve the place → `{lat, lon, label}`.
   - `create_my_bodygraph_from_birth_v1` with `name`, `date`, `time`, `place`.
   - If she already had a chart and this would replace it, **explain the wipe**
     (chat/memory/intake/reports reset) and only pass `confirmReplace:true` after
     **explicit** yes. Or use `open_bodygraph_form_v1` to let her do it herself.

4. **ALWAYS confirm the chart is hers before proceeding.** Read back type,
   authority, profile (and the name on it). Never design on an unconfirmed or
   someone-else's chart. _"Confirmame que este es tu bodygraph antes de seguir."_

5. **Pull the substance.** Use `ask_astral_guide_v1` to gather what should shape
   the design and copy:
   - Energy/type/authority/profile and how she's meant to communicate & decide.
   - Her **business**: what she offers, to whom, her positioning, her voice — Astral
     already holds business context and memory about her.
   - Anything relevant to messaging (e.g. a Projector invites & guides → copy and
     CTA framed as invitation, not hustle; a Manifesting Generator → multi-passion,
     energetic, layered offers).

6. **Decide if you have enough.** If the chart + business context are thin, ask a
   couple of targeted questions before moving on. Don't design in a vacuum.

## Translating HD into design & copy (lightweight heuristics)

Use as **inputs to the prompt and copy**, not rigid rules — always sanity-check
against what *she* says:

- **Type / aura** → energetic tone & CTA framing:
  - *Projector* — invitation, recognition, depth; calm, spacious layout; CTA like
    "Reservá tu sesión" (invite), not "¡Empezá ya!".
  - *Generator / MG* — response, vitality, satisfaction; warmer, more dynamic,
    can carry more offers/sections.
  - *Manifestor* — initiation, impact, independence; bold hero, declarative copy.
  - *Reflector* — sampling, lunar, community; gentle, airy, no pressure.
- **Authority** → how decisions/CTAs are framed (emotional → "tomate tu tiempo,
  sentilo"; sacral → gut-yes language; splenic → in-the-moment).
- **Profile lines** → how personal/visible the about & hero feel (e.g. 1/3 wants
  depth & foundation; 5/1 universalizing, projection-aware; 6/2 role-model arc).
- **Defined centers / channels** → themes to emphasize (e.g. defined Throat →
  voice/expression as a selling point; defined Heart → confidence in pricing).

> Keep it tasteful and accurate. If you're unsure how a mechanic reads, ask
> `ask_astral_guide_v1` rather than inventing. Astral is the HD source of truth;
> do not hallucinate chart mechanics.

## Privacy

Birth data and bodygraphs are sensitive personal data. Don't expose them in
generated copy unless she asks. The replace operation is destructive — treat
`confirmReplace` like `rm`.
