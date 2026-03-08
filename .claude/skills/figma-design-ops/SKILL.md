---
name: figma-design-ops
type: internal
description: "Create native Figma designs from Claude Code via figma-console MCP + Desktop Bridge"
argument-hint: "<design-description> — what to create in Figma"
---

# Figma Design Ops

> **Purpose**: Create native Figma designs programmatically via `figma_execute` (figma-console MCP + Desktop Bridge).
> **Invoked by**: agents doing design-to-Figma, users requesting Figma prototypes.
> **Source**: `docs/figma-claude-code-integration.md`, `docs/figma-setup-guide.md`

---

## Phase 1: Pre-flight

Verify connection and load resources before any creation.

1. **Check Desktop Bridge** — call `figma_get_status`. If disconnected, stop and instruct: "Run the Desktop Bridge plugin in Figma Desktop (Plugins > Development > Figma Desktop Bridge)."
2. **Check open files** — call `figma_list_open_files`. Confirm target file is active. If no file is open, stop.
3. **Load fonts** — execute `figma.loadFontAsync()` for EVERY variant you will use. Each is a separate async call:
   ```js
   await figma.loadFontAsync({family: "Inter", style: "Regular"});
   await figma.loadFontAsync({family: "Inter", style: "Medium"});
   await figma.loadFontAsync({family: "Inter", style: "Semi Bold"});
   await figma.loadFontAsync({family: "Inter", style: "Bold"});
   ```
   Bold, Semi Bold, Medium, and Regular are distinct loads. Missing one silently fails or throws.

---

## Phase 2: Frame Creation

Build structure top-down: page > frame/section > children. Each `figma_execute` call must be self-contained (load fonts, get refs, do work inside one call).

### Auto-layout rules

| Rule | Why |
|------|-----|
| Append child BEFORE setting `layoutSizingHorizontal = 'FILL'` | FILL only works on children of auto-layout frames. Order: `parent.appendChild(child)`, then set FILL. |
| Set `textAutoResize = 'WIDTH_AND_HEIGHT'` on all text nodes | Prevents text clipping inside auto-layout containers. |
| Use `layoutSizingVertical = 'FIXED'` with explicit height on main frames | Hug-contents frames collapse to 0px with no children yet. |
| Set `itemSpacing` on row frames | Prevents cell text from merging (e.g., "Creado porFecha"). |

### Color values

Use `figma.util.rgb()` or manual `{r, g, b}` with values 0-1 (NOT 0-255):
```js
const gray50  = {r: 0.976, g: 0.980, b: 0.984};  // #F9FAFB
const gray900 = {r: 0.067, g: 0.094, b: 0.153};  // #111827
```

### Table layout

- Cells need explicit `resize(width, height)` before auto-layout infers widths.
- Add `itemSpacing` on rows to separate columns.

### Prototype interactions

For wiring interactions between frames (navigation, overlays, close triggers), use the **figma-proto-interactions** skill. It owns all `setReactionsAsync` patterns, API reference tables, and interaction detections.

### Screenshot validation loop

After each complex frame, call `figma_capture_screenshot` (plugin API, immediate). Check for:
- Text clipped or overlapping
- Layout collapsed to 0px
- Wrong alignment or spacing
- Missing children

Fix and re-screenshot. **Max 3 iterations per frame.** If still broken after 3, report the issue and move on.

---

## Phase 3: Verification

After all frames are created:

1. `figma_capture_screenshot` each screen/frame.
2. Check: text not clipped, layout not collapsed, correct alignment, auto-layout containers have expected sizing.
3. Verify prototype interactions: `node.reactions.length > 0` and `reactions[0]?.actions?.[0]?.destinationId` matches target.
4. Report results with frame names and any remaining issues.

---

## Detection Checklist

### 1. Font not loaded

> **Detect:** Text operation fails silently or throws "font not loaded". **Severity:** CRITICAL.

**Fix**: Call `figma.loadFontAsync({family, style})` for EACH variant. Bold is not Semi Bold is not Medium is not Regular.

### 2. FILL on orphan

> **Detect:** `layoutSizingHorizontal = 'FILL'` set before `appendChild`. **Severity:** CRITICAL.

**Fix**: Always `parent.appendChild(child)` first, then `child.layoutSizingHorizontal = 'FILL'`.

### 3. Frame collapse

> **Detect:** Hug-contents frame renders at 0px height. **Severity:** HIGH.

**Fix**: Set `layoutSizingVertical = 'FIXED'` with explicit height on the frame, or ensure children are appended before the frame renders.

### 4. Text clipping

> **Detect:** Text truncated in auto-layout containers. **Severity:** HIGH.

**Fix**: Set `textAutoResize = 'WIDTH_AND_HEIGHT'` on all text nodes.

### 5. SPACE_BETWEEN crush

> **Detect:** `primaryAxisAlignItems = 'SPACE_BETWEEN'` crushes child frames to 0. **Severity:** HIGH.

**Fix**: Ensure one expanding child has `layoutSizingHorizontal = 'FILL'`.

### 6. Table cells without resize

> **Detect:** Column widths unpredictable in table layouts. **Severity:** MEDIUM.

**Fix**: Call `cell.resize(width, height)` on each cell before appending to auto-layout row.

### 7. createSection() unavailable

> **Detect:** `figma.createSection is not a function`. **Severity:** MEDIUM.

**Fix**: Use `figma.createFrame()` as container instead.

### 8. getNodeById() not a function

> **Detect:** `Cannot call with documentAccess: dynamic-page`. **Severity:** MEDIUM.

**Fix**: Use `figma.getNodeByIdAsync()` (async version).

### 9. Screenshot stale

> **Detect:** `figma_take_screenshot` returns old state after changes. **Severity:** LOW.

**Fix**: Use `figma_capture_screenshot` (plugin API, reflects immediate changes) instead of `figma_take_screenshot` (REST API, cached).

---

## Color Reference (Tailwind defaults)

| Name | Hex | Figma RGB (0-1) |
|------|-----|-----------------|
| gray-50 | #F9FAFB | 0.976, 0.980, 0.984 |
| gray-100 | #F3F4F6 | 0.953, 0.957, 0.965 |
| gray-200 | #E5E7EB | 0.898, 0.906, 0.922 |
| gray-300 | #D1D5DB | 0.820, 0.835, 0.859 |
| gray-500 | #6B7280 | 0.420, 0.447, 0.502 |
| gray-700 | #374151 | 0.216, 0.255, 0.318 |
| gray-900 | #111827 | 0.067, 0.094, 0.153 |
| blue-500 | #3B82F6 | 0.231, 0.510, 0.965 |
| blue-600 | #2563EB | 0.145, 0.388, 0.922 |
| amber-500 | #F59E0B | 0.961, 0.620, 0.043 |
| green-500 | #22C55E | 0.133, 0.773, 0.369 |
| red-500 | #EF4444 | 0.937, 0.267, 0.267 |
| white | #FFFFFF | 1.0, 1.0, 1.0 |

---

## Severity Reference

| Severity | Meaning | Action |
|----------|---------|--------|
| CRITICAL | Design will not render or silently produce wrong output | Must fix before proceeding |
| HIGH | Layout broken, content invisible or misaligned | Fix in current iteration |
| MEDIUM | Suboptimal but functional | Fix if within iteration budget |
| LOW | Cosmetic or convenience issue | Note for manual fix |

---

## Summary Template

```
## Figma Design Ops — Summary

**File**: {figma file name}
**Frames created**: {count}
**Interactions**: {count navigate + count overlay + count close}
**Iterations used**: {n}/3 per frame

| Check | Result |
|-------|--------|
| Desktop Bridge connected | PASS/FAIL |
| Fonts loaded | PASS/FAIL ({variants}) |
| Text clipping | PASS/FAIL |
| Layout collapse | PASS/FAIL |
| Prototype interactions | PASS/FAIL |
| Screenshot validation | PASS/FAIL |

**Issues**: {list or "None"}
```

---

## Self-check

Before producing the summary, verify:

1. Pre-flight passed (connection + fonts).
2. Every frame was screenshot-validated.
3. No text node is missing `textAutoResize`.
4. No FILL was set before appendChild.
5. Prototype interactions have correct `destinationId`.
6. All detection categories were evaluated.

If any check fails, fix before presenting the summary.
