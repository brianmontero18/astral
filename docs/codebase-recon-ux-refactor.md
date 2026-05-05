# Codebase Reconnaissance — UX Refactor (2026-05-05)

> Mapa del estado actual del código relevante para el refactor de UX.
> No describe fixes — solo cómo está hoy. Referencia para no romper convenciones ni duplicar scaffolding.

## Frontend — Routing model

**`frontend/src/App.tsx`**
- `View` union: `"onboarding" | "chat" | "transits" | "assets" | "intake" | "report"` (en `types.ts`).
- `NavView = Exclude<View, "onboarding">`.
- Estado en React (no React Router, no URL fragment): `currentView`, `previousView` (capturado al entrar a intake/report — App.tsx:64,179-183).
- `handleNavigate(view)` (App.tsx:172-186): si entra a `intake` o `report` desde una tab principal, captura `previousView`. Si ya está dentro del flujo intake↔report, preserva el origen.
- Admin support routes (`/admin/users`, `/admin/users/:id`) usan `window.history.pushState()` y `popstate` (App.tsx:75-84,188-196).
- `handleGoToReport` (App.tsx:198-217): intenta `getReport(tier)`; si hay cacheado va a `report`, si no va a `intake`.
- `handleGenerateReport` (App.tsx:223-264): si ya hay reporte, abre `ConfirmModal` para confirmar regenerar; si no, llama `runGenerateReport`.
- `runGenerateReport` (App.tsx:233-263): persist intake con `updateCurrentUser`, luego `generateReport(tier)` con AbortController; setea loading + view "report".

## Frontend — NavBar

**`frontend/src/components/NavBar.tsx`**
- `TABS` array (líneas 19-23): `chat`, `transits`, `assets`. Tipos en `NavView`.
- Si `currentView` es `intake | report` → reemplaza tabs por un único botón `← Volver` (líneas 99-106).
- Sino → renderiza tabs + (admin) botón `Usuarios` (líneas 107-128).
- ProfilePanel se renderiza **solo dentro de NavBar** (línea 89-93). Su `showProfile` state vive en NavBar, cierre por `mousedown` outside (líneas 41-49).
- Logout: button con SVG `<path>` icon-only + `aria-label="Cerrar sesión"`.
- Admin link `Dashboard Auth` (líneas 61-68): `<a href="/auth/dashboard">` con clase `.admin-link-button`.

## Frontend — ProfilePanel

**`frontend/src/components/ProfilePanel.tsx`**
- Props: `{ profile: UserProfile; userPlan: AppUserPlan; onGenerateReport?: () => void }`.
- Layout: header (`✦ Perfil activo` kicker + name + description) → `.profile-grid` 6 fields (Plan, Tipo, Autoridad, Perfil, Estrategia, Definición) → `.profile-wide` (Cruz, No-Self, Definidos, Indefinidos, Canales chips) → botón gold "Generar mi informe" condicional.
- Solo renderiza un perfil; no hay concept de "switching" entre cartas.

## Frontend — IntakeView

**`frontend/src/components/IntakeView.tsx`**
- Props: `{ initialIntake?, submitLabel?, description?, secondaryAction?, onSubmit }`.
- 5 campos (`Intake`): `actividad*`, `desafio_actual*` (required), `tipo_de_negocio` (select), `objetivo_12m`, `voz_marca`.
- Reusable: usado en App.tsx (líneas 449-461) y en `OnboardingFlow` (step `intake`).
- Voice notes via `<VoiceRecorder>`.

## Frontend — ReportView

**`frontend/src/components/ReportView.tsx`**
- Props: `{ report, loading, onBack, onEditIntake?, intakeWarning? }`.
- `DesignReport.sections: ReportSection[]` con `id, title, icon, tier, staticContent, llmContent?, previewContent?, teaser?`.
- Cada sección renderiza una `<button>` para colapsar (NO usa `<h2>`).
- Page header pattern: kicker uppercase gold → headline serif → meta `<p>` → action `<button>`.
- Loading state: spinner SVG + "Generando tu informe…".

## Frontend — ChatView quick actions

**`frontend/src/components/ChatView.tsx`** líneas 95-100:
```ts
const QUICK_ACTIONS = [
  { label: "Reporte semanal completo", primary: true },
  { label: "¿Cómo está mi energía esta semana?" },
  { label: "¿Qué tránsitos me afectan hoy?" },
];
```
- Click → `sendMessage(label, ...)`. Manda como mensaje normal del usuario al `/api/chat/stream`.
- No hay routing especial: el agente backend interpreta la intención.

## Frontend — TransitViewer

**`frontend/src/components/TransitViewer.tsx`**
- Fetch `getTransits(userId)` → `{ planets, activatedChannels, impact? }`.
- Grid 2 cols desktop / 1 col mobile (CSS).
- Cada planet card: glyph + nombre + sign + grado + puerta + línea + chip "✦ Activa tu Puerta X" (gold) si toca el bodygraph del usuario.
- Tres bloques debajo del grid (todos colapsables):
  - "Canales activados por tránsitos" (colectivo)
  - "Canales personales activados" (intersección con bodygraph)
  - "Puertas reforzadas"
- Click → expand individual de cards (no nav fuera de la vista).

## Frontend — AssetViewer

**`frontend/src/components/AssetViewer.tsx`**
- State: `assets[]`, `previewAsset`, `pendingDeleteId`, `uploading`, `deleting`.
- `AssetMeta`: `{ id, filename, mimeType, fileType, sizeBytes, createdAt }`.
- **No hay flag `is_active` ni `is_primary` en assets**. El backend usa el último profile extraído.
- Botones: `Ver` (preview modal), `Eliminar` (confirm modal).

## Frontend — Convenciones

- Archivos PascalCase. Named exports (no defaults).
- Sin barrel `index.ts` en `components/`.
- Components < 400 líneas (los grandes están en revisión).
- Voseo informal en copy (`tenés`, `podés`, `querés`).
- Inline styles para variantes locales + utility classes en `index.css`.

## Frontend — CSS tokens (`index.css`)

- Vars en `:root`: paleta forest/cream/gold/sage + tokens semánticos (`--surface-dark`, `--text-main`, `--color-primary`, etc.).
- Layout crítico (CLAUDE.md): root `height: 100vh + overflow: hidden`, flex children con `minHeight: 0`, vista interna `flex: 1 + overflowY: auto + maxWidth: 760 + margin: 0 auto`.
- Animaciones: `fadeIn`, `fadeInSlow`, `pulse`, `spin`.
- Clases relevantes: `.glass-panel`, `.glass-panel-gold`, `.btn-primary`, `.btn-secondary`, `.app-shell-header`, `.app-nav`, `.app-nav-item`, `.profile-panel`, `.profile-grid`, `.profile-wide`, `.profile-field`, `.intake-card`, `.intake-stage`, `.transit-planet-grid`, `.asset-empty`, `.chat-quick-action`, `.chat-quick-action--primary`.

### DESIGN.md violations encontrados

- `.profile-panel` (`index.css:2027`) tiene `box-shadow: 0 18px 44px rgba(33, 41, 30, 0.32)` → DESIGN.md prohíbe drop shadows en cards.
- `.intake-card` (`index.css:2130`) tiene `box-shadow: 0 24px 56px rgba(33, 41, 30, 0.22)` → idem.

## Backend — Rutas (`backend/src/routes/*`)

| Ruta | Método | Archivo |
|---|---|---|
| `/api/health` | GET | `health.ts` |
| `/api/users` | POST | `users.ts` |
| `/api/me` | GET, PUT | `users.ts` |
| `/api/me/onboarding` | PATCH | `users.ts` |
| `/api/me/assets` | POST, GET | `assets.ts` |
| `/api/assets/:id` | GET, DELETE | `assets.ts` |
| `/api/chat`, `/api/chat/stream` | POST | `chat.ts` |
| `/api/me/messages` | GET, DELETE | `chat.ts` |
| `/api/messages/:id/feedback` | POST | `chat.ts` |
| `/api/transits` | GET | `transits.ts` |
| `/api/extract-profile` | POST | `extract.ts` |
| `/api/me/report` | GET, POST | `report.ts` |
| `/api/me/report/pdf` | GET | `report.ts` |
| `/api/me/report/share` | POST | `report.ts` |
| `/api/transcribe` | POST | `transcribe.ts` |
| `/api/admin/users` | GET, POST | `users.ts` |
| `/api/admin/users/:id` | DELETE, GET | `users.ts` |
| `/api/admin/users/:id/access` | PATCH | `users.ts` |
| `/api/admin/users/:id/llm-usage` | GET | `users.ts` |

## Backend — DB schema relevante

**users**: id, name, email, profile (JSON), intake (JSON), memory_md, plan, role, status, onboarding_status, onboarding_step, access_source, created_at, updated_at.

**assets**: id, user_id, filename, mime_type, file_type, size_bytes, storage_key (R2 path), created_at. **No hay `is_active` / `is_primary`**.

**chat_messages**: id, user_id, role, content, created_at, feedback (JSON nullable).

**reports**: cache por (user_id, tier, profile_hash), guarda sections (JSON), tokens_used, cost_usd, created_at.

**transit_cache**: por semana ISO, JSON con planets/channels.

**user_identities**: provider + provider_user_id → astral_user_id (linking SuperTokens ↔ users).

## Backend — Tests

`backend/src/__tests__/*.test.ts` (~41 archivos, vitest).
- Naming: `{area}-{feature}.test.ts` o `api-{recurso}-{accion}.test.ts`.
- Mocking: `vi.mock()`, `vi.spyOn()`. Sin global setup detectado.

## E2E — Specs

`e2e/specs/*.spec.ts` (27 archivos):
01 chat-send, 02 copy, 03 edit, 04 voice-notes, 05 freemium-limits, 06 db-consistency, 07 report-first-generation, 08 report-cache, 09 intake-persistence, 10 pdf-share, 11 regeneration, 12 auth-resilience, 13 mobile-core-surfaces, 14 plan-upgrade, 15-16 admin-support, 17 auth-bootstrap, 18 onboarding-assets, 19 passwordless, 20 transits-weekly, 21 navigation-state, 22 profile-panel-visibility, 23 layout-stability, 24 onboarding-intake-step, 25 admin-invite, 26 admin-delete, 27 magic-link-auto-login.
- Selectors: principalmente `getByRole` / `getByText` (Kent C. Dodds style); algunos `data-testid`.
- Mock API: `e2e/mock-api/` (referenciado en beads memories).

## Patrones / cosas que NO romper

1. **Layout flex** (CLAUDE.md crítico): `minHeight: 0` propaga overflow.
2. **previousView tracking** (App.tsx:172-186): condición `if (view === "intake" || view === "report")`.
3. **ProfilePanel es monolítico en NavBar**: extraerlo a otro lugar implica mover state up.
4. **`ReportSection` shape**: `id, tier, staticContent, llmContent, teaser`. Renderer en `ReportView.tsx:134-246`.
5. **Chat SSE format strict**: `data: {...}\n\n`, buffer parser en `api.ts:170-206`.
6. **Asset model sin `is_active`**: agregar UI active/historical implica decisión: feature UI-only (heurística cliente) vs migración + columna nueva.

## Feature flags

- `FLAGS.MEMORY_LIVING_DOCUMENT` (backend, chat.ts:64).
- `FLAGS.LLM_TELEMETRY` (backend, chat.ts:79).
- Importados de `backend/src/config/flags.ts`.
