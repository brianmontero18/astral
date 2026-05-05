# Plan de Refactor UX — Astral (2026-05-05)

> Plan ejecutable derivado de `docs/ux-audit-2026-05.md` y `docs/codebase-recon-ux-refactor.md`.
> Aprobado por brian@meli — opción A (tab Informe nuevo, con fallback a B si mobile rompe).

## Reglas operativas

- **Tracking**: beads (1 epic + 11 slices). `bd update --claim` al empezar, `bd-close.sh` al cerrar.
- **Tests**: ajusto E2E + unit relevantes pero no los corro (vitest no instalable en esta máquina). Marca `// AUDIT: requires verification after install` solo si hay lógica nueva no probada.
- **Validación post-cada-slice**: Playwright MCP en `1440×900` (desktop) y `390×844` (mobile). Capturas before/after.
- **Voseo informal** preserved. Sin emojis decorativos (DESIGN.md L370-371).
- **Sin migraciones DB** salvo justificación al inicio del slice.
- **Commits**: 1 por slice, con `Co-Authored-By: Claude Sonnet 4.6 (1M context)` trailer.

## Decisión clave (slice 11)

**Opción A** elegida: tab "Informe" nuevo entre Chat y Tránsitos. Si en mobile a 390px rompe layout (4 tabs + Usuarios = 5 pills no entran), fallback a opción **B**: mover "Mis Cartas" al ProfilePanel/profile route.

## Orden de ejecución

```
1.  ux-1-css-hygiene              (XS, P2)  ← lowest-risk para validar setup
2.  ux-2-report-chevrons-svg       (S, P2)
3.  ux-3-report-headings-toc       (M, P2)
4.  ux-4-intake-niche-fit          (S, P1)
5.  ux-5-cartas-transitos-voz      (XS, P2)
6.  ux-6-navbar-tabs-volver        (S, P1)
7.  ux-7-chat-quick-action-report  (S, P0)
8.  ux-8-profilepanel-mobile-cta   (M, P0/P1)
9.  ux-9-mis-cartas-en-uso         (M, P2)
10. ux-10-transits-chat-handoff    (M, P0)
11. ux-11-informe-tab-primer-nivel (M, P0)
```

## Slices — scope concreto

### Slice 1: CSS hygiene

**Cambios**:
- `frontend/src/index.css:2027` — quitar box-shadow de `.profile-panel`. Reforzar borde gold subtle.
- `frontend/src/index.css:2130` — quitar box-shadow de `.intake-card`. Mantener borde + contraste tonal.

**Tests**: ninguno. **Validación**: capturas dropdown + intake.

### Slice 2: Chevrons SVG en ReportView

**Cambios**:
- `frontend/src/components/ReportView.tsx` — reemplazar `▾` Unicode por SVG inline (`stroke-width: 1.7`, rotación CSS).
- `aria-expanded` en cada toggle.

**Tests**: revisar `e2e/specs/07-report-first-generation.spec.ts`, `08-report-cache-first-loading.spec.ts`.

### Slice 3: Report headings + TOC pegado

**Cambios**:
- `ReportView.tsx` — wrappear titles en `<h2>`.
- `<nav aria-label="Secciones del informe">` con anchor links. Desktop: sticky lateral. Mobile: pill bar horizontal scroll-snap.
- IDs `section-${section.id}`.
- Clases `.report-toc`, `.report-toc--mobile` en `index.css`.

**Tests**: E2E `07-report-first-generation.spec.ts` agregar TOC assertions.

### Slice 4: Intake niche-fit

**Cambios**:
- `IntakeView.tsx` — `tipo_de_negocio` agrega `"Sin negocio aún"` (default). "Mentora" deja de ser default.
- Reformular labels: `¿A qué dedicás tu energía hoy?`. Tipo negocio con copy condicional.
- `types.ts` — `TipoNegocio` agrega `"none"`.
- `backend/src/agent-service.ts` — prompt tolera caso "sin negocio".

**Tests**: E2E `09-report-intake-persistence.spec.ts`. Backend `__tests__/api-report*.test.ts`.

### Slice 5: Voz unificada (Cartas + Tránsitos header)

**Cambios**:
- `AssetViewer.tsx` — botones `Ver` / `Eliminar` sentence-case (sin uppercase fuerte).
- `TransitViewer.tsx` — date label `4 — 10 May · 2026` (capitalized o full uppercase tracked).

**Tests**: E2E `20-transits-weekly-view.spec.ts`.

### Slice 6: NavBar tabs + Volver complementario

**Cambios**:
- `NavBar.tsx:99-129` — eliminar la condicional. Tabs siempre visibles + botón `← Volver` arriba o como leading icon cuando `currentView ∈ {intake, report}`.
- Mobile: probar que 3-4 botones + Volver entran a 390px.

**Tests**: E2E `21-navigation-state-preservation.spec.ts`.

### Slice 7: Chat quick action → ReportView

**Cambios**:
- `ChatView.tsx:96-100` — separar quick actions:
  - CTA gold: `"Ver mi informe semanal"` → `onOpenReport()` (prop nueva).
  - Conversational: `"¿Cómo está mi energía esta semana?"`, `"¿Qué tránsitos me afectan hoy?"`, `"Conversemos sobre la semana"`.
- `App.tsx` — pasa `onOpenReport={handleGoToReport}` a ChatView.

**Tests**: E2E `01-chat-send-message.spec.ts`. Test nuevo: CTA gold abre Report.

### Slice 8: ProfilePanel mobile sheet + CTA arriba

**Cambios**:
- `ProfilePanel.tsx` — reordenar: header → CTA gold "Ver mi informe" → grid + wide.
- `index.css` — `@media (max-width: 540px)` convierte panel en bottom-sheet (slide-up, max-height 80vh, border-radius top corners).
- Backdrop tap-to-close en mobile.

**Tests**: E2E `22-profile-panel-visibility.spec.ts`.

### Slice 9: Mis Cartas — pill "EN USO"

**Decisión**: sin migración DB. Backend deriva activo comparando `profile_hash` o tomando el `fileType="hd"` más reciente.

**Cambios**:
- `backend/src/db.ts` — helper `getActiveAssetId(userId)`.
- `backend/src/routes/assets.ts` — `GET /api/me/assets` retorna `assets[].isActive`.
- `frontend/src/types.ts` — `AssetMeta.isActive: boolean`.
- `AssetViewer.tsx` — pill `EN USO` (gold subtle), sort: activo primero.

**Tests**: backend `__tests__/api-assets.test.ts`. E2E `18-onboarding-and-assets-resilience.spec.ts`.

### Slice 10: Tránsitos × Chat handoff

**Cambios**:
- `TransitViewer.tsx` — mini-CTA por planet card con chip "✦ Activa tu Puerta X": `"Preguntale al agente sobre Puerta X"`. Callback `onAskAgent(prefill: string)`.
- También en los 3 bloques de impacto.
- `App.tsx` — state `chatPrefill: string | null`. Setea + navega a `chat`.
- `ChatView.tsx` — prop `prefill?: string | null`. Rellena textarea sin auto-submit.

**Tests**: E2E `20-transits-weekly-view.spec.ts`.

### Slice 11: Tab "Informe" primer nivel

**Cambios**:
- `types.ts` — `NavView` agrega `"report"` (View ya lo tiene).
- `NavBar.tsx:19-23` — TABS agrega `{ key: "report", label: "Informe" }` entre chat y transits.
- `App.tsx:172-186` — handleNavigate desde tab "report" llama `handleGoToReport()` (decide cache vs intake).
- Mobile: si saturado, fallback a opción B.

**Tests**: E2E `21-navigation-state-preservation.spec.ts`, `13-mobile-core-surfaces.spec.ts`.

## Out-of-scope (esta tanda)

- Migración DB para `is_active` en assets (slice 9 lo evita).
- Densidad cards Personas admin.
- "Compartir" enriquecido con preview.
- "Dashboard Auth" reposicionar (solo si NavBar satura en slice 11).
- VoiceRecorder UX.
- Ritualización del informe con permalinks.
