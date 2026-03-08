---
name: prototype-setup
type: reference
description: "Guide new prototype creation with @proto/components, detect critical Tailwind v4 + tsconfig gotchas"
argument-hint: "<project-name> — new prototype to scaffold or verify existing setup"
---

# Prototype Setup Skill

> **Purpose**: Scaffold new prototypes and detect setup gotchas with `@proto/components` + Tailwind v4 + Vite.
> **Invoked by**: executor, user.
> **Source of truth**: `~/toolkit/docs/prototype-development-guide.md`

---

## When to Use

- Creating a new prototype under `~/prototypes/`
- Verifying an existing prototype's Vite/TS/Tailwind configuration
- Debugging "classes in DOM but no visual effect" symptoms
- Adding `@proto/components` to a project for the first time

## When NOT to Use

- Building production apps (use `executor` with project-specific stack)
- Designing component APIs for the shared library (use `architect`)
- Nordic/Material UI projects (this skill is Tailwind v4 only)

---

## Quick Start

Read `~/toolkit/docs/prototype-development-guide.md` first, then execute these steps:

1. **Scaffold**: `cd ~/prototypes && npm create vite@latest <name> -- --template react-ts`
2. **Install deps**: `cd <name> && npm install && npm install -D @tailwindcss/vite tailwindcss @types/node`
3. **Vite alias**: Add `resolve.alias` mapping `@proto/components` to `path.resolve(__dirname, '../components/src')` in `vite.config.ts`. Add `tailwindcss()` plugin.
4. **TS paths**: Add `baseUrl: "."` and `paths: { "@proto/components": ["../components/src/index.ts"] }` to `tsconfig.app.json` compilerOptions.
5. **Tailwind source**: Add `@source "../../components/src";` after `@import "tailwindcss";` in `src/index.css`.
6. **Verify**: `npx tsc -b --noEmit && npx vite build`

---

## Detection Checklist

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Missing `@source "../../components/src"` in `index.css` | CRITICAL | Add `@source "../../components/src";` after `@import "tailwindcss";`. Without it, Tailwind v4 silently ignores component library classes. Symptom: classes in DOM but `padding: 0px`. |
| 2 | `../components/src` in tsconfig `include` instead of `paths` | HIGH | Remove from `include`. Add `baseUrl` + `paths` to compilerOptions. The `include` approach causes "Cannot find module 'react'" errors. |
| 3 | Missing `@types/react` + `@types/react-dom` in `components/package.json` devDeps | HIGH | `cd ~/prototypes/components && npm i -D @types/react @types/react-dom`. Required for tsc to resolve React types when following path aliases. |
| 4 | Vite alias not configured for `@proto/components` | MEDIUM | Add `resolve.alias` in `vite.config.ts` mapping to `../components/src`. Without it, imports from `@proto/components` fail at runtime. |
| 5 | Dev server port conflict (5173 in use) | MEDIUM | Use `npx vite --host --port 5174` (or next available). Multiple prototypes or Voicebox may compete for 5173. |
| 6 | Missing `contentPadding` customization on AppShell | LOW | Pass `contentPadding` prop to `<AppShell>`. Default is `'px-14 py-10'`. Customize per prototype as needed. |

---

## Verification Checklist

After scaffolding or modifying configuration, run all three:

```bash
cd ~/prototypes/<name>
npx tsc -b --noEmit        # Must pass with zero errors
npx vite build              # Must produce dist/ successfully
npx vite --port 5174        # Open browser, verify layout visually
```

If padding/spacing looks wrong: check detection #1 first, then inspect computed styles in DevTools.

---

## Available Components

From `@proto/components` (`~/prototypes/components/src/`):

| Component | Purpose |
|-----------|---------|
| `AppShell` | Header + sidebar + content slot (accepts `contentPadding` prop) |
| `DataTable` | Generic column-based table with render props |
| `Modal` | Overlay dialog with header/body/footer slots |
| `ConfirmDialog` | Destructive action confirmation |
| `SummaryCard` | Metric display card |
| `StatusBadge` | Colored status indicator |
| `ActionMenu` | Dropdown action menu |

| Utility | Purpose |
|---------|---------|
| `fmt(n)` | Compact format: `18000000` → `"18.0M"` |
| `fmtFull(n)` | Full format: `18000000` → `"$18,000,000"` |
| `loadData(key, defaults)` | Load from localStorage (returns `defaults` if empty) |
| `saveData(key, data)` | Save to localStorage |

Types: `NavItem`, `Column` (exported from barrel).

---

## Severity Reference

| Level | Meaning |
|-------|---------|
| CRITICAL | Silent failure. App renders but layout/styles are broken with no error message. |
| HIGH | Build or type-check fails. Blocks development until resolved. |
| MEDIUM | Runtime import failure or DX friction. Noticeable immediately. |
| LOW | Suboptimal defaults. Works but could be better. |

---

## Self-Check

Before producing the summary, verify:
1. All 6 detections evaluated against the target project
2. `tsc -b --noEmit` passes (or errors documented)
3. `vite build` succeeds (or errors documented)
4. `@source` directive present in `index.css`
5. Visual check performed or documented as pending

---

## Summary Template

```
### Prototype Setup: {project-name}
- **Location**: ~/prototypes/{project-name}
- **@source directive**: {present/MISSING}
- **TS paths config**: {correct/WRONG — uses include}
- **Vite alias**: {configured/MISSING}
- **@types/react in components**: {installed/MISSING}
- **tsc -b --noEmit**: {pass/fail}
- **vite build**: {pass/fail}
- **Visual check**: {pass/pending/fail}
- **Issues found**: {list or "none"}
```
