# UAT Coverage Audit

Fecha: 2026-05-24

Scope:
- Snapshot de cobertura UAT funcional contra el árbol actual.
- Reconciliación de nombres de tests y specs existentes.
- Señal estructural de CodeGraph/Sentrux para distinguir UAT cubierto de cobertura de source files.

## Executive Summary

- La matriz UAT funcional sigue bien cubierta para las superficies core: auth/onboarding, chat, report, transits, assets, admin, mobile y copy segura.
- Este doc ya no afirma "cobertura total" en sentido estructural: CodeGraph detecta más source files sin test directo que superficies UAT sin coverage.
- El inventario previo estaba stale: refería tests inexistentes y contaba menos archivos de los que existen hoy.
- Riesgo principal actual: drift documental y breadth futura, no un contrato P0 UAT conocido sin test.

## Inventario Actual

- Backend tests bajo `backend/src/__tests__`: 63 archivos.
- Tests adicionales fuera de `__tests__`: `backend/src/hd-pdf/pdf-fixtures.test.ts` y `frontend/vite.config.test.ts`.
- Playwright specs bajo `e2e/specs`: 29 archivos.
- CodeGraph/Sentrux snapshot 2026-05-24: 374 archivos escaneados, 537 import edges, layering limpio, 280 source files, 94 test files, 93 source files con señal de test directo, 187 sin esa señal.

Interpretación: la UAT funcional puede estar cubierta aunque CodeGraph marque source files sin test directo. No usar este audit como coverage report de líneas o ramas.

## Cobertura UAT Por Superficie

| Superficie | Estado | Evidencia principal |
|---|---|---|
| Auth + bootstrap/restore | covered | `api-me.test.ts`, `api-users.test.ts`, `auth-*.test.ts`, `17-auth-bootstrap-and-restore.spec.ts`, `19-auth-passwordless-flow.spec.ts` |
| Onboarding + birth data | covered | `api-onboarding-state.test.ts`, `api-assets.test.ts`, `28-onboarding-birth-data.spec.ts`, `24-onboarding-intake-step.spec.ts` |
| Chat send/stream/history/limits | covered | `api-chat.test.ts`, `api-chat-context-budget.test.ts`, `anti-hallucination-hd.test.ts`, `01-chat-send-message.spec.ts`, `03-chat-edit-message.spec.ts`, `05-chat-freemium-limits.spec.ts`, `28-chat-streaming-scroll.spec.ts` |
| Voice/transcribe | covered | `api-transcribe.test.ts`, `04-chat-voice-notes.spec.ts` |
| Report generate/read/share/pdf | covered | `api-report.test.ts`, `report-generation.test.ts`, `frontend-report-view-model.test.ts`, `07-report-first-generation.spec.ts`, `08-report-cache-first-loading.spec.ts`, `09-report-intake-persistence.spec.ts`, `10-report-pdf-share.spec.ts`, `11-report-regeneration.spec.ts` |
| Transits | covered | `api-transits.test.ts`, `transit-service.test.ts`, `transit-impact.test.ts`, `frontend-transit-adapter.test.ts`, `20-transits-weekly-view.spec.ts` |
| Assets + R2 adapter | covered | `api-assets.test.ts`, `storage-r2.test.ts`, `frontend-asset-errors.test.ts`, `18-onboarding-and-assets-resilience.spec.ts` |
| Admin | covered | `api-admin-users-invite.test.ts`, `api-admin-users-delete.test.ts`, `admin-invite-email.test.ts`, `frontend-admin-support.test.ts`, `15-admin-support-copy.spec.ts`, `16-admin-support-flow.spec.ts`, `25-admin-invite-flow.spec.ts`, `26-admin-delete-user.spec.ts` |
| Mobile/layout/navigation | covered | `13-mobile-core-surfaces.spec.ts`, `21-navigation-state-preservation.spec.ts`, `22-profile-panel-visibility.spec.ts`, `23-layout-stability-overlays.spec.ts` |
| MCP gated surface | covered for current gated contract | `api-mcp.test.ts`, `mcp-auth.test.ts`, `mcp-oauth.test.ts`, `mcp-schema-migration.test.ts`, `api-workos-connect.test.ts` |

## Gaps / Flags

- **Structural coverage gap:** CodeGraph marks 187 source files without direct test signal. Treat as prioritization input, not a failing UAT criterion.
- **UI render depth:** many frontend guarantees are covered through Playwright and helper/view-model tests; there is no broad component-unit suite.
- **Historical docs:** older research/planning docs may intentionally preserve past states. Current-state assertions should live in `docs/architecture/project-overview.md` and linked sub-docs.

## Validation Commands

```bash
npm run check:docs
cd backend && npx tsc --noEmit
cd backend && npx vitest run
```

Run Playwright only when touching UX, routing, mocks, auth runtime, report, transits, assets, or mobile/layout behavior:

```bash
npm run test:e2e
```
