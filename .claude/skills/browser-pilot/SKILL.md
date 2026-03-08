---
name: browser-pilot
description: "Operates the browser via Playwright MCP — navigates, observes, interacts, and reports back based on any instruction."
argument-hint: "<instruction> — what to check, validate, explore, or test in the browser"
allowed-tools: mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_click, mcp__playwright__browser_hover, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_press_key, mcp__playwright__browser_select_option, mcp__playwright__browser_drag, mcp__playwright__browser_file_upload, mcp__playwright__browser_tabs, mcp__playwright__browser_resize, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_evaluate, mcp__playwright__browser_run_code, mcp__playwright__browser_wait_for, mcp__playwright__browser_handle_dialog, mcp__playwright__browser_close, Read, Bash
---

# Browser Pilot

> **Purpose**: Give any agent (or the user) eyes and hands in the browser. Interprets a natural-language instruction and executes it using Playwright MCP tools against a running web app.
> **Invoked by**: user directly (`/browser-pilot`), executor, pr-reviewer, sparring, or any agent that needs to see what's on screen.

---

## Pre-flight

Before any interaction, verify the connection is alive:

1. Call `browser_tabs` (action: "list").
2. **If it responds**: you're connected. Check if a relevant tab is already open.
3. **If it fails**: stop and report:

> Playwright MCP no responde. Verificar:
> 1. Chrome esta abierto
> 2. La extension "Playwright MCP Bridge" esta instalada y activa (icono verde)
> 3. El MCP esta configurado con `--extension` en `~/toolkit/config/mcp.json`
> 4. Reiniciar Claude Code para recargar la config del MCP

Do not proceed until pre-flight passes.

---

## Input

| Field | Required | Description |
|-------|----------|-------------|
| Instruction | Yes | What to do — natural language, can be a phrase, a question, or a list |
| URL | No | If not provided, check open tabs first. If no relevant tab, ask the user |
| Environment | Inferred | Detect from URL: `localhost` = dev, `staging`/`pre` = staging, `admin`/`internal` = prod-adjacent. Adjust caution level accordingly |

---

## Guardrails

### 1. Orient

Before acting, establish what you're working with:
- What URL or tab? If no URL given, call `browser_tabs` to see what's open — use a relevant tab if available.
- What's the goal? (validate, explore, compare, test, take evidence)

If the instruction is clear enough, skip the question and go.

### 2. Observe first

Before clicking, typing, or navigating:
- Take a `browser_snapshot` to understand the page structure (accessibility tree)
- Take a `browser_take_screenshot` when visual context matters

### 3. Narrate

Every action you take, briefly say what you're doing and why:
- "Navigating to /risk-ops to check the layout"
- "Clicking the 'Close' button on tab 2 to test rapid tab closing"
- "Resizing to 375x812 to check mobile rendering"

### 4. Report

When done, close with what you found using the summary template below.

### 5. Verify before reporting

Before delivering findings, check:
- Did you cover every item in the instruction? _(Prevents: incomplete reports that skip steps)_
- If running a checklist, is every item accounted for with a verdict?
- Do your findings have evidence (snapshot or screenshot) where needed?
- Are there console errors or network failures you didn't check?

---

## Mode detection

Infer the mode from the instruction. If the instruction doesn't match any pattern, default to **Exploration**.

| Pattern in instruction | Mode | Behavior |
|----------------------|------|----------|
| "fijate", "chequeate", "how does it look", single question | **Exploration** | Navigate, observe, report what you see |
| List of steps, "UAT", "one by one", "test these" | **Checklist** | Execute sequentially, report pass/fail per item |
| "compare", "A vs B", "which looks better" | **Comparison** | Screenshot both, describe differences |
| "mock", "simulate", "what happens if" | **Scenario** | Set up conditions (via evaluate/intercept), observe result |
| "keep an eye", "validate as you go" | **Companion** | Periodic checks between other work, lightweight |

---

## Tools reference

Use whatever Playwright MCP tools the instruction requires. Key ones:

| Tool | When to use |
|------|-------------|
| `browser_navigate` | Go to a URL |
| `browser_snapshot` | Read the page structure (a11y tree) — your primary "eyes" |
| `browser_take_screenshot` | Capture visual evidence |
| `browser_click` / `browser_hover` / `browser_type` | Interact with elements |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_press_key` | Keyboard shortcuts, Enter to submit |
| `browser_tabs` | List, create, close, or switch tabs |
| `browser_resize` | Test responsive at different viewports |
| `browser_console_messages` | Check for JS errors (level: "error") |
| `browser_network_requests` | Check for failed HTTP requests |
| `browser_evaluate` | Run JS on the page (check DOM state, measure performance) |
| `browser_run_code` | Run full Playwright code snippets for complex flows |
| `browser_wait_for` | Wait for elements, navigation, or network idle |

### Waiting for page load

SPAs are asynchronous. After navigation or interaction:
1. Use `browser_wait_for` to wait for key elements or network idle
2. Don't screenshot a loading spinner — wait for content to render
3. If a page takes too long (>10s), report it as a finding

### Screenshot budget

Max **5 screenshots** per invocation. Use `browser_snapshot` (text, cheap) for navigation and decision-making. Reserve `browser_take_screenshot` (image, expensive) for visual evidence the user or another agent needs to see. _(Prevents: context exhaustion from image-heavy sessions)_

### Recording a video walkthrough

When the user asks to "record", "demo", "grabar", or "walkthrough" with video output, follow this protocol. The goal is a fluid, human-like video — no debugging artifacts, no dead time, no stale UI.

#### Phase 1 — Rehearse (no recording)

Navigate the entire flow using normal tool calls (`browser_click`, `browser_snapshot`, etc.). This phase is for discovering the UI, not for the video.

- Open every modal, dropdown, and form you'll interact with during the demo
- Note the working selectors for each element (role, name, placeholder, index)
- Reset the page (refresh) before the dry run — the `browser_run_code` script must work from a clean state, not from the post-exploration state _(Prevents: script that passes rehearsal but fails during recording because Phase 2 reset changes the starting conditions)_
- Test the full action chain in a single `browser_run_code` call to confirm it runs without errors
- If anything fails: fix it and retry until the chain completes cleanly

Do not start recording until the rehearsal succeeds end-to-end. _(Prevents: debugging artifacts in the video — selector mismatches, half-filled forms, error popups)_

#### Phase 2 — Reset

Prepare a clean starting state for the video:

- Refresh the page (`browser_navigate` to the target URL)
- Wait for the page to fully load (no spinners, no "Cargando...")
- Verify: no stale modals or tooltips open, scroll position at top

#### Phase 3 — Record

1. Bring the target tab to front using `page.bringToFront()` inside `browser_run_code`. `browser_navigate` does NOT activate the tab in Chrome — the video will record whatever tab Chrome is showing. _(Prevents: recording the wrong tab)_
2. Run `~/toolkit/scripts/record-walkthrough.sh start` — captures only the Chrome window (not full screen). The user can keep working in other apps.
3. Execute the validated flow from Phase 1 using `browser_run_code` — all actions in a single call, with `waitForTimeout()` between steps for natural human pacing. For faster output and less dead time, consider switching to a faster model (`/model claude-sonnet-4-6`) before recording, or delegating the recording to a subagent. _(Prevents: dead time from model thinking between tool calls)_
4. After the main action (e.g., form submission): wait for async completion before scrolling to the result. Modals and dialogs close asynchronously — use `waitForSelector('[role="dialog"]', { state: 'detached' })` or similar before scrolling to verify the outcome is visible. Include this inside the same `browser_run_code` call. _(Prevents: scrolling under a modal overlay, or video ending before the result is confirmed)_
5. Run `~/toolkit/scripts/record-walkthrough.sh stop` — outputs mp4 to `~/Desktop/`

Chrome must not be minimized during recording (occluded by other windows is fine).

The screenshot budget does NOT apply during recording — the video captures everything.

#### Phase 4 — Verify & clean

- Confirm the mp4 was generated and report path + size to the user
- If the recording failed (no file, screencapture error): check Screen Recording permissions in System Settings > Privacy & Security
- Optional: if the video has dead time between actions (e.g., tool calls were used instead of `browser_run_code`), run `~/toolkit/scripts/cut-freeze.py input.mp4 -o output.mp4` to auto-remove freeze frames

#### Fallback: Screenshots + FFmpeg (1fps slideshow)

Use when Screen Recording permission isn't available or when the user wants frame-by-frame control.

1. `mkdir -p /tmp/browser-pilot-frames`
2. Take screenshots with sequential naming: `frame_001.png`, `frame_002.png`, etc.
3. `~/toolkit/scripts/frames-to-video.sh /tmp/browser-pilot-frames ~/Desktop/demo.mp4 1`

> For full evaluation of recording options, see [`docs/video-recording-research.md`](../../../docs/video-recording-research.md).

---

## Troubleshooting

> **Detect:** `browser_tabs` or any Playwright tool returns connection error. **Fix:** Check Chrome is open, extension is active (green icon), restart Claude Code to reload MCP config.

> **Detect:** Page loads but shows login/SSO redirect instead of the app. **Fix:** The extension bridge lost the session. User should refresh the page in Chrome manually, then retry.

> **Detect:** `browser_snapshot` returns empty or minimal tree after navigation. **Fix:** Page may still be loading. Call `browser_wait_for` with a selector or "networkidle", then retry snapshot.

> **Detect:** `browser_take_screenshot` returns a blank or stale image. **Fix:** The page may be behind a modal or loading overlay. Take a snapshot first to check DOM state, dismiss any overlays, then retry.

> **Detect:** Element `ref` from snapshot doesn't match when clicking. **Fix:** Page changed between snapshot and click. Take a fresh `browser_snapshot` and use the updated ref.

---

## Boundaries

- **Human-assisted verification, not E2E testing.** For repeatable automated test suites, use Playwright test files directly. _(Prevents: brittle agent-driven tests replacing proper CI)_
- **Don't modify production data.** If the environment looks like production (no `localhost`, no `staging` in URL) and the instruction would create/delete records, flag it and ask for confirmation. _(Prevents: irreversible side effects on real users)_
- **Auth is handled by the extension.** You're connected to the user's Chrome with their active session. Don't try to log in, handle SSO, or manage cookies.

---

## Summary template

When producing the final report, use this structure. Adapt the level of detail to the instruction — a quick check gets a brief report, a UAT list gets a full table.

```
### Browser Pilot — {mode}
- **URL**: {target URL or tab}
- **Instruction**: {what was requested}
- **Result**: {PASS | FAIL | PARTIAL | observed behavior summary}
- **Findings**: {bullet list of observations, or "Ninguno"}
- **Evidence**: {screenshot filenames if taken, or "No screenshots needed"}
- **Console errors**: {count and summary, or "Ninguno"}
- **Network errors**: {count and summary, or "Ninguno"}
- **Notes**: {anything unexpected or worth highlighting}
```

---

## Invocation examples

```
/browser-pilot fijate como luce la pantalla de Risk and Ops
/browser-pilot segui esta UAT list paso por paso: [list]
/browser-pilot compara como se ve la tabla con el feature flag on vs off
/browser-pilot mockea que el endpoint /api/risks responda 500 y fijate que muestra la UI
/browser-pilot chequeate si el ambiente de staging esta andando bien
/browser-pilot anda validando como queda cada componente que voy creando
/browser-pilot grabame un walkthrough de dar de alta un Risk and Ops en feature-fintech
```
