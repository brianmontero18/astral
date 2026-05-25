# Replace flow wipe scope

Estado: aceptado para implementacion
Fecha: 2026-05-25
Bead: `astral-pjc.2`
ADR base: `docs/adr/v1-mono-card-replace-policy.md`

## Decision

En V1, el replace de carta/bodygraph debe limpiar todo contexto visible o
inyectable que dependa de la carta anterior. No debe limpiar datos de auth,
plan, billing/usage, consentimientos ni telemetria operacional que no se usa
como contexto del agente.

La implementacion de `astral-pjc.3` debe usar un endpoint dedicado de replace
atomico. No alcanza con parchear los endpoints actuales:

- `POST /me/bodygraph` sube PDF y hoy reemplaza `users.profile` +
  `users.profile_asset_id` sin wipe.
- `POST /me/bodygraph/from-birth` calcula desde birth data y hoy reemplaza
  `users.profile` con `profile_asset_id = NULL` sin wipe.
- Ambos endpoints tambien son reutilizados por flujos de carga/onboarding. El
  replace confirmado desde Mi carta necesita una semantica distinta.

## Barrido realizado

- Schema completo en `backend/src/db.ts`.
- Writers/readers de `users`, `assets`, `chat_messages`, `hd_reports`,
  `report_shares`, `llm_calls`, transits y MCP.
- Rutas: `assets.ts`, `chat.ts`, `report.ts`, `transits.ts`, `users.ts`,
  `mcp/server.ts`, `mcp/tools/ask-astral-guide-v1.ts`.
- Frontend: `MyChartReplaceView`, `MyChartView`, `App`, `api.ts`,
  `ChatView`, `ReportView`.
- Tests relacionados: `api-assets`, `api-chat`, `api-report`, `api-mcp`,
  `memory-integration`, `api-transits`, E2E de chat/report/transits.

## Tabla DB exhaustiva

`assets_new` y `llm_calls_new` aparecen en migraciones/rebuilds de `db.ts`,
pero son tablas temporales, no superficies runtime a wipear.

| Tabla / campo | Accion en replace | Razon |
|---|---|---|
| `users.profile` | **UPDATE** a la carta nueva | Fuente canonica del bodygraph activo. |
| `users.profile_asset_id` | **UPDATE** al nuevo asset PDF o `NULL` si birth data | Driver de carta activa en `/me/assets`; birth data genera PDF on-demand. |
| `users.intake` | **SET NULL** | El intake describe a la persona/proyecto de la carta anterior. |
| `users.memory_md` | **SET ''** | Memoria global por user; puede contener facts de la carta anterior. Usar string vacio preserva el shape que `mapUserRow` ya expone. |
| `users.onboarding_status` | **Mantener `complete`** | Replace no debe reabrir onboarding. Reporte puede pedir intake luego; chat puede funcionar sin intake. |
| `users.onboarding_step` | **Mantener `NULL` si complete** | No hay wizard obligatorio post-replace en V1. |
| `users.name` | **Mantener salvo que el profile nuevo traiga nombre y producto lo decida** | El nombre de cuenta no es necesariamente el nombre del PDF. Evitar mutacion colateral en `.3` salvo patron existente requerido. |
| `users.plan`, `role`, `status`, `access_source`, `email` | **Mantener** | Access/auth/billing no dependen del bodygraph. |
| `assets` | **Borrar solo el asset activo anterior vinculado por `profile_asset_id`, si existe; mantener otros assets** | V1 es una carta activa. `file_type` historico no es fuente confiable para decidir; el vinculo activo lo define `users.profile_asset_id`. |
| `chat_messages` | **DELETE all rows for user** | Historial visible e inyectable en chat/context budget. Mantenerlo mezcla carta anterior con nueva. |
| `llm_calls` | **Mantener** | Telemetria de costo/auditoria; no se reinyecta al agente ni muestra contenido visible. `context_breakdown_json` guarda conteos/metadata, no el prompt completo. |
| `hd_reports` | **DELETE all rows for user** | Reportes se generan contra `profile_hash = profile.humanDesign + intake` y quedan conceptualmente obsoletos. |
| `report_shares` | **DELETE rows for user, o cascada al borrar `hd_reports`** | Links publicos a reportes viejos no deben seguir resolviendo. Borrado explicito recomendado aunque FK cascade exista. |
| `transit_cache` | **Mantener** | Cache colectivo por semana/timezone; no contiene profile del usuario. Impact se recalcula contra el profile actual. |
| `transit_snapshots_cache` | **Mantener** | Cache colectivo de snapshots; no contiene profile del usuario. |
| `user_identities` | **Mantener** | Auth identity no depende de bodygraph. |
| `mcp_clients` | **Mantener** | Catalogo de clients, no user/bodygraph. |
| `mcp_consents` | **Mantener** | Consentimiento OAuth/MCP por user-client; no autoriza una carta especifica en V1. |
| `mcp_tokens` | **Mantener** | Tokens siguen representando acceso al user actual. El siguiente MCP ask lee el profile nuevo. |
| `mcp_audit_events` | **Mantener** | Auditoria y conteo de uso MCP. No guarda la pregunta/respuesta del user; no se reinyecta. |

## Superficies no DB

| Superficie | Accion | Razon |
|---|---|---|
| R2/local asset storage `users/{userId}/assets/{assetId}.*` | Borrar objeto del asset activo anterior best-effort | Acompana el borrado de `assets`. R2 no es transaccional; DB es la verdad visible. |
| Frontend `App` state: `profile`, `intake`, `report`, `reportLoading`, `pendingRegenerateIntake`, `profileRevision` | Reset/update desde respuesta del endpoint | Evita mostrar informe/intake viejo hasta el proximo fetch. |
| Frontend `ChatView` local messages | Deben refrescar desde `/me/messages` despues del replace o remount limpio | Backend borra `chat_messages`; UI no debe conservar mensajes viejos en memoria si el usuario vuelve al chat. |
| Frontend `chatPrefill` / `transitChatContext` | Limpiar | Prefills desde tránsitos viejos no deben sobrevivir al cambio de carta. |
| `report.ts` `lastGenerationByUser` cooldown map | Mantener | Rate limit operacional, no contexto de carta. Puede bloquear regeneracion inmediata por hasta 30s; aceptable para anti-abuse. |
| GeoNames/places in-memory cache | Mantener | Cache global de lugares. |

## Endpoint surface

`astral-pjc.3` debe cerrar el bypass de replace sin wipe:

1. Crear `POST /me/bodygraph/replace` como path canonico de Mi carta.
2. Aceptar birth data o PDF con un contrato explicito de confirmacion desde UI
   (por ejemplo `confirmReplace: true`).
3. Ejecutar el wipe + persistencia nueva en una unidad de trabajo atomica a
   nivel DB.
4. Evitar que `POST /me/bodygraph` y `POST /me/bodygraph/from-birth` sigan
   siendo paths de replace para usuarios `complete` con carta existente sin
   pasar por la semantica nueva. Opciones aceptables:
   - reservarlos para onboarding/carga inicial;
   - o delegarlos internamente al mismo servicio atomico cuando corresponda.

## Orden de operaciones recomendado para `.3`

1. Autenticar user linked y cargar row actual.
2. Validar que el request viene del flujo de replace confirmado.
3. Calcular/extractar el nuevo `UserProfile` antes de mutar DB.
4. Si el input es PDF, preparar el nuevo asset. Si falla luego la transaccion,
   intentar cleanup best-effort del asset nuevo para evitar orphan.
5. Abrir transaccion DB.
6. Guardar `users.profile`, `users.profile_asset_id`, `users.intake = NULL`,
   `users.memory_md = ''`, `updated_at`.
7. Borrar `chat_messages` del user.
8. Borrar `report_shares` del user.
9. Borrar `hd_reports` del user.
10. Borrar row del asset activo anterior vinculado por `profile_asset_id`, si
    existe y es distinto al nuevo.
11. Commit.
12. Borrar objeto R2/local del asset anterior best-effort si no fue borrado por
    helper existente.
13. Responder con user actualizado, profile nuevo y estado suficiente para que
    frontend limpie intake/report/chat local.

Si falla cualquier paso dentro de la transaccion, no debe quedar profile nuevo
con chat/memory/report viejo ni wipe aplicado sin carta nueva.

## Tests que debe cubrir `.3`

- Replace desde birth data borra `chat_messages`, `memory_md`, `intake`,
  `hd_reports` y `report_shares`; mantiene plan/role/status/auth.
- Replace desde PDF hace lo mismo y deja solo el nuevo asset activo.
- Si falla la escritura despues de crear/preparar asset PDF, no queda estado DB
  mixto; cleanup de asset nuevo es best-effort.
- `llm_calls`, `mcp_tokens`, `mcp_consents`, `mcp_audit_events`,
  `user_identities`, `transit_cache` y `transit_snapshots_cache` se mantienen.
- Los endpoints legacy no permiten reemplazar una carta completa evitando el
  wipe.
- Shared report viejo devuelve 404/410 despues del replace.
- `/me/chat/context-budget` y `ask_astral_guide_v1` usan profile nuevo,
  memory vacia e intake nulo.

## Hallazgos de deuda fuera de scope

- `deleteAsset` borra R2 best-effort y luego DB; esto puede dejar orphans de R2.
  Es un trade-off ya existente. `.3` no necesita resolver storage
  transaccional, pero debe mantener logs suficientes.
- `lastGenerationByUser` puede demorar un nuevo reporte inmediatamente despues
  de replace si se genero uno hace menos de 30s. No es contaminacion, solo UX.
