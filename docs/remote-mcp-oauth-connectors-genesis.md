# Remote MCP OAuth connectors - genesis

**Estado**: material de apoyo para deliberar el siguiente ciclo de Remote MCP. No es spec ejecutable cerrada.
**Fecha**: 2026-05-17.
**Branch base**: `feature/astral-mcp-architecture`.
**Dominio objetivo**: `https://astral.soydanielamedina.com`.
**Endpoint MCP objetivo**: `https://astral.soydanielamedina.com/api/mcp/v1`.
**Docs relacionados**:

- [`remote-mcp-architecture-proposal.md`](remote-mcp-architecture-proposal.md)
- [`remote-mcp-implementation-recon-plan.md`](remote-mcp-implementation-recon-plan.md)
- [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md)

---

## Resumen ejecutivo

Astral ya tiene un Remote MCP beta funcionando por HTTP con bearer/PAT para
smoke tecnico y clientes de desarrollo como Claude Code. Eso no alcanza para
Claude Desktop, Claude Web o ChatGPT como conectores de usuario final.

La conclusion de research + deliberacion:

```text
No usar SuperTokens MCP plugin como camino principal.
No intentar hacer producto con PAT/static bearer.
No migrar el login web fuera de SuperTokens.
No agregar otro Render service todavia.

Camino recomendado:
  WorkOS Standalone Connect como OAuth layer para MCP.

Fallback serio:
  oidc-provider embebido en el backend si WorkOS no cierra.
```

La idea no es reescribir MCP ni cambiar la app web. La idea es agregar una capa
de autorizacion OAuth para que clientes externos puedan obtener tokens validos
para `/api/mcp/v1`.

---

## Estado actual de Astral

Ya existe:

- `/api/mcp/v1` detras de `FEATURE_REMOTE_MCP`;
- transporte Streamable HTTP stateless;
- `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`;
- auth beta con PAT hasheado en `mcp_tokens`;
- consentimiento en `mcp_consents`;
- audit en `mcp_audit_events`;
- `McpPrincipal` con `userId`, `clientId`, `scopes`, `audience`, `tokenId`;
- budgets por usuario+cliente+tool;
- `ask_astral_guide_v1` en `mcp_read_only`;
- deterministic HD tools:
  - `find_channel_by_gates_v1`
  - `find_channels_by_gate_v1`
  - `get_center_for_gate_v1`
- smoke verde con Claude Code HTTP + bearer;
- `npm run smoke:mcp` cubriendo auth, transport, scopes, tools y budget.

No existe todavia:

- OAuth discovery;
- Protected Resource Metadata;
- Authorization Server Metadata / OIDC discovery;
- `WWW-Authenticate` con `resource_metadata`;
- authorization code + PKCE para usuarios;
- Dynamic Client Registration o Client ID Metadata Documents;
- consent UX para conectores externos;
- token validation OAuth/JWT en `mcp/auth.ts`;
- smoke real de Claude Desktop / Claude Web / ChatGPT.

---

## Por que PAT no alcanza

El PAT beta sirve para:

```text
Claude Code
Codex CLI
curl / smoke tecnico
```

No sirve como producto para:

```text
Claude Desktop custom connector
Claude Web custom connector
ChatGPT connector/app
```

Motivo: los conectores remotos de usuario final esperan OAuth o no-auth. En la
documentacion de Claude, `static_bearer` pegado por el usuario no esta soportado
todavia para custom connectors remotos. Tokens/API keys en query string tampoco
son aceptables. El cliente debe descubrir donde autenticarse y completar un flow
OAuth.

PAT queda como carril interno/dev. OAuth es el carril de producto.

---

## OAuth explicado en el contexto Astral

OAuth en este proyecto significa:

```text
El usuario no le da su password de Astral a Claude/ChatGPT.
Astral le da a Claude/ChatGPT un permiso limitado para usar tools MCP.
```

Flujo mental:

```text
Usuario agrega Astral en Claude/ChatGPT
        |
        v
Claude/ChatGPT pregunta: "Astral, como me autentico?"
        |
        v
Astral responde metadata OAuth
        |
        v
Claude/ChatGPT manda al usuario a login/consent
        |
        v
Usuario se loguea en Astral y acepta scopes
        |
        v
OAuth layer emite access token
        |
        v
Claude/ChatGPT llama /api/mcp/v1 con Authorization: Bearer <token>
        |
        v
Astral valida token + scopes + consent + plan
        |
        v
tools/list / tools/call
```

OAuth no es "login con Google". Google Login puede usar OAuth/OIDC, pero OAuth
aca es el protocolo para dar permisos a apps externas. Astral puede seguir
usando SuperTokens para login web.

---

## Requisitos serios de MCP OAuth

Para Remote MCP HTTP con auth, la especificacion MCP moderna exige/espera:

- OAuth 2.1 style authorization;
- Authorization Code + PKCE para usuarios humanos;
- Protected Resource Metadata;
- Authorization Server Metadata u OIDC discovery;
- `WWW-Authenticate: Bearer resource_metadata="..."` en `401`;
- Bearer token en header, nunca en query string;
- `resource` / audience indicators;
- validacion estricta de token audience/resource;
- scopes minimos y progresivos;
- refresh/revocation si se soportan sesiones durables;
- exact redirect URI matching;
- proteccion contra SSRF si se usa client metadata discovery;
- no token passthrough a APIs downstream.

Claude ademas requiere PKCE S256 y redirect URI hosted:

```text
https://claude.ai/api/mcp/auth_callback
```

Claude Code es distinto: puede usar loopback redirects con puerto local
efimero si se valida OAuth en CLI.

---

## Arquitectura recomendada: WorkOS primero

### Decision

Usar **WorkOS Standalone Connect / AuthKit como Authorization Server OAuth para
MCP**, manteniendo:

- SuperTokens como login web de Astral;
- usuarios Astral en Turso;
- `/api/mcp/v1` como MCP resource server;
- Render actual como unico servicio;
- PAT beta para Claude Code/Codex/smoke interno.

### Diagrama

```text
Claude Desktop / ChatGPT
        |
        | agrega connector:
        | https://astral.soydanielamedina.com/api/mcp/v1
        v
Astral MCP resource server
        |
        | 401 WWW-Authenticate:
        | resource_metadata="https://astral.../.well-known/oauth-protected-resource"
        v
Claude/ChatGPT lee metadata
        |
        v
WorkOS OAuth / AuthKit
        |
        | redirige a Login URI de Astral
        v
Astral web
        |
        | SuperTokens session actual
        | resolveCurrentUser -> users.id
        | pantalla de consentimiento MCP
        v
WorkOS completa OAuth
        |
        | access token scoped para:
        | https://astral.soydanielamedina.com/api/mcp/v1
        v
Claude/ChatGPT
        |
        | Authorization: Bearer <access-token>
        v
/api/mcp/v1
        |
        +--> validate token
        +--> resolve McpPrincipal
        +--> check mcp_consents
        +--> tools/list
        +--> tools/call
```

### Por que WorkOS primero

- No reemplaza SuperTokens.
- No fuerza migracion de usuarios.
- Reduce superficie de seguridad propia.
- Esta alineado con OAuth/MCP actual.
- Permite mantener el mismo backend Render.
- Es un buen balance entre "no inventar auth" y "no migrar toda la identidad".

### Riesgos de WorkOS

- Vendor nuevo.
- Pricing real debe validarse antes de comprometerse.
- Hay que confirmar que Standalone Connect cubre el flow exacto para Claude y
  ChatGPT.
- Igual hay que implementar correctamente token verification, mapping de usuario,
  consent y scopes en Astral.

### Criterio de corte

Si WorkOS falla por costo, disponibilidad, compatibilidad con Claude/ChatGPT o
friccion excesiva:

```text
Cortar WorkOS.
Pasar a oidc-provider embebido.
No insistir.
```

---

## Fallback: oidc-provider propio

`oidc-provider` de panva es una alternativa seria para operar un Authorization
Server OAuth/OIDC en Node.

### Cuando usarlo

Usarlo si:

- WorkOS no cierra por costo;
- WorkOS no soporta bien el flow Claude/ChatGPT;
- necesitamos control total de issuer, DCR, tokens y consent;
- estamos dispuestos a operar OAuth como parte del producto.

### Que implicaria

```text
Astral backend Fastify
        |
        +-- /.well-known/oauth-protected-resource
        +-- /.well-known/oauth-authorization-server
        +-- /oauth/mcp/register
        +-- /oauth/mcp/authorize
        +-- /oauth/mcp/token
        +-- /oauth/mcp/revoke
        +-- /oauth/mcp/jwks
        +-- /api/mcp/v1
```

SuperTokens seguiria siendo login web. `oidc-provider` manejaria el protocolo
OAuth. El interaction flow reutilizaria la sesion web actual para saber quien
es el usuario y pedir consentimiento.

### Riesgos de oidc-provider

- Operamos keys, refresh tokens, DCR, revocation y consent.
- Mas superficie de seguridad propia.
- Mas responsabilidad ante drift de specs/clientes.
- Requiere adapter persistente sobre Turso/libsql.

Es viable, pero no seria la primera apuesta.

---

## Alternativas descartadas o secundarias

### SuperTokens MCP plugin

Descartado como camino principal por decision actual:

- feature paid;
- Node-only;
- beta;
- riesgo de costos o soporte insuficiente;
- demasiado acoplado a un plugin nuevo para una superficie critica.

SuperTokens sigue siendo login web.

### Auth0

Tecnologicamente fuerte, pero probablemente demasiado enterprise/overkill para
Astral ahora. Tiene costo/plataforma propia y empuja hacia una estrategia de
identity mas amplia.

### Stytch

Viable y serio para Connected Apps/OAuth, pero menos obvio que WorkOS si el
objetivo es preservar SuperTokens y sumar solo OAuth MCP.

### OAuth casero sin libreria/proveedor

No recomendado. El riesgo no esta en crear tokens; esta en discovery,
registration, PKCE, refresh rotation, revocation, audience validation,
redirect validation, SSRF, consent y compatibilidad entre clientes.

### Proxy local

Puede servir para smoke interno, pero no para producto. Claude Desktop/ChatGPT
custom connectors deben conectar a un endpoint remoto publico y autenticarse de
forma compatible.

---

## Endpoints objetivo

Manteniendo el mismo Render service:

```text
https://astral.soydanielamedina.com
  |
  +-- /api/chat
  +-- /api/me
  +-- /api/mcp/v1
  +-- /.well-known/oauth-protected-resource
  +-- /.well-known/oauth-protected-resource/api/mcp/v1
  +-- /.well-known/oauth-authorization-server
  +-- /api/mcp/v1/auth/*          si Astral proxyea/own OAuth endpoints
  +-- /oauth/mcp/*                si usamos issuer propio fallback
```

Con WorkOS, algunos endpoints de authorization viven en WorkOS. Astral igual
debe publicar resource metadata y responder `WWW-Authenticate` correctamente.

---

## Scopes iniciales

Mantener scopes minimos:

```text
mcp:read_hd
mcp:ask
```

No exponer todavia:

```text
mcp:read_profile_summary
mcp:read_personal_impact
mcp:read_transits
```

Tools asociadas:

```text
mcp:read_hd
  - find_channel_by_gates_v1
  - find_channels_by_gate_v1
  - get_center_for_gate_v1

mcp:ask
  - ask_astral_guide_v1
```

Regla: `tools/list` solo muestra tools permitidas por token + consent.

---

## Integracion con usuario Astral

La identidad web sigue asi:

```text
SuperTokens session
        |
        v
resolveCurrentUser
        |
        v
users.id
```

La identidad MCP deberia terminar siempre en:

```ts
McpPrincipal {
  userId: string;
  clientId: string;
  scopes: string[];
  audience: string;
  tokenId: string;
}
```

Con OAuth, `tokenId` podria ser `jti` o un mirror interno del token/grant.

Decisiones pendientes:

- si `sub` del token debe ser `users.id` o un subject externo que se mapea;
- si usuarios `onboarding_status=pending` pueden conectar MCP;
- si solo `plan=premium` puede usar `mcp:ask`;
- como representar revocacion en `mcp_consents` y/o proveedor externo;
- si el `audience` final debe ser la resource URI absoluta:
  `https://astral.soydanielamedina.com/api/mcp/v1`.

---

## Plan por slices

### Slice 8 - OAuth feasibility / WorkOS spike

Objetivo: validar antes de comprometer arquitectura.

Checks:

- crear cuenta/proyecto WorkOS;
- confirmar pricing real;
- confirmar Standalone Connect disponible;
- configurar resource/application para Astral MCP;
- definir resource indicator:
  `https://astral.soydanielamedina.com/api/mcp/v1`;
- probar metadata/discovery esperado;
- decidir DCR vs CIMD vs credenciales pre-registradas;
- documentar redirect URIs de Claude y ChatGPT;
- no tocar tools.

Exit criteria:

- queda claro si WorkOS puede ser el primary path;
- si no puede, se activa fallback `oidc-provider`.

### Slice 9 - Discovery compliance en Astral

Objetivo: que `/api/mcp/v1` sea discoverable por clientes MCP modernos.

Implementar:

- `401 WWW-Authenticate` con `resource_metadata`;
- Protected Resource Metadata;
- Authorization Server Metadata linkeada a WorkOS o issuer propio;
- tests para 401/discovery;
- smoke curl de metadata.

### Slice 10 - Token verification bridge

Objetivo: aceptar OAuth access tokens ademas de PAT beta.

Implementar:

- validacion JWT/OAuth token;
- audience/resource validation;
- scope extraction;
- mapping a `McpPrincipal`;
- coexistencia con PAT beta;
- audit con `tokenId/jti`.

### Slice 11 - Astral login + consent bridge

Objetivo: conectar OAuth flow con usuario real de Astral.

Implementar:

- Login URI hacia Astral;
- SuperTokens session check;
- resolve user;
- pantalla o endpoint de consentimiento;
- persistencia/actualizacion de `mcp_consents`;
- revoke/deny basico.

### Slice 12 - Claude Desktop / Claude Web smoke

Objetivo: validar cliente real.

Checks:

- agregar connector con URL publica;
- completar OAuth;
- `tools/list` con scopes correctos;
- call `get_center_for_gate_v1`;
- call `ask_astral_guide_v1`;
- audit y budgets correctos.

### Slice 13 - ChatGPT smoke

Objetivo: validar segundo cliente real.

Checks:

- configurar connector/app;
- completar OAuth;
- listar y llamar tools;
- documentar quirks propios de OpenAI.

### Slice 14 - Hardening

Objetivo: pasar de smoke a beta privada.

Cubrir:

- revocation;
- refresh/expiry;
- rate limits;
- DCR/CIMD abuse;
- observability;
- docs/runbook;
- regression suite;
- plan de rollback.

---

## Acceptance criteria de la direccion

La direccion queda validada cuando:

- Claude Desktop o Claude Web puede conectar Astral MCP sin PAT manual;
- ChatGPT puede conectar Astral MCP sin PAT manual;
- ambos usan OAuth/discovery;
- `mcp:read_hd` y `mcp:ask` filtran tools correctamente;
- `ask_astral_guide_v1` sigue `mcp_read_only`;
- no hay `chat_messages` ni `memory_writer` desde MCP;
- budgets/audit siguen activos;
- Claude Code/Codex pueden seguir usando PAT beta para desarrollo;
- rollback sigue siendo por feature flag/env.

---

## Riesgos principales

1. **OAuth scope creep**
   - Mitigacion: usar WorkOS primero; no construir OAuth casero salvo fallback.

2. **Vendor lock-in / costo**
   - Mitigacion: spike corto; criterio de corte; mantener modelo interno
     `McpPrincipal` independiente.

3. **Confundir auth web con auth MCP**
   - Mitigacion: SuperTokens autentica humanos en Astral; OAuth autoriza
     clientes externos; no mezclar cookies web con MCP tokens.

4. **Token misuse**
   - Mitigacion: validar audience/resource, scopes, expiry, revocation y consent
     en cada request.

5. **Cliente drift**
   - Mitigacion: smoke real versionado para Claude y ChatGPT; no confiar solo en
     tests unitarios.

6. **Privacidad / prompt injection**
   - Mitigacion: mantener tools read-only y minimizadas; no exponer profile raw,
     memory raw, intake completo ni birth data.

---

## Preguntas abiertas

Bloqueantes antes de implementar:

- Cual es el pricing real de WorkOS para este uso?
- WorkOS Standalone Connect soporta el flow exacto que Claude/ChatGPT esperan?
- Claude/ChatGPT en las cuentas actuales tienen acceso a custom connectors?
- Que redirect URIs exactas exige ChatGPT en este modo?
- Se quiere habilitar `mcp:ask` solo para premium?

No bloqueantes:

- si `mcp.astral.guide` existira en Fase 2;
- si se retirara PAT beta despues de OAuth;
- si se agregaran transit tools en otro ciclo;
- si se publica directory/listing o queda beta privada.

---

## Fuente de verdad propuesta

Este documento es el genesis del siguiente ciclo. Antes de codear, convertirlo
en un spec ejecutable con:

- decisiones bloqueantes cerradas;
- proveedor elegido;
- endpoints exactos;
- data model;
- test plan;
- smoke plan Claude/ChatGPT;
- rollback plan.
