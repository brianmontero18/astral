# Remote MCP para Astral Guide — propuesta de arquitectura

**Estado**: propuesta con Slices 0-7 cerrados; `ask_astral_guide_v1` implementada en modo `mcp_read_only`; tools deterministicas HD implementadas con `mcp:read_hd`; matriz beta de clientes capturada; gate backend y smoke manual Claude Code HTTP + bearer verdes.
**Fecha**: 2026-05-17.
**Beads**: `astral-t45`, `astral-6ry`, `astral-3pv`, `astral-c8p`.
**Objetivo**: definir un punto de partida practico para exponer Astral Guide a clientes externos como ChatGPT, Claude, Gemini, Codex, Cursor o cualquier cliente compatible con MCP.

---

## TL;DR

Construir un **Remote MCP Server de Astral** como nueva superficie del backend.

No exportamos el prompt ni la memoria. Exponemos tools autenticadas que llaman al backend de Astral, donde siguen viviendo:

- perfil HD del usuario;
- intake de negocio;
- memoria persistente;
- tránsitos;
- tools HD deterministicas;
- cuotas, billing y telemetry;
- prompt/voz de Astral Guide.

Para MVP: **mismo backend, mismo Docker, mismo Render service**, detras de feature flag. Diseñarlo desde el dia 1 para poder extraerlo despues a un servicio separado si el uso lo justifica.

---

## Slice 0 — decision locks

Estas decisiones cierran el primer bloqueo de arquitectura. No habilitan MCP todavia; habilitan Slice 1 (`GuideService`) y preparan Slice 2/3 sin cambiar el contrato despues.

| Decision | Lock |
|---|---|
| Endpoint publico MVP | `/api/mcp/v1`. Sigue la convencion real de `backend/src/app.ts`, queda antes del SPA fallback y evita registrar una segunda superficie top-level. `/mcp/v1` y `mcp.astral.guide` quedan como opciones de Fase 2 si se separa servicio. |
| Transport default | Streamable HTTP stateless. SSE solo como compatibilidad si un cliente beta lo exige; no disenar session affinity. |
| Auth beta | Short-lived PAT privado solo para beta tecnica, emitido por admin/script interno, hasheado en DB, scoped, revocable, con `audience=astral-mcp`, `tokenId`, `clientId` y expiracion maxima de 7 dias. No es contrato publico ni reemplaza OAuth. |
| Auth produccion | OAuth/OIDC-compatible antes de soporte consumer o ChatGPT/App publicable. La forma interna del principal queda fija desde Slice 2: `userId`, `clientId`, `scopes`, `audience`, `tokenId`. |
| Consentimiento | Obligatorio desde Slice 2 incluso para PAT beta: `mcp_consents(user_id, client_id, scopes_json, status, created_at, revoked_at)`. Sin consentimiento activo no se listan ni ejecutan tools. |
| Primer smoke beta | Orden: Claude Code con HTTP + bearer; Codex y Cursor si aceptan configuracion remote HTTP/OAuth-bearer en la version local; ChatGPT solo despues de OAuth real. Gemini queda research-only hasta validar soporte MCP actual. |
| Budgets MVP | Separados por `clientId + userId + tool`: `ask_astral_guide_v1` max 20 llamadas/dia y 100/mes por usuario en beta; deterministic HD/transit tools max 100 llamadas/dia y 500/mes; concurrency max 1 `ask` por usuario y 3 por client; timeout duro 45s para `ask` y 5s para deterministic tools. |
| Relacion con chat quota | MCP no consume la cuota mensual de chat web. Usa cuota MCP separada para evitar que un cliente externo degrade la experiencia nativa. Billing/telemetry igual debe poder atribuir costo por usuario, cliente y tool. |
| Persistencia | MVP `mcp_read_only`: no escribe `chat_messages`, no dispara `memory_writer`, no muta profile/intake/memory. Solo audit, cost telemetry y counters. |

Exit criteria cumplido para Slice 0:

- no queda decision bloqueante que cambie la forma de `mcp_clients`, `mcp_consents`, `mcp_tokens` o `mcp_audit_events`;
- no crear `/api/mcp/v1` hasta completar Slice 1;
- cualquier cambio futuro de path/auth/budget requiere actualizar este bloque y el plan de recon.

---

## Decision propuesta

### Si para MVP

```text
Render Web Service actual
  Docker container
    node backend/dist/server.js
      /api/*       -> API actual de Astral
      /auth/*      -> SuperTokens web auth
      /api/mcp/v1  -> Remote MCP endpoint NUEVO
      token/OAuth endpoints MCP bajo /api/mcp/v1/auth/*
      /*           -> React static frontend
```

### No por ahora

```text
Render Service A: Astral web
Render Service B: Astral MCP
```

Separar servicios desde el dia 1 agrega deploy/ops antes de validar demanda. La separacion tiene sentido cuando haya trafico externo real, necesidades de escalado separadas, SLA propio, rate limits por cliente o riesgo de que MCP degrade la app web.

---

## Arquitectura mental

```text
Clientes propios
Browser Astral
        |
        v
  /api/chat/stream
        |
        v
+--------------------------+
| Astral backend Fastify   |
+--------------------------+

Clientes externos
ChatGPT / Claude / Gemini / Codex / Cursor
        |
        v
   /api/mcp/v1
        |
        v
+--------------------------+
| Astral backend Fastify   |
+--------------------------+
```

Ambas entradas deben terminar en la misma capa de negocio:

```text
Web app:
  React -> /api/chat/stream -> GuideService

MCP:
  External client -> /api/mcp/v1 -> ask_astral_guide_v1 -> GuideService
```

MCP no debe tener logica de Astral adentro. MCP es un adapter/protocolo.

---

## Diagrama de abstracciones

```text
                    +-----------------------------+
                    | External MCP Client         |
                    | ChatGPT / Claude / Cursor   |
                    +--------------+--------------+
                                   |
                                   | MCP + Bearer/OAuth
                                   v
                    +-----------------------------+
                    | MCP Transport Layer         |
                    | /api/mcp/v1                 |
                    +--------------+--------------+
                                   |
                                   | validate token, scopes, client
                                   v
                    +-----------------------------+
                    | MCP Adapter                 |
                    | tools, schemas, responses   |
                    +--------------+--------------+
                                   |
                                   | no userId/profile from client
                                   v
                    +-----------------------------+
                    | GuideService                |
                    | shared with web chat        |
                    +--------------+--------------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
              v                    v                    v
   +--------------------+  +----------------+  +---------------------+
   | User context       |  | Transit engine |  | HD deterministic    |
   | profile/intake/    |  | Swiss Eph WASM |  | tools/tables        |
   | memory             |  | impact calc    |  | channels/gates      |
   +--------------------+  +----------------+  +---------------------+
              |                    |                    |
              +--------------------+--------------------+
                                   |
                                   v
                    +-----------------------------+
                    | Astral Agent                |
                    | prompt + model + tools      |
                    +--------------+--------------+
                                   |
                                   v
                         OpenAI / configured LLM
```

---

## Tools MVP

### Principal

`ask_astral_guide_v1`

Input:

```json
{
  "question": "string"
}
```

Comportamiento:

- deriva el usuario desde el token MCP;
- carga profile/intake/memory desde DB;
- calcula transitos server-side;
- llama al agente actual de Astral;
- devuelve respuesta final en texto;
- registra telemetry/costo.

No acepta `userId`, `profile`, `memory` ni `intake` desde el cliente.

### Soporte read-only

Implementadas en Slice 5:

- `find_channel_by_gates_v1`
- `find_channels_by_gate_v1`
- `get_center_for_gate_v1`

Pendiente / no expuesta:

- `get_current_transit_context_v1`

Quedan fuera del MVP salvo decision explicita:

- `get_my_profile_summary_v1`: abre perfil personal y requiere consentimiento/scope propio.
- `analyze_my_transit_impact_v1`: aunque es read-only, revela datos derivados del bodygraph del usuario.

No exponer `memory_md` crudo. No exponer intake completo. No exponer birth data.

---

## Deploy recomendado

### Fase 1: mismo Render service

```text
+-------------------------------------------------+
| Render: astral-backend-prod                     |
+-------------------------------------------------+
| Dockerfile actual                               |
| CMD node backend/dist/server.js                 |
+-------------------------------------------------+
| Fastify                                         |
| - /api/*                                       |
| - /auth/*                                      |
| - /api/mcp/v1    NUEVO                         |
| - /api/mcp/v1/auth/* token/OAuth MCP           |
| - static React frontend                         |
+-------------------------------------------------+
```

Ventajas:

- menor complejidad operativa;
- reutiliza DB, R2, auth wiring, telemetry y agente actual;
- rollback por feature flag;
- valida demanda antes de crear otra app.

Condiciones:

- `FEATURE_REMOTE_MCP=false` por default;
- kill switch via env var;
- budgets, rate limits y circuit breakers por user/client/tool;
- timeouts y concurrency limits;
- logs estructurados;
- no estado en memoria local.

### Fase 2: servicio separado

Cuando el uso lo justifique:

```text
                +---------------------+
Browser ------> | astral-web          |
                | frontend + /api     |
                +----------+----------+
                           |
                           v
                    Shared Astral Core
                           ^
                           |
                +----------+----------+
ChatGPT ------> | astral-mcp                 |
Claude  ------> | /api/mcp/v1 + OAuth/PAT    |
Cursor  ------> | MCP only                   |
                +---------------------+

Shared dependencies:
- Turso
- R2
- SuperTokens/OAuth provider
- OpenAI/model provider
- telemetry
```

Triggers para separar:

- MCP afecta latencia de la web;
- conexiones largas o trafico externo impredecible;
- necesidad de deploy/rollback independiente;
- rate limits por cliente externo;
- logs, dashboards o SLA separados;
- costos MCP requieren billing/alerting propio.

---

## Trust boundary

Este proyecto cruza una frontera nueva:

```text
Usuario -> Cliente externo con su propio modelo -> Astral MCP -> Astral Agent
```

Ese cliente externo puede resumir, reescribir o inyectar instrucciones antes de llamar a Astral. Por eso MCP no debe tratar el input como equivalente a un mensaje nativo de la web app.

Modelo de principal minimo:

```text
endUser        = persona dueña de la cuenta Astral
externalClient = ChatGPT / Claude / Cursor / Codex / etc.
clientId       = identidad registrada del cliente externo
token          = credencial emitida para MCP
audience       = recurso esperado: astral-mcp
scopes         = tools/capabilities permitidas
```

Cada tool call debe auditar `endUser`, `clientId`, `tool`, `scope`, `sideEffectsMode`, costo, latencia y resultado.

## Auth y consentimiento

Bloque critico.

La sesion web actual de SuperTokens/cookies no alcanza para MCP. MCP necesita principal bearer/OAuth:

- usuario;
- cliente externo;
- audience/resource MCP;
- scopes;
- expiracion;
- revocacion;
- auditoria.

Antes de emitir token debe existir consentimiento explicito:

```text
"Autorizo a usar Astral Guide desde <externalClient> con estos scopes."
```

Scopes iniciales:

```text
mcp:ask
mcp:read_hd
mcp:read_transits
```

Scopes diferidos para tools que revelan perfil o impacto personal:

```text
mcp:read_profile_summary
mcp:read_personal_impact
```

No usar bearer permanente sin scopes para produccion. Un PAT puede servir solo para beta dev controlada con Codex/Cursor, no como contrato para ChatGPT/Claude consumer.

---

## Side effects contract

Default MVP: **`sideEffectsMode=read_only`**.

Permitido:

- leer profile/intake/memory server-side;
- calcular transitos;
- llamar al agente;
- registrar telemetry, audit logs, rate counters y costo;
- devolver respuesta final minimizada.

Prohibido en MVP:

- escribir en `chat_messages`;
- disparar `memory_writer`;
- modificar profile/intake/memory;
- subir o borrar assets;
- ejecutar admin actions;
- devolver prompt, `memory_md`, intake completo, profile raw o secrets.

Razon:

```text
Usuario -> ChatGPT -> Astral MCP -> Astral Agent
```

El mensaje puede llegar mediado por otro modelo. Si se persiste como conversacion nativa de Astral, la memoria puede contaminarse con contexto que no vino directamente del usuario.

Propuesta:

- leer profile/intake/memory para responder;
- registrar `llm_calls` o tabla equivalente para costo/telemetry;
- no mutar memory por default;
- si algun dia se habilita persistencia, hacerlo con flag separado (`FEATURE_REMOTE_MCP_PERSIST_CHAT`) y consentimiento explicito. No forma parte del MVP.

---

## Observabilidad minima

Cada tool call debe registrar:

- `userId`;
- `clientId`;
- tool;
- scopes;
- latency;
- tokens in/out;
- costo;
- status/error;
- request id;
- model;
- route (`mcp_ask`, `mcp_tool_hd`, etc.).

Tambien hacen falta:

- rate limit por user;
- rate limit por client;
- budget por `clientId + userId + tool`;
- budget diario/mensual;
- timeout duro por tool;
- concurrency limit;
- alertas de costo.

Eventos recomendados:

```text
mcp_auth_failed
mcp_tool_call_started
mcp_tool_call_completed
mcp_tool_call_blocked
mcp_budget_exceeded
```

---

## Guardrails

1. Path versionado desde el dia 1: `/api/mcp/v1` para MVP. No registrar `/mcp/v1` ni subdominio dedicado hasta Fase 2.
2. Feature flag default off: `FEATURE_REMOTE_MCP=false`.
3. No write tools en MVP.
4. No memory raw.
5. No `userId` enviado por cliente.
6. No profile enviado por cliente.
7. No self-HTTP contra `/api/chat`; llamar servicios internos.
8. Tool names y schemas versionados desde el primer commit (`*_v1`).
9. Stateless transport preferido; no session affinity.
10. Validar `Origin`/headers donde aplique.
11. Respuestas minimizadas: no prompt interno, no secrets, no stack traces.
12. Todo costo MCP debe quedar medible por separado del chat web.
13. Tokens short-lived, scoped, revocables y ligados a `clientId + userId + audience`.
14. Cuota MCP separada de la cuota web; nunca consumir `chat_messages` para budget MCP.

---

## Organizacion sugerida del codigo

```text
backend/src/
  routes/
    chat.ts                 # REST/SSE actual
    mcp.ts                  # registra endpoint MCP versionado

  mcp/
    auth.ts                 # bearer/OAuth principal + scopes
    server.ts               # MCP server/transport
    tools.ts                # registry
    tools/
      ask-astral-guide-v1.ts
      hd.ts
      transits.ts

  services/
    guide-service.ts        # capa compartida chat + MCP
```

La primera refactorizacion real deberia extraer desde `routes/chat.ts` una funcion compartida tipo:

```text
runAstralConversationTurn({
  userId,
  messages,
  transitContext,
  sideEffectsMode
})
```

El route HTTP y MCP deben ser adapters finos sobre esa funcion.

---

## Acceptance criteria del MVP con tools

1. Con `FEATURE_REMOTE_MCP=false`, el endpoint MCP no lista tools.
2. Sin token valido, el endpoint MCP versionado responde auth error.
3. Con token valido y scope `mcp:ask`, el cliente lista `ask_astral_guide_v1`.
4. `ask_astral_guide_v1` deriva usuario del token, no del payload.
5. `ask_astral_guide_v1` responde usando profile/intake/memory/transits server-side.
6. Un token sin scope correcto recibe `insufficient_scope`.
7. Tools read-only no devuelven `memory_md`, intake completo ni PII.
8. Las llamadas MCP quedan separadas en telemetry/costo.
9. MCP no rompe `/api/chat/stream`.
10. Rollback = cambiar una env var.
11. Un cliente sin consentimiento activo no puede listar ni ejecutar tools.
12. Token expirado, wrong audience o scope insuficiente falla antes de tocar DB/LLM.
13. Si excede budget por cliente/usuario/tool, responde error controlado sin llamar al agente.
14. Ninguna respuesta MCP contiene prompt, `memory_md`, intake completo, profile raw ni secrets.

---

## Compatibility matrix

No prometer soporte comercial hasta validar al menos una matriz beta.

```text
Cliente        Transporte/Auth a validar              Estado
Claude Code    Remote MCP HTTP + bearer                conectado localmente
Codex          Remote MCP config local/remoto          config HTTP bearer validada
Cursor         Remote MCP config local/remoto          bloqueado por auth/keychain local
ChatGPT        Remote MCP + OAuth/connector            despues de OAuth real
Gemini         soporte MCP real del cliente            research-only / CLI no validada
```

Esta matriz es release gate, no documentacion posterior.
Detalle operativo: [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md).

---

## Preguntas abiertas

Bloqueantes que cambian schema shape:

- Ninguno despues de Slice 0.

No bloqueantes:

- Si migrar el transporte manual minimalista a una libreria MCP de Node cuando agreguemos tools complejas o compatibilidad de cliente lo justifique. Slice 3 no necesito dependencia nueva.
- Nombre final de tools.
- Si `get_my_profile_summary_v1` debe existir despues del MVP y con que scope/consentimiento.
- Si el reporte semanal va como tool aparte o como prompt dentro de `ask_astral_guide_v1`.
- Si `mcp.astral.guide` debe apuntar al mismo Render service en Fase 2.

---

## Veredicto de deliberacion inicial

Sparring:

- Mismo backend para MVP esta bien, pero solo como beta privada.
- El riesgo grande no es MCP sino auth, scopes, costos, privacidad y carga.
- `ask_astral_guide_v1` preserva la voz, pero es un contrato amplio: requiere limites claros.
- Falta tratarlo como boundary agente-a-agente: prompt injection, minimizacion y side effects.

Architect:

- Aprobaria MVP con condiciones.
- No separar servicio todavia.
- Slice 0 cierra los bloqueantes de path, auth beta, persistencia, budgets y matriz de smoke.
- Recomienda `/api/mcp/v1`, transport stateless, feature flags y extraer un servicio compartido para chat/MCP antes de registrar MCP.
- Round 2 endurece el contrato: beta privada, consentimiento, budgets, tool `ask_astral_guide_v1`, no writes y versionado.

Decision recomendada:

```text
Construir Remote MCP dentro del backend actual como beta privada.
Mantenerlo apagado por default.
No persistir memoria/chat en MVP.
Exigir consentimiento + tokens scoped/short-lived.
Usar PAT beta solo para smoke tecnico; OAuth antes de soporte consumer.
Versionar endpoint/tools desde el dia 1.
Disenarlo para poder extraerlo a servicio separado.
```
