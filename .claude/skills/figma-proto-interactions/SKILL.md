---
name: figma-proto-interactions
type: internal
description: "Create and verify prototype interactions in Figma (navigation, modals, transitions)"
argument-hint: "<interaction-description> — prototype flow to create or verify"
---

# Figma Prototype Interactions

> **Purpose**: Create and verify prototype interactions in Figma via Plugin API (`figma_execute`).
> **Invoked by**: executor (after frames exist), QA/validation agents, users.
> **Depends on**: figma-design-ops (frames must exist first — this skill wires them together).

---

## When to Use

- Frames/screens already exist in Figma and need navigation wired between them
- Modals/overlays need open + close triggers
- Verifying an existing prototype has complete interaction coverage

## When NOT to Use

- Frames don't exist yet — create them first (figma-design-ops or `figma_execute`)
- Building a local interactive prototype (React+Vite) — that's code, not Figma interactions
- Needs animation beyond Smart Animate — Figma Plugin API has limited animation control

---

## Phase 1 — Create Interactions

### Pattern A: Navigate between screens

```js
await button.setReactionsAsync([{
  actions: [{
    type: "NODE",
    destinationId: targetFrame.id,
    navigation: "NAVIGATE",
    transition: { type: "SMART_ANIMATE", easing: { type: "EASE_IN_AND_OUT" }, duration: 0.3 },
    preserveScrollPosition: false
  }],
  trigger: { type: "ON_CLICK" }
}]);
```

### Pattern B: Open modal as overlay

```js
await ctaButton.setReactionsAsync([{
  actions: [{
    type: "NODE",
    destinationId: modalFrame.id,
    navigation: "OVERLAY",
    transition: { type: "DISSOLVE", easing: { type: "EASE_OUT" }, duration: 0.2 },
    preserveScrollPosition: false
  }],
  trigger: { type: "ON_CLICK" }
}]);
```

### Pattern C: Close overlay

```js
await closeButton.setReactionsAsync([{
  actions: [{ type: "CLOSE" }],
  trigger: { type: "ON_CLICK" }
}]);
```

BACK and CLOSE are standalone actions — they accept NO extra fields (no transition, no navigation).

---

## API Reference Tables

### Transition types (ONLY these 3 work via Plugin API)

| Type | Use case |
|------|----------|
| `DISSOLVE` | Fade in/out — modals, overlays |
| `SMART_ANIMATE` | Morph matching layers — screen navigation |
| `SCROLL_ANIMATE` | Scroll-triggered transitions |

Push, Slide, Move do NOT work via Plugin API. They fail silently.

### Action types

| Type | Purpose |
|------|---------|
| `NODE` | Navigate to a frame (requires `navigation` + `destinationId`) |
| `BACK` | Go to previous screen (standalone, no extra fields) |
| `CLOSE` | Close current overlay (standalone, no extra fields) |
| `URL` | Open external URL |
| `SET_VARIABLE` | Set a Figma variable value |
| `SET_VARIABLE_MODE` | Switch variable mode |

### Navigation types (NODE actions only)

| Type | Behavior |
|------|----------|
| `NAVIGATE` | Replace current screen |
| `OVERLAY` | Open as modal/popup on top |
| `SWAP` | Replace in-place within parent |
| `SCROLL_TO` | Scroll to target node |

### Trigger types

| Type | Fires when |
|------|------------|
| `ON_CLICK` | User clicks element |
| `ON_HOVER` | Cursor enters element |
| `ON_PRESS` | Mouse down on element |
| `ON_DRAG` | User drags element |
| `AFTER_DELAY` | Timer expires |
| `MOUSE_ENTER` | Cursor enters (like ON_HOVER) |
| `MOUSE_LEAVE` | Cursor leaves element |

### Easing types

`EASE_IN`, `EASE_OUT`, `EASE_IN_AND_OUT`, `LINEAR`, `CUSTOM_BEZIER`

---

## Phase 2 — Verify Interactions

After creating interactions, verify completeness:

1. **Every button/CTA has reactions** — `node.reactions.length > 0`
2. **Every OVERLAY has at least one CLOSE trigger** — check X button AND Cancel button
3. **Bidirectional navigation** — if screen A links to B, verify B can return to A (BACK or explicit NAVIGATE)
4. **Starting points set** — `flowStartingPoints` is NOT settable via Plugin API. Must be set manually: right-click frame in Figma → "Add starting point"
5. **No orphan frames** — every screen is reachable (source or destination of at least one interaction)
6. **Test in prototype mode** — Cmd+Shift+Enter in Figma Desktop

Verify reactions after setting:
```js
const reactions = btn.reactions;
// Check: reactions.length > 0
// Check: reactions[0]?.actions?.[0]?.destinationId === expectedId
```

---

## Detection Checklist

### 1. Wrong transition type

> **Detect:** Transition type is not DISSOLVE, SMART_ANIMATE, or SCROLL_ANIMATE. **Severity:** CRITICAL.

Push, Slide, Move, Move In, Move Out fail silently via Plugin API. The reaction is set but the transition does nothing.

**Fix:** Replace with DISSOLVE (for overlays) or SMART_ANIMATE (for navigation).

### 2. `actions` vs `action`

> **Detect:** Code uses `action` (singular) instead of `actions` (plural array). **Severity:** CRITICAL.

API requires `actions: [...]` (array). Using singular `action` fails silently — no error, no reaction set.

**Fix:** Always use `actions: [{ ... }]` (plural, array of action objects).

### 3. Missing CLOSE on modal

> **Detect:** Frame opened as OVERLAY has no element with a CLOSE action. **Severity:** HIGH.

Users get trapped in the overlay with no way to dismiss it.

**Fix:** Add CLOSE to at least two elements — the X/close button AND any Cancel button.

### 4. Missing starting point

> **Detect:** No `flowStartingPoints` on the entry frame. **Severity:** HIGH.

`flowStartingPoints` is not settable via Plugin API (`Object.getOwnPropertyDescriptor` returns undefined). Prototype mode may not know where to begin.

**Fix:** Manual step — right-click the entry frame in Figma → "Add starting point". Note this in the output.

### 5. Orphan frames

> **Detect:** Frame has no reactions AND is not a `destinationId` of any other reaction. **Severity:** MEDIUM.

Screen exists but is unreachable in the prototype flow.

**Fix:** Wire it as a destination from another screen, or remove if unused.

### 6. Missing easing

> **Detect:** Transition config has no `easing` property. **Severity:** MEDIUM.

Transitions without easing look abrupt/jarring.

**Fix:** Add `easing: { type: "EASE_IN_AND_OUT" }` (navigation) or `easing: { type: "EASE_OUT" }` (overlays).

### 7. Missing await on setReactionsAsync

> **Detect:** `setReactionsAsync()` called without `await`. **Severity:** LOW.

Reaction may not be set before the next operation executes.

**Fix:** Always `await node.setReactionsAsync(...)`.

---

## Severity Reference

| Severity | Criteria |
|----------|----------|
| **CRITICAL** | Wrong transition type (fails silently); `action` singular instead of `actions` plural (fails silently) |
| **HIGH** | OVERLAY without CLOSE trigger (user trapped); missing starting point (prototype may not start) |
| **MEDIUM** | Orphan frame (unreachable screen); missing easing (jarring transition) |
| **LOW** | Missing await on async call (race condition risk) |

---

## Interaction Summary Template

```
### Interaction Summary

1. **Connections created**: {count} interactions across {count} frames
2. **Navigation**: {list of screen-to-screen connections}
3. **Overlays**: {list of overlay triggers + CLOSE handlers}
4. **Transition types used**: {DISSOLVE / SMART_ANIMATE / SCROLL_ANIMATE}
5. **Starting points**: {set manually / pending manual step}
6. **Orphan frames**: {none / list of unreachable frames}
7. **Detections**: {none / list with severity}
```

---

## Self-Check

Before producing the summary:

1. Every interaction pattern used is from the 3 validated patterns (A, B, C) — no invented API shapes
2. All transition types are from the valid set (DISSOLVE, SMART_ANIMATE, SCROLL_ANIMATE)
3. Every OVERLAY has a corresponding CLOSE
4. Starting point limitation is noted (manual step required)
5. `actions` (plural) used everywhere — never `action` (singular)
6. Every `setReactionsAsync` call uses `await`
