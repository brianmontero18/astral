---
name: nordic-specialist
type: reference
description: Expert on MercadoLibre Nordic framework — pages, islands, modules, styling. Uses frontender-web-mcp for live docs. Use when building or modifying MeLi frontend code.
---

# Nordic Specialist Skill

> **Purpose**: Expert guidance on Nordic framework for MeLi frontends.
> **Reference**: `~/toolkit/docs/nordic-manual.md` — state of the art snapshot.
> **MCP**: `frontender-web-mcp` — Nordic modules + specs en tiempo real.
> **Invoked by**: user, executor, architect, or any agent working with MeLi frontend code.

---

## When to Use

- Building or modifying Nordic pages or islands
- Configuring Nordic modules (restclient, i18n, auth, melidata, etc.)
- Debugging SSR, hydration, or styling issues
- Choosing between Pages vs Islands architecture
- Working with WebView/native integration

## When NOT to Use

- Backend Go code (use `golang-pro`)
- Non-MeLi React projects (use `react-patterns`)
- Figma design work (use `figma-design-ops`)
- Feature flags (use `feature-flags-specialist`)

---

## Process

0. **Freshness check**: Run `~/toolkit/scripts/tool-freshness.sh nordic`. If stale (exit 1), consult the MCP tools directly for the section relevant to your task. Update the manual and `last_refreshed` in `config/tools.json` after refreshing.
1. **Read** `~/toolkit/docs/nordic-manual.md` for framework rules and module index
2. **Consult MCP** for real-time details — the manual is a cache, the MCP is the source of truth:
   - `nordic-specifications` for module index
   - `nordic-modules` for specific module docs
   - `version` to detect project versions
3. **Check** detection rules below against the current code
4. **Apply** changes following Nordic conventions
5. **Update** the manual if something changed

---

## Detection Rules

| # | Detect | Severity | Fix |
|---|--------|----------|-----|
| 1 | Native `<img>` tag in Nordic code | BLOCKER | Use `<Image>` from `nordic/image` |
| 2 | Native `<link>`, `<script>`, `<title>` tags | BLOCKER | Use `<Style>`, `<Script>`, `setTitle()` |
| 3 | `import` of `.scss/.css` in JSX | BLOCKER | Nordic auto-injects styles. Remove manual imports |
| 4 | `fetch` or `axios` instead of restclient | BLOCKER | Use `nordic/restclient` for ALL HTTP |
| 5 | `useI18n()` hook | BLOCKER | Removed. Use `getI18n()` instead |
| 6 | `i18nMiddleware` | WARNING | Deprecated. Use `createNordicI18nMiddlewares()` |
| 7 | `process.env` in app code | BLOCKER | Use `nordic/env` module |
| 8 | `localStorage` / `sessionStorage` direct | BLOCKER | Use `nordic/storage` for cross-platform compat |
| 9 | `<html>`, `<head>`, `<body>` tags | BLOCKER | Already in Nordic layout. Remove. |
| 10 | `getPlatformType()` used for business domain | BLOCKER | Returns OS, not domain. Use `req.platform` |
| 11 | Auth not explicitly applied | WARNING | `authMiddleware()` is NOT automatic. All pages are public by default |
| 12 | Next.js patterns (getStaticProps, app router, etc.) | BLOCKER | Nordic is NOT Next.js. Use getServerSideProps, nordic-pages/ |
| 13 | `nordic/lazy` usage in new code | WARNING | Deprecated. Use `React.lazy` + `Suspense` |

---

## Refresh Mode

**Last refreshed**: 2026-03-07

This tool refreshes primarily via MCP, not web scraping. The `frontender-web-mcp` provides live docs.

To update the knowledge snapshot:

1. Call `mcp__frontender-web-mcp__nordic-specifications` — check for new modules, changed rules
2. Call `mcp__frontender-web-mcp__nordic-modules-list` — check for new/removed modules
3. Compare findings with `~/toolkit/docs/nordic-manual.md`
5. Update changed sections in the manual
6. Update "Last refreshed" date in this skill and manual

**No web scraping needed** — the MCP is the authoritative source.

---

## Quick Reference

| I want to... | Where to look |
|--------------|--------------|
| Build a Nordic page | Manual -> Nordic Pages + MCP `nordic-modules` with "pages" |
| Use Islands | Manual -> Nordic Islands + MCP `nordic-modules` with "islands" |
| Find a module | Manual -> Módulos Nordic (tables) |
| Detect project versions | MCP `version` tool |
| Debug SSR issues | Manual -> Server vs Client boundaries |
| Style a page | Manual -> Styles (auto-injected) + SCSS BEM |
