# Astral — System Map

> **Audiencia:** humano o AI agent que toca el código por primera vez, o que necesita reorientarse rápido.
> **Promesa:** entender el sistema entero en una pasada. Cada región tiene su propio doc detallado (cuando existe) o se profundiza leyendo los entry files.
> **Última actualización:** 2026-05-24.

---

## Domain

App de Diseño Humano para coaches/mentoras de negocios. Cada usuaria tiene un **bodygraph** (computado vía Swiss Ephemeris desde su `{date, time, place}` de nacimiento; alternativamente extraído de un PDF subido). Sobre ese bodygraph, la app ofrece:

- **Chat con IA personalizada** por su carta HD + tránsitos planetarios + memoria conversacional.
- **Tránsitos** (qué planetas están activando qué canales hoy/esta semana).
- **Informes** (reporte semanal personalizado, cached por `profile_hash`).
- **Mi carta** (visualización SVG vectorial + descarga PDF on-demand).

Stack: React 18 + Vite (frontend) · Fastify 5 + Turso libsql (backend) · OpenAI (chat, memory, report) · Swiss Ephemeris WASM (cálculo astronómico determinístico) · GeoNames (places autocomplete) · Cloudflare R2 (asset storage) · SuperTokens (auth passwordless email).

---

## Cómo leer este mapa

1. **Encontrá la región** que cubre tu task (sección "Regiones" abajo).
2. **Lee la fila de esa región** — purpose, surface, entry files, depends-on, tests, state, sub-doc.
3. **Profundizá** abriendo el sub-doc si existe, o leyendo los entry files listados.
4. Si necesitás contexto cross-region, las dependencias listadas te dicen qué otras regiones leer.

**Entry points para agentes AI** — si tu task toca:

| Task | Regiones a leer en orden |
|------|--------------------------|
| Upload o reemplazo de carta | R3 → R10 → R2 (si afecta onboarding) |
| Nueva pantalla UI que muestre la carta | R4 → R3 (consumidor de profile) |
| Bug del chat con IA | R5 → R6 (memory) → R7 (transits, si lee) |
| Bug de extracción de PDF | R3 (path secundario PDF) |
| Cambio en geocoding | R9 → R3 (consumidor) |
| Nuevo endpoint admin | R11 → R1 (auth) |
| MCP / integración externa | R12 → R1 |
| Bug de tránsitos | R7 → R3 (lee bodygraph) |
| Cambio al informe semanal | R8 → R6 (lee memory) → R3 (lee profile) |
| Telemetría LLM / costos | R13 → R5 |

---

## Regiones

Notación: **STATE** = `stable` · `active-dev` · `legacy-mantenido` · `gated` (bajo flag) · `deprecated`.

---

### R1 · Auth & Session
- **Purpose:** Identificación y sesión del user. Mapping `identity → user` (passwordless email vía SuperTokens). Helpers para resolver "current user" en cada request.
- **Surface:** preHandler hook de SuperTokens en todas las rutas `/api/*`. Ninguna ruta HTTP propia (SuperTokens registra sus propios endpoints bajo `/auth/*`).
- **Entry files:** `backend/src/auth/supertokens.ts` · `backend/src/auth/session.ts` · `backend/src/auth/current-user.ts`
- **Depends on:** SuperTokens managed (servicio externo)
- **Tests:** `backend/src/__tests__/auth-*.test.ts`
- **State:** `stable`

### R2 · Account & Onboarding
- **Purpose:** Crear cuenta, completar onboarding (nombre + birth data + intake de negocio), gestionar el record de `users`.
- **Surface:** `POST /users` · `GET/PUT /me` · `PATCH /me/onboarding` · `GET/PATCH/DELETE /users/:id` · `POST /admin/users`
- **Entry files:** `backend/src/routes/users.ts` · `frontend/src/components/OnboardingFlow.tsx`
- **Depends on:** R1 (auth) · R3 (compute al final del wizard) · R9 (places autocomplete en birth-data step)
- **Tests:** `backend/src/__tests__/api-users.test.ts` · `backend/src/__tests__/api-onboarding-state.test.ts` · `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` · `e2e/specs/24-onboarding-intake-step.spec.ts` · `e2e/specs/28-onboarding-birth-data.spec.ts`
- **State:** `stable` post-`astral-e5f` (onboarding ahora pide birth data, no PDF)

### R3 · Bodygraph Compute — **el corazón del sistema**
- **Purpose:** Computar el `UserProfile` (gates, channels, centers, type, profile, authority, definition, variables, etc.) **para sí misma o para terceros**. Dos paths legítimos, claramente jerarquizados:
  - **(primary) Swiss Ephemeris desde birth data** — `{date, time, place}` → cálculo determinístico astronómico. Llena `profile.birthData` completo.
  - **(secondary) Extracción desde PDF subido** — para casos donde la usuaria tiene un PDF (propio o de cliente) y no necesariamente la birth data. Parsers deterministicos por proveedor (MyHumanDesign, Genetic Matrix EN/ES). Acepta el trade-off de que `profile.birthData = null` cuando el PDF no la trae (MyHumanDesign nunca, Genetic Matrix sí pero no la pulleamos hoy).
- **Surface:**
  - `POST /me/bodygraph/from-birth` ← path primary (Swiss Eph)
  - `POST /me/bodygraph` ← path secondary (PDF multipart upload)
  - `backend/scripts/migrate-user-to-swiss.ts` ← CLI manual override para casos existentes
- **Entry files:**
  - `backend/src/bodygraph/calculate.ts` ← Swiss Eph + geo-tz + luxon
  - `backend/src/extraction-service.ts` ← orquesta deterministic parsers; no usa LLM ni Vision fallback
  - `backend/src/hd-pdf/genetic-matrix.ts` · `backend/src/hd-pdf/myhumandesign.ts` ← parsers deterministicos
  - `backend/src/routes/assets.ts` ← endpoints de bodygraph/assets
  - `frontend/src/components/OnboardingFlow.tsx` (wizard birth-data) · `frontend/src/components/MyChartReplaceView.tsx` (2 tabs)
- **Depends on:** R9 (places autocomplete) · R10 (R2 storage para path PDF)
- **Profile JSON shape canónico:** ver `backend/src/types/agent.ts` interface `UserProfile`.
- **Tests:** `backend/src/__tests__/bodygraph-calculate.test.ts` · `backend/src/__tests__/api-assets.test.ts` · `backend/src/__tests__/extraction-service.test.ts` · `backend/src/hd-pdf/pdf-fixtures.test.ts` · `e2e/specs/18-onboarding-and-assets-resilience.spec.ts` · `e2e/specs/28-onboarding-birth-data.spec.ts`
- **State:** `active-dev` — pivot a Swiss Eph terminado (`astral-e5f`), path PDF mantenido como secundario documentado y 100% determinístico (Vision fallback eliminado en `astral-1c6`).
- **Modelo V1 (actual):** una sola carta activa por user. `users.profile_asset_id` apunta al asset activo; re-subir pisa la anterior. **NO implementar lógica de "elegir entre múltiples cartas cargadas" — V2 (`astral-yaa`) va a re-modelar esto nativamente** (multi-profile con IDs estables, ownership por perfil, cross-profile context). Ver sección "V1 vs V2" en [`AGENTS.md`](../../AGENTS.md).
- **Deuda conocida:**
  - `profile.name` capitalization inconsistente según source (PDF GM ES devuelve lowercase) — pendiente fix (`astral-a2j`).
  - Path PDF no extrae `birthData` aunque Genetic Matrix lo trae inline — pendiente unificación con Swiss Eph (`astral-gwm`).

### R4 · Bodygraph Display
- **Purpose:** Renderizar el bodygraph computado en R3 para la usuaria — versión interactiva (UI), versión vector exportable (SVG), versión PDF descargable (on-demand desde el vector).
- **Surface:** `GET /me/bodygraph/chart-svg` · `GET /me/bodygraph/full-svg` · `GET /me/bodygraph/pdf`
- **Entry files:**
  - `backend/src/bodygraph/render-svg.ts` ← renderer SVG con paneles planet + variable wheel
  - `backend/src/bodygraph/svg-geometry.ts` ← geometría (centros, canales, gates)
  - `backend/src/bodygraph/render-pdf.tsx` ← export PDF vector via `pdfkit` + `svg-to-pdfkit`
  - `backend/src/routes/assets.ts` ← endpoints de SVG/PDF
  - `frontend/src/components/MyChartView.tsx` ← pantalla "Mi carta"
- **Depends on:** R3 (consume `profile.humanDesign.activatedGates` + `definedCenters` + `variables`)
- **Tests:** `backend/src/__tests__/bodygraph-render-svg.test.ts` · `backend/src/__tests__/api-assets.test.ts` (PDF download)
- **State:** `stable` post-`astral-3iu` (redesign + PDF vector via `pdfkit` + `svg-to-pdfkit`)
- **Sub-doc:** [`bodygraph-render.md`](bodygraph-render.md)

### R5 · Chat
- **Purpose:** Conversación con IA personalizada por bodygraph + tránsitos + memoria. Path único con tools HD deterministas.
- **Surface:** `POST /chat` (non-streaming) · `POST /chat/stream` (SSE) · `GET /me/messages` · `DELETE /me/messages` · `POST /messages/:id/feedback`
- **Entry files:**
  - `backend/src/agent-service-v2.ts` · `agent-service-v2-prompt.ts` ← Vercel AI SDK + tools HD
  - `backend/src/types/agent.ts` ← tipos compartidos (`UserProfile`, `ChatMessage`, telemetry meta)
  - `backend/src/llm/model-config.ts` ← `CHAT_MODEL` + hash de prompt
  - `backend/src/hd-tools/` ← 5 tools deterministicos para v2 (anti-alucinación by design)
  - `backend/src/knowledge/` ← HD_CONDENSED + BUSINESS_PACK
  - `backend/src/routes/chat.ts`
- **Depends on:** R3 (profile) · R6 (memory) · R7 (transits) · R8 (no, opposite — R8 consume del chat output) · R13 (telemetry)
- **Tests:** `backend/src/__tests__/api-chat.test.ts` · `backend/src/__tests__/api-chat-context-budget.test.ts` · `backend/src/__tests__/anti-hallucination-hd.test.ts` · `backend/src/__tests__/llm-telemetry.test.ts` · `backend/src/__tests__/memory-integration.test.ts` · `backend/src/__tests__/prompt-cache-discipline.test.ts` · `e2e/specs/01-chat-send-message.spec.ts` · `e2e/specs/28-chat-streaming-scroll.spec.ts`
- **State:** `active-dev` — v2 canónico desde `astral-e2h.1`; legacy v1 eliminado.
- **Sub-doc:** [`chat-llm-system.md`](chat-llm-system.md) ← lectura obligada antes de tocar AI

### R6 · Memory (Living Document)
- **Purpose:** Persistir hechos sobre la usuaria entre conversaciones. Writer fire-and-forget que corre post-chat-turn, mergea hechos nuevos en `users.memory_md`. El system prompt del chat lo inyecta en cada turn.
- **Surface:** No tiene endpoint propio — corre como side-effect post-stream del chat.
- **Entry files:** `backend/src/memory-writer.ts` · consumido por `services/guide-service.ts`
- **Depends on:** R5 (se ejecuta después de cada chat turn) · R13 (telemetry)
- **Tests:** `backend/src/__tests__/memory-writer.test.ts`
- **State:** `stable`

### R7 · Transits
- **Purpose:** Calcular tránsitos planetarios (qué planetas están en qué gates ahora/esta semana) y cruzarlos con el bodygraph de la usuaria (`analyzeTransitImpact`).
- **Surface:** `GET /transits[?userId=]&clientNow=&timeZone=`
- **Entry files:**
  - `backend/src/transit-service.ts` ← Swiss Eph + week_key cache + `analyzeTransitImpact`
  - `backend/src/routes/transits.ts`
  - `frontend/src/components/TransitViewer.tsx`
- **Depends on:** R3 (lee profile para impact analysis)
- **Tests:** `backend/src/__tests__/api-transits.test.ts` · `backend/src/__tests__/transit-service.test.ts` · `backend/src/__tests__/transit-impact.test.ts` · `e2e/specs/20-transits-weekly-view.spec.ts`
- **State:** `stable` · ADR pendiente sobre selector diario/semanal (`astral-46m`)

### R8 · Report (Premium Weekly Report)
- **Purpose:** Generar reporte semanal personalizado para usuarias premium. 3 LLM calls (intro + body + close). Cached por `profile_hash` — se invalida automáticamente cuando cambia el profile.
- **Surface:** `POST /me/report` · `GET /me/report?tier=` · `POST /me/report/share` · `GET /me/report/share/:token`
- **Entry files:** `backend/src/report/generate-report.ts` · `backend/src/report/pdf-renderer.tsx` · `backend/src/routes/report.ts` · `frontend/src/components/ReportRenderer.tsx` · `frontend/src/components/ReportView.tsx`
- **Depends on:** R3 (profile) · R2 (intake) · R6 (memory_md) · R7 (transits) · R13 (telemetry)
- **Tests:** `backend/src/__tests__/api-report.test.ts` · `backend/src/__tests__/report-generation.test.ts` · `backend/src/__tests__/frontend-report-view-model.test.ts` · `e2e/specs/07-report-first-generation.spec.ts` · `e2e/specs/11-report-regeneration.spec.ts`
- **State:** `active-dev` (v2 en spec, ver `premium-report-v2-spec.md`)

### R9 · Places (Geocoding)
- **Purpose:** Autocomplete de lugares para que la usuaria seleccione su birth place. Resuelve `{name, admin1, country} → {lat, lon}`. Cache LRU 24h in-memory.
- **Surface:** `GET /places?q=&limit=&lang=`
- **Entry files:** `backend/src/places/geonames.ts` · `backend/src/routes/places.ts`
- **Depends on:** GeoNames API (externa, free tier 20k credits/día con `GEONAMES_USERNAME`)
- **Tests:** `backend/src/__tests__/api-places.test.ts`
- **State:** `stable` post-`astral-e5f`

### R10 · Assets Storage
- **Purpose:** Subida, descarga y borrado de assets binarios (PDFs HD subidos por la usuaria, históricos). Storage: Cloudflare R2 con keys `users/{userId}/assets/{assetId}.{ext}`.
- **Surface:** `GET /me/assets` · `POST /me/assets` · `GET /assets/:id` · `DELETE /assets/:id` · `POST /users/:userId/assets` (admin)
- **Entry files:** `backend/src/storage/r2.ts` · `backend/src/routes/assets.ts`
- **Depends on:** R3 (cuando se sube por path PDF) · R1 (ownership checks)
- **Tests:** `backend/src/__tests__/api-assets.test.ts` · `storage-r2.test.ts`
- **State:** `stable`

### R11 · Admin
- **Purpose:** Endpoints administrativos para el founder — invitar usuarias premium por email, ver/editar cualquier user, audit logs.
- **Surface:** `POST /admin/users` (invite) · `GET /admin/users` (list) · `GET /users/:id` · `PATCH /admin/users/:id/access` · `DELETE /admin/users/:id` · `GET /users/:id/audit?days=`
- **Entry files:** `backend/src/routes/users.ts` · `frontend/src/components/AdminUsersView.tsx` · `frontend/src/components/AdminUserDetailView.tsx` · `frontend/src/components/AdminInviteModal.tsx`
- **Depends on:** R1 (admin role check) · R2 (creación de user) · R10 (cleanup R2 en delete)
- **Tests:** `backend/src/__tests__/api-admin-*.test.ts`
- **State:** `stable` post-`astral-0xw` (provisioning epic) · runbook en [`../admin-invite-runbook.md`](../admin-invite-runbook.md)

### R12 · MCP (Remote Model Context Protocol)
- **Purpose:** Exponer Astral como MCP server para integraciones externas (ChatGPT custom GPTs, Claude desktop, etc.). Permite que un LLM externo consulte el bodygraph + tránsitos del usuario via OAuth.
- **Surface:** `POST/GET/PUT/PATCH/DELETE /mcp/v1` · `GET /.well-known/oauth-authorization-server` · `POST /workos/connect`
- **Entry files:** `backend/src/routes/mcp.ts` · `backend/src/routes/mcp-discovery.ts` · `backend/src/routes/workos-connect.ts` · `backend/src/mcp/`
- **Depends on:** R1 (auth via WorkOS) · R3 (profile) · R7 (transits)
- **Tests:** `backend/src/__tests__/api-mcp*.test.ts` · `backend/scripts/smoke-mcp-curl.sh`
- **State:** `gated` por `FEATURE_REMOTE_MCP` · production learnings en [`../remote-mcp-production-learnings.md`](../remote-mcp-production-learnings.md)

### R13 · Telemetry & Cost Tracking
- **Purpose:** Persistir cada LLM call (`route`, `model`, `tokens_in/out`, `cached_tokens`, `tool_calls_count/json`, `context_breakdown_json`, `cost_usd`, `latency_ms`, `prompt_hash`) en la tabla `llm_calls` para analytics de costo + invalidación de cache + compliance de tools + context budget.
- **Surface:** No tiene endpoint propio — se escribe como side-effect de cada LLM call.
- **Entry files:** `backend/src/db.ts` (función `insertLlmCall`) · `backend/src/services/guide-telemetry.ts` · `backend/src/memory-writer.ts` · `backend/src/report/generate-report.ts`
- **Depends on:** ninguna región — es la capa observability transversal.
- **Tests:** `backend/src/__tests__/llm-telemetry.test.ts` · `backend/src/__tests__/llm-pricing.test.ts` · `backend/src/__tests__/api-chat-context-budget.test.ts` · `backend/src/__tests__/context-budget.test.ts`
- **State:** `stable`

---

## Data Layer

### Tabla `users` (canónica)
```
id, name, email, profile (JSON), profile_asset_id, intake (JSON), memory_md,
plan, role, status, onboarding_status, onboarding_step, access_source,
created_at, updated_at
```

### `profile` JSON shape (interface `UserProfile`)
```ts
{
  name: string,
  birthData?: {
    dateLocalIso, dateUtcIso, placeLabel,
    coordinates: { lat, lon },
    timezoneOffsetHours, ageYears
  },
  humanDesign: {
    type, typeQualifier, strategy, authority, profile, profileName,
    definition, incarnationCross, themes, notSelfTheme,
    variables, variableLabels, design: { date },
    channels, activatedGates, definedCenters, undefinedCenters
  }
}
```

**Writers principales:**
- `updateUserBodygraph(id, profile, profileAssetId)` ← R3 (ambos paths) + migration script
- `updateUserProfile(id, name, profile, intake)` ← R2 onboarding

### Otras tablas
`assets` · `chat_messages` · `llm_calls` · `hd_reports` · `report_shares` · `transit_cache` · `transit_snapshots_cache` · `user_identities` (auth mapping) · `mcp_tokens` · `mcp_consents` · `mcp_clients` · `mcp_audit_events`

### R2 storage convention
`users/{userId}/assets/{assetId}.pdf`

---

## External Services

| Servicio | Para qué | Auth |
|----------|----------|------|
| **OpenAI** | Chat (GPT-4o-mini default), memory writer, report | `OPENAI_API_KEY` |
| **GeoNames** | Places autocomplete | `GEONAMES_USERNAME` |
| **Cloudflare R2** | Asset storage (PDFs) | `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` |
| **SuperTokens managed** | Auth passwordless email + sessions | `SUPERTOKENS_API_KEY` |
| **Turso libsql** | DB primary | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` |
| **WorkOS** | OAuth para MCP (gated) | `WORKOS_*` |

**Local-only (no external service):** Swiss Ephemeris vía `swisseph-wasm`, geo-tz polígonos via `geo-tz`, IANA tz histórica via `luxon`.

---

## Boot & Deploy

- **Dev local:** `npm run dev` desde la raíz (concurrently levanta backend `:3000` + frontend `:5173`).
- **Build:** `cd backend && npm run build` (tsc) + `cd frontend && npm run build` (Vite). El backend en prod sirve el build estático del frontend (no Next.js, no SSR).
- **Deploy:** Render (Dockerfile multi-stage Node 20 Alpine). Una imagen, un deploy.
- **Env vars críticas:** OPENAI_API_KEY · TURSO_DATABASE_URL/AUTH_TOKEN · R2_* · SUPERTOKENS_* · GEONAMES_USERNAME · CHAT_MODEL · MEMORY_WRITER_MODEL · REPORT_MODEL · FEATURE_REMOTE_MCP
- **Schema migraciones:** idempotentes en `db.ts:initDb()` — corren al boot, validan + crean tablas/columnas faltantes.

---

## Decisiones técnicas que afectan TODO el sistema

- **Solo Diseño Humano** — no astrología natal. Si en el futuro se agrega, sería una segunda región paralela a R3.
- **Offset 302° del Rave Mandala** — las 64 puertas HD NO empiezan en 0° Aries. Ver [`../human-design-reference.md`](../human-design-reference.md).
- **Transit impact determinístico** — `analyzeTransitImpact` calcula canales/centros antes de llamar al LLM. El LLM interpreta data calculada, no la infiere.
- **HD tools deterministicos en v2** — la tabla canónica de 36 canales se expone como tools en lugar de inline en el prompt. Anti-alucinación by design.
- **No Next.js** — Fastify sirve el build estático.
- **No npm workspaces** — root usa `cd backend && ...`.
- **API responses camelCase** — rutas backend mapean snake_case de SQLite a camelCase.
- **Models como env vars** — `CHAT_MODEL`, etc. configurables desde Render dashboard.

---

## Sub-mapas por región (cuando existen)

Estos docs profundizan en una región específica. Se crean a medida que la complejidad lo justifica.

| Región | Sub-doc |
|--------|---------|
| R3 + R4 | [`bodygraph-render.md`](bodygraph-render.md) (foco R4) |
| R5 | [`chat-llm-system.md`](chat-llm-system.md) (mapa completo del flujo LLM) |
| R5 (refactor history) | [`refactor-2026-05-decisions.md`](refactor-2026-05-decisions.md) |
| R8 (spec) | [`../premium-report-v2-spec.md`](../premium-report-v2-spec.md) |
| R7 (ADR) | [`../transits-time-selector-adr.md`](../transits-time-selector-adr.md) |
| R11 (runbook) | [`../admin-invite-runbook.md`](../admin-invite-runbook.md) |
| R12 | [`../remote-mcp-production-learnings.md`](../remote-mcp-production-learnings.md) · [`../remote-mcp-architecture-proposal.md`](../remote-mcp-architecture-proposal.md) |

Otros docs por categoría: [`../INDEX.md`](../INDEX.md).

---

## Glosario mínimo

- **Bodygraph** — el gráfico de 9 centros + 64 puertas + 36 canales de Human Design.
- **Profile (HD)** — el "tipo de personalidad" HD (ej "2/4 Ermitaño/Oportunista"), no confundir con `users.profile` (JSON entero).
- **Type** — Generador / Manifestador / Proyector / Reflector / Generador Manifestante.
- **Authority** — el centro de decisión interna (Sacral / Emocional / Splenic / Ego / Self / Mental / None).
- **Gate** — una de las 64 puertas del bodygraph. Cada planeta activa una gate.
- **Channel** — conexión entre 2 gates de 2 centros distintos. La usuaria tiene un canal definido cuando ambas gates están activadas.
- **Transit** — posición planetaria del momento (vs natal). Activan gates temporalmente.
