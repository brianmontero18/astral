# UAT Coverage Audit

Fecha: 2026-04-26

Scope:
- Auditoría de cobertura real contra `docs/uat-test-plan.md`
- Cruce obligatorio con `docs/freemium-spec.md` y `docs/premium-report-v2-spec.md`
- Relevamiento de tests backend, frontend-helper y Playwright existentes
- Reconciliación contra cambios de la sesión 2026-04-25/26 (auth deploy real, R2 storage migration, schema cleanup, email persistence, regen timestamp fix)

## Executive summary

- Ya no quedan IDs UAT en estado `missing` ni `partial`; el mapa funcional quedó cubierto y el cleanup estructural prioritario de la suite también quedó cerrado.
- La cobertura BE de contratos actuales es razonable en identidad, límites, report access, chat upgrade semantics, assets y migrations.
- La cobertura UI real sigue siendo baja: predominan tests de helpers/view-model, no tests de superficies renderizadas.
- La desalineación base de la suite `e2e/` con el contrato actual ya quedó corregida:
  - el harness usa `/api/me*` donde corresponde
  - los límites relevantes quedaron alineados a `free=20`, `basic=120`, `premium=300`
  - las fixtures/assertions del report dejaron de tratar el premium legacy como verdad
- El bloque `P0` del audit quedó cubierto sobre el contrato actual:
  - `ONBOARD-01`, `AUTH-01..05`, `CHAT-01..05`, `CHAT-07`, `REPORT-01..03`, `REPORT-05`, `RESP-01` y `COPY-01` ya tienen evidencia confiable acorde al contrato vigente
  - no queda backlog urgente de reparación contractual dentro de este audit
- Contratos nuevos agregados en esta corrida (cubiertos por tests directos):
  - email del provider persistido en `users.email` al signup → cubierto por `api-users.test.ts`
  - regen del report preserva `created_at` y avanza `updated_at` → cubierto por `api-report.test.ts`
  - storage de assets en Cloudflare R2 vía adapter S3-compatible → cubierto por `storage-r2.test.ts` + stub R2 en `helpers.ts`
  - migración del schema legacy a la forma R2-only → cubierto por `db-migration-rebuild.test.ts`
- `MIGRATION-01` (P1, nuevo) quedó cubierto por `db-migration-rebuild.test.ts` con tres casos: rebuild happy path, refusal con NULL storage_key, no-op sobre schema ya migrado.

## Inventory real

- Backend test files bajo `backend/src/__tests__`: `31`
- Test files adicionales fuera de `__tests__`: `2`
  - `backend/src/hd-pdf/pdf-fixtures.test.ts`
  - `frontend/vite.config.test.ts`
- Playwright specs bajo `e2e/specs`: `23`
- Los tests `backend/src/__tests__/frontend-*.test.ts` cubren helpers/view-models, no UI renderizada
- Test files agregados en la sesión 2026-04-25/26:
  - `backend/src/__tests__/storage-r2.test.ts` (R2 adapter + key/extension helpers + stubbed S3 client round-trip)
  - `backend/src/__tests__/db-migration-rebuild.test.ts` (assets schema rebuild en sus tres estados)

## Findings por severidad / prioridad

### P0 / covered — no quedan gaps P0 abiertos en la base actual

Estado actual:
- Ya existe cobertura confiable en onboarding first-time, auth bootstrap/restore, runtime auth, chat, report, transits, assets y mobile core surfaces.
- No quedan contratos `P0` abiertos en la matriz actual del UAT.

Impacto:
- La base de tests dejó de validar contrato viejo y ya protege los entry points y restores actuales del shell.
- El riesgo principal pasa de drift contractual a mantenimiento oportunista y breadth futura, no a reparación urgente.

### P0 / resolved — el harness E2E base ya quedó alineado con el contrato actual

Corrección cerrada en esta sesión:
- `e2e/helpers/mock-api.ts` ya responde sobre rutas actuales `/api/me*` donde el frontend actual las consume
- `e2e/helpers/mock-api.ts` y `e2e/specs/05-chat-freemium-limits.spec.ts` ya no dependen del límite legacy `15`
- `e2e/helpers/fixtures.ts` y los specs de report ya no usan el premium report legacy como contrato base

Impacto:
- La suite reparada dejó de dar falsa señal por endpoints/rangos/modelo viejos.
- Los specs `03`, `05`, `07`, `08`, `09`, `10`, `11`, `12` y `13` pasan a contar como cobertura relevante del contrato actual, ya sin drift base de wiring, límites o modelo premium.

### P0 / resolved — los entry points actuales del frontend ya tienen tests directos

Cobertura agregada:
- `backend/src/routes/report.ts` expone `POST /me/report` y ahora está cubierto en `backend/src/__tests__/api-report.test.ts`
- `backend/src/routes/assets.ts` expone `POST /me/assets` y ahora está cubierto en `backend/src/__tests__/api-assets.test.ts`

Impacto:
- Los dos entry points actuales del frontend dejaron de depender sólo de paths legacy o cobertura indirecta.

### P0 / resolved — runtime auth, límites de chat, upgrades, rewrite semantics y report failure handling ya tienen coverage confiable

Cobertura confiable agregada:
- `AUTH-05`: `e2e/specs/12-auth-runtime-resilience.spec.ts` ahora cubre logout, expiry mid-chat, expiry durante generación de report y expiry al abrir assets; backend directo sigue cubriendo `PUT /api/me`, `POST /api/me/report` y `POST /api/me/assets` sin side effects
- `CHAT-02` y `CHAT-03`: `e2e/specs/05-chat-freemium-limits.spec.ts` ahora cubre estados capped reales para `free`, `basic` y `premium`, preservando historial visible y CTA correcta según plan
- `CHAT-04`: `e2e/specs/14-chat-plan-upgrade.spec.ts` ya integra upgrade con navegación real, send post-upgrade y reload preservando historial
- `CHAT-05`: `e2e/specs/06-chat-db-consistency.spec.ts` ya integra edit -> truncate -> send-after-edit -> reload sin ghost messages ni ramas viejas persistidas
- `REPORT-05`: `backend/src/__tests__/api-report.test.ts`, `e2e/specs/07-report-first-generation.spec.ts` y `e2e/specs/11-report-regeneration.spec.ts` ya cubren degraded path, 502 saneado, 429, preservación del reporte previo y la policy actual de cooldown incluso tras fallo

Impacto:
- Los contratos actuales de runtime auth, límites por plan, upgrades, rewrite semantics y fallos de report ya no dependen de breadth pendiente ni de policy implícita.
- `COPY-01` se mantiene cubierto: helper coverage transversal y UI real ya protegen auth/admin/assets además de chat/report/transits; no quedaron leaks crudos detectados en las superficies auditadas actuales

### P1 / covered — voice input ya protege transcripción larga, timeout y retry limpio

Cobertura confiable agregada:
- `CHAT-06`: `backend/src/__tests__/api-transcribe.test.ts` ahora cubre `POST /api/transcribe` sin archivo, transcripción larga exitosa y mapeo saneado de timeout/upstream failure a `502`
- `CHAT-06`: `e2e/specs/04-chat-voice-notes.spec.ts` ahora cubre dismiss + retry exitoso tras una falla de transcripción, verificando que el recorder no quede wedgeado y que el segundo intento complete send normal

Impacto:
- Voice input deja de depender sólo del happy path y de una falla genérica sin retry.
- La cobertura funcional del chat por voz queda alineada con el contrato actual.

### P0 / resolved — bootstrap auth, restore por plan y report gating actual ya tienen coverage confiable

Cobertura confiable agregada:
- `AUTH-01`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre first login con identidad linked pero usuario Astral inexistente, onboarding/bootstrap real, entrada al shell autenticado y visibilidad explícita del plan `free`
- `AUTH-02`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre restore de sesión linked `free` con historial persistido visible y sin tratar al usuario como nuevo
- `AUTH-03`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre restore linked `basic` y `premium` con label de plan visible y surfaces correctas según gating/unlock actual
- `AUTH-04`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre boot anonymous redirigiendo a `/auth` y boot inactive bloqueado con copy amigable; backend directo sigue cubriendo anonymous/unlinked/inactive semantics
- `REPORT-01`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre explícitamente el contrato `basic` sobre la misma superficie de report con base visible + continuación premium locked
- `REPORT-02`: `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` ahora cubre unlock premium in place en UI real, incluyendo restore, acciones `share/pdf` en tier `premium` y ausencia de CTA/locks legacy

Impacto:
- El shell actual ya protege bootstrap, restore de sesión e indicators por plan en la misma superficie que usa el usuario real.
- El report ya no tiene huecos `P0` entre `free/basic` locked continuation y `premium` unlocked continuation.

### P0 / resolved — mobile core flows ya tienen coverage funcional y visual smoke suficiente

Cobertura confiable agregada:
- `RESP-01`: `e2e/specs/13-mobile-core-surfaces.spec.ts` ahora cubre shell autenticado mobile, logout a estado público, chat, voice success/error recovery, report, transits, assets, profile y upgrade CTA con chequeos de viewport/no horizontal overflow
- `RESP-01`: los snapshots `mobile-chat-shell-visual-smoke-chromium-darwin.png` y `mobile-report-locked-visual-smoke-chromium-darwin.png` siguen aportando visual smoke real sobre el shell mobile actual

Impacto:
- El contrato mobile base ya no depende sólo de smoke superficial: tiene recorrido funcional sobre los entry points móviles vigentes y estados menos felices relevantes del voice flow.

### P1 / covered — overlays y layout stability ya tienen coverage dedicada en shell actual

Cobertura confiable agregada:
- `RESP-02`: `e2e/specs/23-layout-stability-overlays.spec.ts` ahora cubre el equivalente real de overlays/layout del shell vigente en desktop y mobile: apertura/cierre del panel de perfil, locked report state visible sin overflow horizontal, preview modal de assets con body scroll lock y cierre limpio
- `RESP-02`: los snapshots `desktop-profile-panel-layout-smoke-chromium-darwin.png`, `desktop-report-locked-layout-smoke-chromium-darwin.png`, `desktop-asset-preview-layout-smoke-chromium-darwin.png`, `mobile-profile-panel-layout-smoke-chromium-darwin.png` y `mobile-asset-preview-layout-smoke-chromium-darwin.png` aportan visual smoke dedicado para superficies sensibles de layout

Impacto:
- El contrato de layout stability deja de depender de smoke incidental en mobile/report/profile.
- El riesgo residual deja de ser drift estructural y pasa a expansión futura o refactor oportunista.

### P1 / covered — transits weekly view y resilience ya quedaron protegidos en la UI real

Cobertura confiable agregada:
- `TRANSIT-01`: `e2e/specs/20-transits-weekly-view.spec.ts` ahora cubre carga del weekly view, expand/collapse real de cards y assertions sobre impact sections personalizadas para un usuario linked
- `TRANSIT-02`: `backend/src/__tests__/api-transits.test.ts`, `backend/src/__tests__/frontend-transit-errors.test.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts` y `e2e/specs/20-transits-weekly-view.spec.ts` ahora cubren failure BE directa, copy segura en UI y recovery limpio al volver a entrar a la superficie

Impacto:
- Tránsitos deja de ser breadth pendiente de primer orden: la superficie desktop actual ya protege happy path, detalles expandibles, impacto personalizado y recuperación tras fallo.

### P1 / covered — main navigation ya protege preservación de estado entre superficies actuales

Cobertura confiable agregada:
- `NAV-01`: `e2e/specs/21-navigation-state-preservation.spec.ts` ahora cubre navegación real entre Chat, Tránsitos, Mis Cartas, Intake y Report, verificando que el usuario no quede varado y que el flow de report vuelva al tab originante cuando corresponde

Impacto:
- La navegación principal deja de depender de coverage fragmentada en specs de report/mobile.

### P1 / covered — access role-based ya queda protegido en shell y rutas admin actuales

Cobertura confiable agregada:
- `ACCESS-01`: `e2e/specs/15-admin-support-copy.spec.ts` y `e2e/specs/16-admin-support-flow.spec.ts` ahora cubren denegación graceful para non-admin sobre rutas admin, ausencia del entrypoint `Usuarios` para sesiones sin rol admin y acceso real desde el shell para sesiones admin

Impacto:
- El contrato de acceso por rol deja de depender sólo de BE/helpers o navegación directa hardcodeada.

### P1 / covered — profile surface ya protege cues de plan y degradación con HD parcial

Cobertura confiable agregada:
- `PROFILE-01`: `e2e/specs/22-profile-panel-visibility.spec.ts` ahora cubre apertura del panel, cues visibles de plan/acceso y funcionamiento del surface con HD parcial sin romper el flujo a report

Impacto:
- El panel/profile deja de depender de coverage incidental en restore/mobile.

### P1 / covered — intake y regeneración del report ya tienen semántica directa protegida

Cobertura confiable agregada:
- `REPORT-04`: `backend/src/__tests__/api-report.test.ts` ahora cubre cache hit cuando `profile + intake` no cambian y regeneración in-place cuando cambia el intake persistido, verificando reuse del mismo report id y uso del intake actualizado al llamar al generador
- `REPORT-04`: `e2e/specs/08-report-cache-first-loading.spec.ts`, `e2e/specs/09-report-intake-persistence.spec.ts` y `e2e/specs/11-report-regeneration.spec.ts` ya cubrían la superficie UI real para skip de intake, prefill, edición y regeneración desde el shell actual
- `REPORT-04`: `backend/src/__tests__/api-report.test.ts` además ahora cubre la regression de `saveReport` que pisaba `created_at` en regen — dos tests con sleep de 1.1s validan que `created_at` queda intacto y `updated_at` avanza al regenerar y al hacer `updateReportContent`

Impacto:
- Intake deja de ser sólo un flow visible en UI y pasa a tener semántica backend directa sobre cache/regeneration.
- El timestamp contract de regeneración queda explícito y verificado.
- Ya no quedan gaps funcionales abiertos en la matriz UAT actual.

### P0 / covered (nuevo) — email persistido en signup desde el provider

Contrato nuevo de la sesión 2026-04-25/26:
- Al primer signup linked, `routes/users.ts:POST /users` consulta `SuperTokens.getUser(subject)` y persiste el primer email del provider en `users.email`. Antes era siempre NULL y el panel admin no podía buscar por email de manera confiable.

Cobertura confiable:
- `backend/src/__tests__/api-users.test.ts` cubre dos escenarios:
  - happy path: SuperTokens devuelve `emails: [...]` → `users.email` queda con el primer valor
  - failure path: SuperTokens.getUser throw → backend cae a `null` sin propagar el error al cliente

Impacto:
- `AUTH-01` ahora también valida que el email del provider llegue a la fila local del user.
- `ADMIN-01`/`ADMIN-02` se benefician indirecto: la búsqueda por email del panel admin tiene data real para filtrar.

### P1 / covered (nuevo) — Cloudflare R2 como source of truth de assets

Contrato nuevo de la sesión 2026-04-25/26:
- El contenido binario de los assets vive en Cloudflare R2 (`bucket: astral-assets`) accedido vía S3-compatible API con `@aws-sdk/client-s3` apuntado al endpoint de R2. El SQL `assets.storage_key` apunta a `users/{userId}/assets/{assetId}.{ext}`. La columna `data BLOB` legacy quedó dropeada al rebuild de la tabla.
- `server.ts:assertEnv()` valida en boot de producción que las 4 env vars `R2_*` estén presentes; falla loud antes de servir requests si falta config.

Cobertura confiable:
- `backend/src/__tests__/storage-r2.test.ts` cubre:
  - `isR2Configured()` con presencia parcial / completa de env vars
  - `buildAssetKey()` con/sin punto inicial en la extensión
  - `inferExtensionFromFile()` por filename y por mime fallback
  - put/get/delete via stubbed S3 client + verificación del comando emitido
- `backend/src/__tests__/helpers.ts` instala un stub R2 in-memory en `__setHandleForTesting` por cada `createTestApp()`. El stub registra Puts en un Map, sirve Gets desde ese mismo store y no-opea Deletes. `api-assets.test.ts` y `api-users.test.ts` corren por encima de ese stub sin cambiar el contrato HTTP de assets.

Impacto:
- `ASSET-01` y `ASSET-02` siguen covered en su contrato HTTP (sin cambios para el usuario final), ahora corriendo en tests sobre el adapter R2 simulado.
- Si el SDK rompe contra R2 real en runtime (creds inválidas, bucket inexistente), el upload propaga error → 500 → la UI cae a copy genérica `COPY-01`.

### P1 / covered (nuevo) — schema migrations idempotentes

Contrato nuevo (`MIGRATION-01`):
- `initDb()` corre rebuild dance idempotente sobre `assets` cuando detecta el schema legacy (`data BLOB NOT NULL` o `storage_key` nullable). El rebuild es atómico (transaction libsql) y rechaza ejecutar si alguna fila tiene `storage_key IS NULL`.

Cobertura confiable:
- `backend/src/__tests__/db-migration-rebuild.test.ts` cubre:
  - rebuild happy path: legacy schema con un row migrado → rebuild aplica, row preservado, `data` borrada, `storage_key NOT NULL`
  - refusal: legacy schema con un row sin `storage_key` → throw con mensaje claro, tabla legacy intacta (no partial state)
  - no-op: schema ya migrado → función no toca nada

Impacto:
- El bug que rompió el primer deploy de `6dc0a7f` (libsql `SQL_PARSE_ERROR` por `[notnull] AS notnull`) ahora habría sido detectado en CI antes del push. La gap de "no había tests sobre la propia lógica de migración" queda cerrada.
- Render mantiene la garantía de "deploy fail = previous version stays live" pero ya no depende de eso para validar correctitud de migrations.

## Coverage map resumido

Leyenda:
- `covered`: protegido hoy en las capas requeridas
- `partial`: hay cobertura real, pero no alcanza para el contrato UAT
- `missing`: no hay cobertura confiable para el contrato
- `flags`: observaciones residuales si existieran; hoy no quedan flags prioritarios abiertos en esta matriz

| ID | Pri | Estado | Capas reales hoy | Flags | Evidencia real | Falta / contradicción principal |
|----|-----|--------|------------------|-------|----------------|---------------------------------|
| `ONBOARD-01` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-assets.test.ts`, `backend/src/__tests__/api-extract.test.ts`, `backend/src/__tests__/api-users.test.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | First-time onboarding actual ya cubre nombre, upload soportado, review del perfil extraído y entrada al shell sin perder contexto |
| `ONBOARD-02` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-extract.test.ts`, `backend/src/__tests__/frontend-onboarding-errors.test.ts`, `e2e/specs/18-onboarding-and-assets-resilience.spec.ts` | Fallas de extracción ya muestran copy segura, esconden detalles internos y permiten retry limpio sobre la UI actual |
| `AUTH-01` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-me.test.ts`, `backend/src/__tests__/api-users.test.ts` (incluye email del provider persistido), `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | Bootstrap linked-first-login ya cubre landing real, entrada al shell, plan `free` visible y `users.email` poblado desde la sesión SuperTokens |
| `AUTH-02` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-me.test.ts`, `backend/src/__tests__/api-chat.test.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | Restore linked `free` ya recupera historial persistido y evita tratar al usuario como nuevo |
| `AUTH-03` | `P0` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `backend/src/__tests__/api-report.test.ts`, `backend/src/__tests__/frontend-report-access.test.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | Restore linked `basic` y `premium` ya expone label de plan y gating/unlock correctos en la UI real |
| `AUTH-04` | `P0` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-me.test.ts`, `backend/src/__tests__/auth-identity-contract.test.ts`, `backend/src/__tests__/auth-surface.test.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | Anonymous redirige limpio a auth, unlinked puede completar bootstrap y inactive queda bloqueado con copy user-safe |
| `AUTH-05` | `P0` | `covered` | `BE + UI + E2E` | - | `backend/src/__tests__/api-me.test.ts`, `backend/src/__tests__/api-report.test.ts`, `backend/src/__tests__/api-assets.test.ts`, `e2e/specs/12-auth-runtime-resilience.spec.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts` | Logout, expiry mid-chat, expiry durante report/assets y mutaciones protegidas sin side effects ya quedan cubiertos con recovery user-safe |
| `AUTH-06` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/frontend-auth-flow.test.ts`, `backend/src/__tests__/passwordless-email.test.ts`, `backend/src/__tests__/auth-config.test.ts`, `e2e/specs/19-auth-passwordless-flow.spec.ts` | Email submit, code submit, resend, invalid code, loading states y magic-link return paths ya tienen coverage UI real con copy segura |
| `ACCESS-01` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-users.test.ts`, `backend/src/__tests__/frontend-admin-support.test.ts`, `e2e/specs/15-admin-support-copy.spec.ts`, `e2e/specs/16-admin-support-flow.spec.ts` | Non-admin no puede usar rutas admin, no ve el entrypoint en el shell y admin sí puede abrir soporte desde la UI actual |
| `CHAT-01` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `e2e/specs/06-chat-db-consistency.spec.ts` | El loop actual ya queda protegido con quick action + typed follow-up + stream + reload preservando la conversación persistida |
| `CHAT-02` | `P0` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `backend/src/__tests__/frontend-chat-limits.test.ts`, `e2e/specs/05-chat-freemium-limits.spec.ts` | Free quota stop ya protege bloqueo, historial visible, CTA correcta y transición a estado capped sin depender del contrato `15` |
| `CHAT-03` | `P0` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `backend/src/__tests__/frontend-chat-limits.test.ts`, `e2e/specs/05-chat-freemium-limits.spec.ts`, `e2e/specs/14-chat-plan-upgrade.spec.ts` | Basic y premium ya quedan cubiertos en sus propios límites y estados capped visibles, más unlock posterior para el upgrade path |
| `CHAT-04` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `e2e/specs/14-chat-plan-upgrade.spec.ts` | Upgrade `free -> basic` y `basic -> premium` ya preserva identidad, historial, navegación y send post-upgrade en la misma sesión |
| `CHAT-05` | `P0` | `covered` | `BE + UI + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `e2e/specs/03-chat-edit-message.spec.ts`, `e2e/specs/06-chat-db-consistency.spec.ts` | Editar un mensaje ya reescribe la rama, permite follow-up posterior y preserva sólo la conversación nueva tras reload |
| `CHAT-06` | `P1` | `covered` | `BE + UI + E2E` | - | `backend/src/__tests__/api-transcribe.test.ts`, `e2e/specs/04-chat-voice-notes.spec.ts` | El route actual ya protege missing-file, transcripción larga y timeout saneado; la UI real ya permite cerrar error y reintentar sin wedgear el recorder |
| `CHAT-07` | `P0` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-chat.test.ts`, `backend/src/__tests__/frontend-chat-errors.test.ts`, `e2e/specs/01-chat-send-message.spec.ts`, `e2e/specs/12-auth-runtime-resilience.spec.ts`, `e2e/specs/04-chat-voice-notes.spec.ts` | Timeout, conectividad caída, backend genérico, transcription failure y session expiry ya preservan UI usable con copy segura; backend directo protege no-duplicate persistence |
| `REPORT-01` | `P0` | `covered` | `BE + unit + helper + E2E` | - | `backend/src/__tests__/api-report.test.ts`, `backend/src/__tests__/report-generation.test.ts`, `backend/src/__tests__/frontend-report-view-model.test.ts`, `e2e/specs/07-report-first-generation.spec.ts`, `e2e/specs/08-report-cache-first-loading.spec.ts`, `e2e/specs/10-report-pdf-share.spec.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | `free/basic` ya comparten una sola superficie con base visible y continuación premium locked según el contrato actual |
| `REPORT-02` | `P0` | `covered` | `BE + unit + helper + E2E` | - | `backend/src/__tests__/api-report.test.ts`, `backend/src/__tests__/report-generation.test.ts`, `backend/src/__tests__/frontend-report-view-model.test.ts`, `e2e/specs/17-auth-bootstrap-and-restore.spec.ts` | `premium` ya desbloquea la misma continuación in place con acciones `share/pdf` en tier correcto y sin locks residuales |
| `REPORT-03` | `P0` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-report.test.ts`, `e2e/specs/07-report-first-generation.spec.ts`, `e2e/specs/10-report-pdf-share.spec.ts`, `e2e/specs/11-report-regeneration.spec.ts` | Generate, replace/regenerate, share y PDF ya quedan protegidos en UI real para el tier permitido; backend directo cubre el rechazo premium disallowed para `free/basic` |
| `REPORT-04` | `P1` | `covered` | `BE + UI + E2E` | - | `backend/src/__tests__/api-report.test.ts` (incluye regression de timestamps en regen), `e2e/specs/08-report-cache-first-loading.spec.ts`, `e2e/specs/09-report-intake-persistence.spec.ts`, `e2e/specs/11-report-regeneration.spec.ts` | El intake actual ya puede omitirse, editarse y forzar regeneración in-place sin romper cache ni estado previo. Regen preserva `created_at` original y avanza solo `updated_at` |
| `REPORT-05` | `P0` | `covered` | `BE + UI + E2E` | - | `backend/src/__tests__/api-report.test.ts`, `e2e/specs/07-report-first-generation.spec.ts`, `e2e/specs/11-report-regeneration.spec.ts` | Degraded path, 502 saneado, 429, preservación de reporte previo y cooldown actual tras fallo ya quedan explicitados y cubiertos |
| `TRANSIT-01` | `P1` | `covered` | `BE + unit + E2E` | - | `backend/src/__tests__/api-transits.test.ts`, `backend/src/__tests__/transit-impact.test.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts`, `e2e/specs/20-transits-weekly-view.spec.ts` | Weekly transits actual ya carga, expande cards y muestra impact sections personalizadas en UI real |
| `TRANSIT-02` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-transits.test.ts`, `backend/src/__tests__/frontend-transit-errors.test.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts`, `e2e/specs/20-transits-weekly-view.spec.ts` | Falla backend y recovery ya quedan cubiertos con copy segura y reentrada limpia a la superficie |
| `ASSET-01` | `P1` | `covered` | `BE + E2E` | - | `backend/src/__tests__/api-assets.test.ts` (corre sobre stub R2), `backend/src/__tests__/storage-r2.test.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts`, `e2e/specs/18-onboarding-and-assets-resilience.spec.ts` | Empty state, upload, preview, close preview y delete ya quedan cubiertos sobre la superficie actual. Backend ahora usa Cloudflare R2 como source of truth — contrato HTTP no cambió |
| `ASSET-02` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-assets.test.ts`, `backend/src/__tests__/frontend-asset-errors.test.ts`, `backend/src/__tests__/storage-r2.test.ts`, `e2e/specs/18-onboarding-and-assets-resilience.spec.ts` | Invalid upload, oversize, preview failure, forbidden delete y missing delete ya preservan copy amigable y superficie usable. R2 errors propagan a 500 sin leakear detalles del SDK |
| `PROFILE-01` | `P1` | `covered` | `UI + E2E` | - | `e2e/specs/17-auth-bootstrap-and-restore.spec.ts`, `e2e/specs/22-profile-panel-visibility.spec.ts` | El panel de perfil actual muestra cues de plan/acceso y sigue usable aunque el HD venga parcial |
| `NAV-01` | `P1` | `covered` | `UI + E2E` | - | `e2e/specs/21-navigation-state-preservation.spec.ts`, `e2e/specs/07-report-first-generation.spec.ts`, `e2e/specs/08-report-cache-first-loading.spec.ts` | La navegación principal actual preserva el tab originante y evita dead-ends entre Chat/Tránsitos/Mis Cartas/Intake/Report |
| `ADMIN-01` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-users.test.ts`, `backend/src/__tests__/frontend-admin-support.test.ts`, `e2e/specs/15-admin-support-copy.spec.ts`, `e2e/specs/16-admin-support-flow.spec.ts` | List, search, paginate, open detail y soporte visible ya quedan protegidos en UI real; los failure states user-safe siguen cubiertos aparte |
| `ADMIN-02` | `P1` | `covered` | `BE + helper + E2E` | - | `backend/src/__tests__/api-users.test.ts`, `backend/src/__tests__/frontend-admin-support.test.ts`, `e2e/specs/15-admin-support-copy.spec.ts`, `e2e/specs/16-admin-support-flow.spec.ts` | Mutación feliz sobre otra persona, refresh posterior, self-mutation blocked y save failure ya quedan cubiertos con contrato actual |
| `RESP-01` | `P0` | `covered` | `E2E + visual smoke` | - | `e2e/specs/13-mobile-core-surfaces.spec.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts-snapshots/mobile-chat-shell-visual-smoke-chromium-darwin.png`, `e2e/specs/13-mobile-core-surfaces.spec.ts-snapshots/mobile-report-locked-visual-smoke-chromium-darwin.png` | Auth/logout, chat, voice success/error recovery, report, transits, assets, profile y upgrade CTA ya quedan protegidos en viewport mobile real sin overflow horizontal; visual smoke vigente sobre chat shell y locked report |
| `RESP-02` | `P1` | `covered` | `E2E + visual smoke` | - | `e2e/specs/23-layout-stability-overlays.spec.ts`, `e2e/specs/23-layout-stability-overlays.spec.ts-snapshots/desktop-profile-panel-layout-smoke-chromium-darwin.png`, `e2e/specs/23-layout-stability-overlays.spec.ts-snapshots/desktop-report-locked-layout-smoke-chromium-darwin.png`, `e2e/specs/23-layout-stability-overlays.spec.ts-snapshots/desktop-asset-preview-layout-smoke-chromium-darwin.png`, `e2e/specs/23-layout-stability-overlays.spec.ts-snapshots/mobile-profile-panel-layout-smoke-chromium-darwin.png`, `e2e/specs/23-layout-stability-overlays.spec.ts-snapshots/mobile-asset-preview-layout-smoke-chromium-darwin.png` | El shell actual ya protege overlay/dropdown/modal/locked-state fit y cierre limpio en desktop/mobile, sin depender de wiring legacy ni de smoke incidental |
| `COPY-01` | `P0` | `covered` | `helper + UI + E2E` | - | `backend/src/__tests__/frontend-chat-errors.test.ts`, `backend/src/__tests__/frontend-transit-errors.test.ts`, `backend/src/__tests__/frontend-auth-flow.test.ts`, `backend/src/__tests__/frontend-admin-support.test.ts`, `backend/src/__tests__/frontend-asset-errors.test.ts`, `e2e/specs/01-chat-send-message.spec.ts`, `e2e/specs/07-report-first-generation.spec.ts`, `e2e/specs/12-auth-runtime-resilience.spec.ts`, `e2e/specs/13-mobile-core-surfaces.spec.ts`, `e2e/specs/15-admin-support-copy.spec.ts` | Chat/report/transits/auth/admin/assets ya tienen coverage helper y/o UI real para no filtrar strings internas, rutas, status codes ni diagnósticos crudos en las superficies auditadas actuales |
| `MIGRATION-01` | `P1` | `covered` | `BE` | - | `backend/src/__tests__/db-migration-rebuild.test.ts` | Rebuild del schema legacy de `assets` cubre happy path, refusal con NULL `storage_key` y no-op sobre schema migrado. Cierra la gap de "no había tests sobre la lógica de migración" que dejó pasar el bug `SQL_PARSE_ERROR` del primer deploy |

## Existing suites que sí aportan valor real hoy

### Backend contract coverage útil

- `backend/src/__tests__/api-me.test.ts`
  - protege `GET /api/me`, `PUT /api/me`, bootstrap compatibility
- `backend/src/__tests__/api-users.test.ts`
  - protege admin list/detail/access mutation, default plan `free` y persistencia del email del provider en signup (happy + fallback a NULL ante `SuperTokens.getUser` falla)
- `backend/src/__tests__/api-chat.test.ts`
  - protege auth/identity mismatch, history retrieval, monthly usage windows, limits `20/120/300`, happy-path persisted send/stream, no duplicate persistence ante fallo y upgrade de plan preservando identidad/historial
- `backend/src/__tests__/api-transcribe.test.ts`
  - protege `POST /api/transcribe` para missing-file, transcripción larga y timeout-style upstream failure
- `backend/src/__tests__/api-assets.test.ts`
  - protege upload/list/download/delete, validaciones, ownership y `POST /api/me/assets` corriendo sobre el stub R2 in-memory de `helpers.ts`
- `backend/src/__tests__/api-report.test.ts`
  - protege `POST /api/me/report`, degraded/failure handling, cache hit/regeneration con intake, read/share/pdf access, gating premium y la regression de timestamps en regen (`created_at` preservado, `updated_at` avanza)
- `backend/src/__tests__/api-transits.test.ts`
  - protege shape, impacto, failure 502 y recovery posterior de `/api/transits`
- `backend/src/__tests__/api-extract.test.ts`
  - protege auth/ownership/existence/success de extraction
- `backend/src/__tests__/storage-r2.test.ts`
  - protege el adapter R2: detección de config, build de keys, inferencia de extensión y put/get/delete sobre cliente S3 stubbed
- `backend/src/__tests__/db-migration-rebuild.test.ts`
  - protege la migración del schema legacy de `assets` en sus tres estados reales (rebuild aplicado, refusal por NULL `storage_key`, no-op sobre schema migrado)

### Unit/helper coverage útil pero no equivalente a UI

- `backend/src/__tests__/report-generation.test.ts`
- `backend/src/__tests__/frontend-report-view-model.test.ts`
- `backend/src/__tests__/frontend-report-access.test.ts`
- `backend/src/__tests__/frontend-chat-limits.test.ts`
- `backend/src/__tests__/frontend-chat-errors.test.ts`
- `backend/src/__tests__/frontend-auth-flow.test.ts`
- `backend/src/__tests__/frontend-admin-support.test.ts`
- `backend/src/__tests__/frontend-asset-errors.test.ts`
- `backend/src/__tests__/frontend-onboarding-errors.test.ts`
- `backend/src/__tests__/frontend-transit-errors.test.ts`
- `backend/src/__tests__/auth-identity-contract.test.ts`
- `backend/src/__tests__/auth-surface.test.ts`
- `backend/src/__tests__/auth-config.test.ts`
- `backend/src/__tests__/passwordless-email.test.ts`
- `backend/src/__tests__/transit-impact.test.ts`
- `frontend/vite.config.test.ts`
  - protege reglas de dev proxy/auth shell, no contrato UAT de usuario final
- `backend/src/hd-pdf/pdf-fixtures.test.ts`
  - protege parsers PDF puntuales, no reemplaza coverage del onboarding completo

## Wrong / falsa cobertura concreta

### Residual stale real hoy

- El harness central `e2e/helpers/mock-api.ts` ya está alineado a `/api/me*`, límites `20/120/300` y premium report v2.
- Los specs `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12` y `13` ya no dependen del wiring legacy detectado al inicio del audit.
- El riesgo stale residual quedó concentrado más en breadth que en drift de contrato: faltan recorridos/pantallas, pero no persiste el desacople base `/api/users/*`, `15`, o premium legacy dentro de la superficie ya reparada.

## Cleanup estructural reconciliado

- `backend/src/__tests__/api-me.test.ts` quedó acotado a superficies `/api/me`; el bootstrap/identity ownership de `POST /api/users` volvió a `backend/src/__tests__/api-users.test.ts`.
- `backend/src/__tests__/api-chat.test.ts` ya no trata `DELETE /api/me/messages` como snapshot de límites: ahora protege truncado real, rewrite de rama y continuidad posterior para `free/basic/premium`.
- Los specs de report `07` a `11` comparten ahora el helper `e2e/helpers/report.ts` para el arranque autenticado y la navegación `profile -> report/intake/edit`, y se podó la aserción duplicada de prefill que repetía cobertura entre `08` y `09`.

## Contradicciones explícitas UAT vs código vs tests

1. UAT exige `E2E + visual smoke` para `RESP-01`:
- hoy existe coverage mobile funcional sobre auth/logout, chat, voice, report, transits, assets, profile y upgrade CTA
- ya existe visual smoke en chat shell y report locked mobile

## Backlog propuesto de ejecución

### Primero: gaps `P0`

1. `P0` remanentes prioritarios:
- Ninguno en la matriz actual

### Después: gaps `P1`

1. Ninguno en la matriz actual

### Después: trabajo no-urgente

1. Ninguno prioritario abierto tras el cleanup de esta sesión

## UAT update recommendation

- En esta corrida sí se actualizó `docs/uat-test-plan.md` para reflejar los contratos nuevos de la sesión 2026-04-25/26:
  - email del provider persistido al signup
  - `created_at` preservado en regen del report
  - assets viviendo en Cloudflare R2 (BLOB legacy dropeado)
  - `MIGRATION-01` (P1) agregado como contrato de boot-time schema migrations
- El drift de contrato detectado al inicio ya quedó reparado en la base E2E.
- El gap de "no había tests sobre la propia lógica de migración" quedó cerrado con `db-migration-rebuild.test.ts`. El bug `SQL_PARSE_ERROR` del primer deploy de `6dc0a7f` ahora habría sido detectado en CI antes del push.
- Cualquier trabajo siguiente ya sería expansión nueva o refactor oportunista, no reparación urgente de confiabilidad.
