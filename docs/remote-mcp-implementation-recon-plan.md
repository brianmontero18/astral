# Remote MCP — reconocimiento y plan de implementacion

**Estado**: plan de reconocimiento para convertir la propuesta en slices implementables.
**Fecha**: 2026-05-17.
**Bead**: `astral-de7`.
**Base**: `feature/astral-mcp-architecture`.
**Documento previo**: [`remote-mcp-architecture-proposal.md`](remote-mcp-architecture-proposal.md).

---

## Resumen ejecutivo

El MVP es viable, pero antes de escribir MCP hay que separar tres cosas que hoy estan mezcladas en `routes/chat.ts`:

1. **Resolucion de usuario/contexto**: perfil, intake, memory, plan, onboarding.
2. **Ejecucion del agente**: transitos, impact, v1/v2, prompt, usage.
3. **Side effects**: `chat_messages`, `memory_writer`, `llm_calls`, quotas.

La implementacion correcta no empieza creando `/api/mcp`. Empieza extrayendo una capa interna `guide-service` que pueda ser llamada por:

```text
/api/chat         -> adapter REST actual
/api/chat/stream  -> adapter SSE actual
/api/mcp/v1       -> adapter MCP nuevo
```

MCP debe entrar despues como otro adapter sobre ese servicio compartido.

---

## Hallazgos del codebase

### 1. Deploy y routing

El Dockerfile actual construye frontend y backend, pero en prod corre un solo proceso:

```text
CMD node backend/dist/server.js
```

`server.ts` arma Fastify, registra static frontend en prod y deja SPA fallback para cualquier ruta no-API. La API real vive bajo el prefijo `/api` en `app.ts`.

Patron actual:

```text
backend/src/server.ts
  -> buildApp()
  -> static frontend in prod
  -> SPA fallback

backend/src/app.ts
  -> cors
  -> multipart
  -> SuperTokens
  -> /auth/* outside /api
  -> /api/* business routes
```

Implicacion:

- MCP debe registrarse dentro del prefijo `/api`, como `/api/mcp/v1`, sin tocar el SPA fallback.
- `/mcp/v1` queda descartado para MVP porque exige registrarlo fuera del bloque `/api` y abre una segunda convencion de routing.
- `/api/mcp/v1` es menos riesgoso en el repo actual y quedo locked en Slice 0.

Archivos relevantes:

- `Dockerfile`
- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/config/flags.ts`
- `backend/src/__tests__/auth-surface.test.ts`

### 2. Chat orchestration

`backend/src/routes/chat.ts` tiene 692 lineas y mezcla:

- parsing/validacion de request;
- resolucion de usuario por SuperTokens session;
- carga de profile/intake/memory;
- quotas por plan;
- parsing de `transitContext`;
- calculo de transitos e impact;
- seleccion de agente v1/v2 por `FLAGS.CHAT_USE_TOOLS`;
- persistencia de mensajes;
- telemetry en `llm_calls`;
- memory writer fire-and-forget;
- SSE streaming.

Puntos de extraccion claros:

- `parseTransitChatContext`
- `getTransitsForChat`
- `truncateChatHistory`
- `persistLlmCall`
- `triggerMemoryWriterAsync`
- el bloque repetido de carga `profile/intake/memory/plan`
- el bloque `runAgent` / `runAgentStream`

MCP necesita usar casi todo eso, excepto:

- no aceptar `profile` ni `userId` del cliente;
- no persistir `chat_messages` en MVP;
- no disparar `memory_writer` en MVP;
- registrar telemetry separada;
- aplicar budgets/rate limits propios.

Archivos relevantes:

- `backend/src/routes/chat.ts`
- `backend/src/agent-service.ts`
- `backend/src/agent-service-v2.ts`
- `backend/src/agent-service-v2-prompt.ts`
- `backend/src/agent-prompt-helpers.ts`
- `backend/src/memory-writer.ts`
- `backend/src/transit-service.ts`
- `backend/src/chat-limits.ts`

### 3. Auth actual

La auth web esta bien separada pero es cookie/session based:

```text
request -> getOptionalSessionPrincipal()
        -> SuperTokens verifySession()
        -> resolveCurrentUser()
        -> findUserByIdentity("supertokens", subject)
```

Ese modelo no alcanza para MCP porque MCP necesita un principal bearer/OAuth por request:

```text
McpPrincipal {
  userId
  clientId
  scopes
  audience
  tokenId
}
```

El resolver actual `resolveCurrentUser` sirve como referencia conceptual, pero no debe recibir tokens MCP ni depender de cookies. Hay que crear un resolver paralelo:

```text
resolveMcpPrincipal(request) -> McpPrincipal | auth error
```

Archivos relevantes:

- `backend/src/auth/session.ts`
- `backend/src/auth/current-user.ts`
- `backend/src/auth/identity.ts`
- `backend/src/auth/supertokens.ts`
- `backend/src/__tests__/auth-identity-contract.test.ts`
- `backend/src/__tests__/api-me.test.ts`
- `backend/src/__tests__/api-chat.test.ts`

### 4. DB y telemetry

`llm_calls.route` hoy tiene CHECK cerrado:

```text
'chat','chat_stream','report','extraction','memory_writer'
```

MCP necesita al menos `mcp_ask`. Si se quieren eventos mas granulares, no conviene meter todo en `llm_calls`; conviene separar:

- `llm_calls`: costo/tokens/modelo por llamada LLM;
- `mcp_audit_events`: auth/tool/budget/error lifecycle;
- `mcp_clients`: clientes externos registrados;
- `mcp_tokens`: tokens emitidos/revocados;
- `mcp_consents`: consentimiento usuario-cliente-scope;
- `mcp_budget_counters` o calculo por query desde audit/llm_calls.

Patron de migracion existente:

- `CREATE TABLE IF NOT EXISTS ...` en `initDb`;
- `ALTER TABLE ... ADD COLUMN` idempotente cuando alcanza;
- rebuild de tablas cuando cambia CHECK constraint;
- tests directos de migracion en `db-migration-*.test.ts`.

Archivos relevantes:

- `backend/src/db.ts`
- `backend/src/llm/pricing.ts`
- `backend/src/__tests__/llm-telemetry.test.ts`
- `backend/src/__tests__/db-migration-cached-tokens.test.ts`
- `backend/src/__tests__/db-migration-rebuild.test.ts`
- `backend/src/__tests__/admin-llm-usage.test.ts`

### 5. Test harness

Los tests de integracion usan:

- `createTestApp()` con DB in-memory;
- `sessionHeaders()` para simular SuperTokens via `session-mock`;
- mocks de agentes/transitos para no llamar OpenAI;
- `app.inject()` para requests Fastify.

Para MCP conviene replicar ese patron:

- helper `mcpAuthHeaders(token)` o token seed helper;
- tests de route con `app.inject()`;
- mocks del `guide-service`, no del protocolo MCP si se puede;
- tests unitarios para `resolveMcpPrincipal`.

Archivos relevantes:

- `backend/src/__tests__/helpers.ts`
- `backend/src/__tests__/session-mock.ts`
- `backend/src/__tests__/api-chat.test.ts`
- `backend/src/__tests__/llm-telemetry.test.ts`

---

## Arquitectura objetivo

```text
backend/src/
  routes/
    chat.ts                      # adapter REST/SSE actual
    mcp.ts                       # adapter MCP nuevo

  services/
    guide-service.ts             # shared orchestration
    guide-transits.ts            # parse/get transits, optional extraction
    guide-telemetry.ts           # LLM telemetry helper

  mcp/
    auth.ts                      # bearer/OAuth principal
    clients.ts                   # client/consent helpers
    budgets.ts                   # limits + counters
    server.ts                    # MCP transport/server
    tools/
      ask-astral-guide-v1.ts
      hd-v1.ts
      transits-v1.ts
```

Dependency direction:

```text
routes/chat.ts  ---> services/guide-service.ts
routes/mcp.ts   ---> mcp/server.ts ---> mcp/tools/* ---> services/guide-service.ts

services/*      ---> db/transit/agent/memory/pricing
mcp/auth.ts     ---> db only
mcp/tools/*     ---> no Fastify globals, no SuperTokens session
```

MCP tools must not call REST handlers or self-HTTP.

---

## Proposed service contract

```ts
type GuideSideEffectsMode = "web_persisted" | "mcp_read_only";

interface RunGuideTurnInput {
  userId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  transitContext?: unknown;
  sideEffectsMode: GuideSideEffectsMode;
  source: "web_chat" | "mcp";
  clientId?: string;
}

interface RunGuideTurnResult {
  content: string;
  transitsUsed: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens?: number;
  };
  latencyMs?: number;
  toolsUsed?: string[];
}
```

MVP behavior:

```text
web_persisted:
  - enforce chat plan quota
  - persist chat_messages
  - trigger memory_writer
  - persist llm_calls route chat/chat_stream

mcp_read_only:
  - enforce MCP budget
  - do not persist chat_messages
  - do not trigger memory_writer
  - persist llm_calls route mcp_ask
  - persist mcp audit event
```

---

## Implementation slices

### Slice 0 — Decision locks

Status: cerrado en `astral-6ry`.

Locked decisions:

- endpoint path: `/api/mcp/v1`;
- transport default: stateless Streamable HTTP; SSE only if a beta client requires it;
- beta token strategy: short-lived PAT private beta, admin/script-issued, hashed, scoped, revocable, `audience=astral-mcp`, max 7 day expiry;
- production auth: OAuth/OIDC-compatible before consumer/ChatGPT support;
- consent: required in `mcp_consents` from Slice 2, including PAT beta;
- first smoke order: Claude Code first; Codex/Cursor if their local config supports remote HTTP bearer/OAuth; ChatGPT after OAuth; Gemini research-only;
- initial budgets: `ask_astral_guide_v1` 20/day and 100/month per user in beta; deterministic tools 100/day and 500/month; concurrency max 1 `ask` per user and 3 per client; 45s `ask` timeout, 5s deterministic timeout;
- quota relationship: MCP quota is separate from web chat quota and must not consume `chat_messages`.

Exit criteria:

- accepted decisions added to `docs/remote-mcp-architecture-proposal.md`;
- no open blocker remains that changes `mcp_clients`, `mcp_consents`, `mcp_tokens` or `mcp_audit_events`;
- next implementation work starts at Slice 1, not `/api/mcp/v1`.

### Slice 1 — Extract guide service without behavior change

Goal: move orchestration out of `routes/chat.ts` while keeping `/api/chat` and `/api/chat/stream` identical.

Likely files:

- `backend/src/services/guide-service.ts`
- `backend/src/services/guide-transits.ts`
- `backend/src/services/guide-telemetry.ts`
- `backend/src/routes/chat.ts`
- `backend/src/__tests__/api-chat.test.ts`
- `backend/src/__tests__/llm-telemetry.test.ts`
- `backend/src/__tests__/memory-integration.test.ts`

Acceptance:

- existing chat tests pass unchanged or with minimal test-only import updates;
- v1/v2 flag behavior unchanged;
- SSE response shape unchanged;
- memory writer still fires only for web persisted mode;
- no MCP code yet.

### Slice 2 — MCP auth model and schema

Status: cerrado en `astral-3pv`.

Goal: create the minimum DB/auth primitives for external clients.

Likely schema:

```text
mcp_clients
  id, name, status, created_at, updated_at

mcp_consents
  id, user_id, client_id, scopes_json, status, created_at, revoked_at

mcp_tokens
  id, token_hash, user_id, client_id, scopes_json, audience,
  expires_at, revoked_at, created_at

mcp_audit_events
  id, user_id, client_id, token_id, event, tool_name,
  side_effects_mode, status, metadata_json, created_at
```

For beta, token generation can be admin/internal only. Do not build user-facing OAuth UI in this slice unless explicitly chosen in Slice 0.

Acceptance:

- token lookup hashes bearer token before comparing;
- expired/revoked/wrong audience/wrong scope fail before DB-heavy work or LLM call;
- disabled/banned Astral users cannot use MCP;
- missing consent blocks tool list/call;
- migration tests cover fresh DB and legacy DB.

Implemented scope:

- `mcp_clients`, `mcp_consents`, `mcp_tokens`, `mcp_audit_events` are created by idempotent DB schema migration;
- bearer auth resolver returns the fixed principal shape: `userId`, `clientId`, `scopes`, `audience`, `tokenId`;
- resolver is separate from SuperTokens cookie/session auth;
- no `/api/mcp/v1` route, transport, tool registry, OAuth UI, chat persistence, or memory writes were added in this slice.

### Slice 3 — MCP transport behind flag

Goal: register an MCP endpoint that can list zero or minimal tools safely.

Likely files:

- `backend/src/routes/mcp.ts`
- `backend/src/mcp/server.ts`
- `backend/src/mcp/auth.ts`
- `backend/src/config/flags.ts`
- `backend/src/app.ts`
- `backend/src/__tests__/api-mcp-auth.test.ts`

Acceptance:

- `FEATURE_REMOTE_MCP=false`: endpoint does not expose tools;
- unauthenticated request returns MCP-compatible auth error;
- authenticated request with consent can initialize/list tools;
- wrong Origin/header patterns rejected if required by transport;
- `/api/chat` tests still pass.

### Slice 4 — `ask_astral_guide_v1`

Goal: expose the main tool as read-only side-effect mode.

Input contract:

```json
{
  "question": "string",
  "mode": "general"
}
```

`mode` debe ser enum cerrado: `general`, `weekly_focus` o `transit_question`.

No `userId`, no profile, no memory, no raw system instructions.

Acceptance:

- derives user from `McpPrincipal`;
- calls `guide-service` with `sideEffectsMode=mcp_read_only`;
- does not write `chat_messages`;
- does not call `runMemoryWriter`;
- writes `llm_calls` route `mcp_ask`;
- writes audit events for started/completed/blocked;
- budget exceeded blocks before agent call;
- response excludes prompt, `memory_md`, intake raw, profile raw, secrets.

### Slice 5 — read-only support tools

Goal: expose deterministic helpers only after the main tool is safe.

Initial set:

- `find_channel_by_gates_v1`
- `find_channels_by_gate_v1`
- `get_center_for_gate_v1`
- optional `get_current_transit_context_v1`

Acceptance:

- deterministic tools do not call LLM;
- no PII returned;
- scoped separately (`mcp:read_hd`, `mcp:read_transits`);
- audit logged;
- budgeted.

### Slice 6 — client smoke matrix

Goal: prove real clients work before calling this a product surface.

Minimum:

```text
Client        Goal
Claude Code   connect/list/call ask tool
Codex         connect/list/call ask tool
Cursor        connect/list/call deterministic tool
ChatGPT       validate connector/OAuth path if available
```

Acceptance:

- each supported client has setup notes;
- unsupported clients are explicitly marked unsupported;
- failures feed back into transport/auth choices.

---

## Test plan

Backend tests:

- `mcp-auth.test.ts`
  - no token;
  - malformed token;
  - expired token;
  - revoked token;
  - wrong audience;
  - insufficient scope;
  - missing consent;
  - disabled user.

- `mcp-ask-tool.test.ts`
  - successful call uses DB user context;
  - payload `userId/profile/memory` rejected or ignored;
  - does not save `chat_messages`;
  - does not trigger memory writer;
  - writes `llm_calls` with `mcp_ask`;
  - budget exceeded prevents LLM call.

- `mcp-hd-tools.test.ts`
  - deterministic tools return same data as existing helpers;
  - no LLM call;
  - scope gating.

- migration tests:
  - new MCP tables exist on fresh DB;
  - route CHECK widening preserves existing `llm_calls`;
  - idempotent rerun.

Regression tests:

- existing `api-chat.test.ts`;
- existing `llm-telemetry.test.ts`;
- existing `memory-integration.test.ts`;
- `npm run check`;
- `npx vitest run`.

---

## Risks

### Critical

1. **Auth scope creep**: OAuth completo puede volverse proyecto propio. Mitigacion: beta PAT short-lived solo si se define como no-productivo.
2. **Memory contamination**: MCP mediated by another model can poison `memory_md`. Mitigacion: `mcp_read_only` default, no memory writer.
3. **Load isolation**: same Render service cannot isolate CPU/memory. Mitigacion: low beta budgets + circuit breaker + split triggers.
4. **Prompt injection via external agent**: host model can try to extract internals. Mitigacion: bounded schema, no raw memory/profile/prompt output.

### Warning

1. `routes/chat.ts` extraction can regress web chat if done too broadly.
2. `llm_calls.route` CHECK changes require rebuild migration.
3. MCP SDK/transport choice may differ by client.
4. `get_current_transit_context_v1` can leak location/time assumptions if not designed carefully.

---

## Recommended next step

Start with **Slice 0 + Slice 1** only.

Do not implement MCP endpoint until `guide-service` exists and web chat remains green. That gives a clean core boundary and makes later MCP work mostly auth/protocol/tool wiring instead of surgery inside `routes/chat.ts`.
