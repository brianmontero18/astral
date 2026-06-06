# Stitch MCP — API reference (verified 2026-06-06)

Google Stitch turns text/image prompts into real, exportable HTML+CSS screens
using Gemini. We drive it through the `stitch` MCP server. **The Gemini tokens
are spent on Google's side, not on our LLM budget.** Our only cost is the few
tokens of the tool calls themselves.

> ⚠️ **The live tool schema is the source of truth, not this file.** Stitch's API
> changes. Before generating, if anything looks off, re-fetch the schema with
> `ToolSearch "select:mcp__stitch__generate_screen_from_text"` and read the enum
> descriptions — they carry `x-google-enum-deprecated` flags. Official product:
> https://stitch.withgoogle.com

## The tools

The MCP tools are deferred — load them first with
`ToolSearch "select:mcp__stitch__create_project,mcp__stitch__generate_screen_from_text,..."`.

| Tool | What it does | Key args |
|---|---|---|
| `list_projects` | All your projects | `filter`: `view=owned` (default) / `view=shared` — **returns ~80KB, overflows context; see Gotchas** |
| `create_project` | New project (container for screens) | `title` → returns `name: projects/{id}` |
| `get_project` | Project detail (screen instances, design systems) | `name: projects/{id}` |
| `generate_screen_from_text` | Text prompt → new screen | `projectId`, `prompt`, `modelId`, `deviceType`, `designSystem` |
| `generate_variants` | N variants of existing screen(s) | `projectId`, `selectedScreenIds[]`, `prompt`, `variantOptions{}` |
| `edit_screens` | Edit existing screen(s) in place | `projectId`, `selectedScreenIds[]`, `prompt` |
| `list_screens` | All screens in a project (+ download URLs) | `projectId` |
| `get_screen` | One screen | `name: projects/{p}/screens/{s}` |
| `list_design_systems` | DS for a project (or global if no projectId) | `projectId?` |
| `create_design_system` + `update_design_system` | Define colors/fonts/shape tokens | see DesignSystem schema |
| `apply_design_system` | Apply a DS to screen instances | `projectId`, `assetId`, `selectedScreenInstances[]` |
| `upload_design_md` + `create_design_system_from_design_md` | Build a DS from a DESIGN.md (base64) | `projectId`, `designMdBase64` |

IDs are passed **without** the `projects/` or `screens/` prefix to most tools
(e.g. `projectId: "7931532622468881391"`), but `get_screen`/`get_project` take the
full resource `name`. Read each schema.

## Models (`modelId`)

| Value | Status | Use when |
|---|---|---|
| `GEMINI_3_1_PRO` | ✅ current, best quality | Default for landings & hero work. **This is what we use.** |
| `GEMINI_3_FLASH` | ✅ current, faster/cheaper | Quick drafts, many variants, simple screens |
| `GEMINI_3_PRO` | ❌ **DEPRECATED** | Never — schema says "use GEMINI_3_1_PRO or GEMINI_3_FLASH" |
| `MODEL_ID_UNSPECIFIED` | default fallback | Avoid; be explicit |

> If a user says "usá Gemini 3 Pro" (as in the original POC request), that enum is
> deprecated — silently upgrade to `GEMINI_3_1_PRO` and tell them why.

## `deviceType`

`DESKTOP`, `MOBILE`, `TABLET`, `AGNOSTIC`. For landings default to `DESKTOP` and
optionally also generate `MOBILE`. Each is a separate screen.

## Generation is async and **times out — that is normal**

`generate_screen_from_text`, `generate_variants` and `edit_screens` can take
**2–5 minutes**. The MCP call frequently returns `The operation timed out` (~2 min)
**while Gemini keeps working in the background.**

**DO NOT retry the generate call** — a retry queues a second generation (extra
screens, wasted Gemini compute). Instead, **poll**:

1. Call `list_screens` for the project.
2. Empty `{}` → still generating. Wait ~30–60s and call again. Use a real wait:
   `for i in $(seq 1 9); do sleep 20; done` in one Bash call (standalone `sleep`
   may be blocked; loop inside a single command with a timeout).
3. Repeat up to ~10 times (5 min total). Screens appear when ready.

A screen is "ready" when it shows up in `list_screens` with a non-empty
`htmlCode.downloadUrl`. One text prompt for a landing usually yields **multiple
screens** (e.g. 3 stylistic takes + 1 generated hero image).

## Exporting HTML/CSS — free, no tokens

Each ready screen carries:
- `htmlCode.downloadUrl` — a signed Google URL to the self-contained HTML
  (Tailwind via CDN + Google Fonts + inline design tokens; CSS is embedded).
- `screenshot.downloadUrl` — a PNG preview rendered by Stitch (the authoritative
  visual; reliable even for very tall pages).
- `mimeType` — `text/html`, `text/markdown` (DESIGN.md), or `image/svg+xml` (logos).

Download them with plain HTTP (`curl`/`fetch`) — **zero LLM tokens**. The
`driver.mjs pull` command does all of this. The signed URLs **expire**, so
re-run `list_screens` if a download 400s.

## Iterating

- **Refine an existing screen** → `edit_screens` with the screen id + a prompt
  describing the change ("make the hero CTA bolder, warmer background").
- **Explore alternatives** → `generate_variants` with `variantOptions`:
  - `variantCount`: 1–5 (default 3)
  - `creativeRange`: `REFINE` (subtle) · `EXPLORE` (balanced, default) · `REIMAGINE` (radical)
  - `aspects[]`: `LAYOUT`, `COLOR_SCHEME`, `IMAGES`, `TEXT_FONT`, `TEXT_CONTENT`
    (empty = vary everything)
- **Brand consistency across screens** → create a design system once, then
  `apply_design_system` / pass `designSystem` to generation.

## Design systems (for multi-screen consistency / branding)

`create_design_system` sets foundational tokens, then call `update_design_system`
to attach it. Notable theme fields:
- `colorMode`: `LIGHT` / `DARK`
- `customColor`: hex seed (e.g. `#9a6a3c`), plus optional
  `overridePrimaryColor` / `overrideSecondaryColor` / `overrideTertiaryColor` / `overrideNeutralColor`
- `colorVariant`: `NEUTRAL`, `TONAL_SPOT`, `EXPRESSIVE`, `VIBRANT`, `MONOCHROME`, …
- `headlineFont` / `bodyFont` / `labelFont` — large Google-font enum. For the
  warm/premium/editorial aesthetic this niche wants, good picks:
  `PLAYFAIR_DISPLAY`, `LIBRE_CASLON_TEXT`, `EB_GARAMOND`, `CORMORANT`-like serifs,
  `NEWSREADER`, `VOLLKORN` for headlines; `DM_SANS`, `INTER`, `WORK_SANS`,
  `HANKEN_GROTESK` for body.
- `roundness`: `ROUND_FOUR` / `ROUND_EIGHT` / `ROUND_TWELVE` / `ROUND_FULL`
- `designMd`: free-form markdown design instructions

Or skip the structured form: write a `DESIGN.md`, `upload_design_md`
(base64: `base64 -w 0 DESIGN.md`), then `create_design_system_from_design_md`.

## Gotchas

- **`list_projects` overflows context (~80KB).** The harness auto-saves the
  result to a tool-results file. Don't read it raw — summarize with
  `driver.mjs projects <file>` or `jq '[.projects[]|{id:.name,title,created:.createTime}]'`.
- **Timeout ≠ failure.** See async section. Never retry generate; poll instead.
- **Signed download URLs expire.** Re-list to refresh.
- **One prompt → many screens.** Expect 3–4 outputs; pick/iterate, don't assume one.
- **Deprecated model enum.** `GEMINI_3_PRO` is dead; use `GEMINI_3_1_PRO`.
- **Hand-copying the screens JSON into a file is error-prone** (long URLs, easy to
  drop a brace). Validate with `python3 -c "import json;json.load(open('screens.json'))"`
  before running the driver, or save it programmatically.
