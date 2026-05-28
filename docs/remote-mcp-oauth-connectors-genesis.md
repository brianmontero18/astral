# Remote MCP OAuth connectors - genesis

**Estado**: material de apoyo para deliberar el siguiente ciclo de Remote MCP. No es spec ejecutable cerrada.
**Fecha**: 2026-05-18.
**Branch base**: `feature/astral-mcp-architecture`.
**Dominio objetivo**: `https://astral.soydanielamedina.com`.
**Endpoint MCP objetivo**: `https://astral.soydanielamedina.com/api/mcp/v1`.
**Docs relacionados**:

- [`remote-mcp-architecture-proposal.md`](remote-mcp-architecture-proposal.md)
- [`remote-mcp-implementation-recon-plan.md`](remote-mcp-implementation-recon-plan.md)
- [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md)
- [`remote-mcp-production-learnings.md`](remote-mcp-production-learnings.md)

**Nota 2026-05-19**: este doc es el genesis historico de la decision OAuth.
La verdad operativa posterior al smoke real con Claude Web y ChatGPT vive en
[`remote-mcp-production-learnings.md`](remote-mcp-production-learnings.md).

**Fuentes oficiales revisadas para este corte**:

- WorkOS Standalone Connect:
  <https://workos.com/docs/authkit/connect/standalone>
- WorkOS Standalone Connect API reference:
  <https://workos.com/docs/reference/workos-connect/standalone>
- Claude connector authentication:
  <https://claude.com/docs/connectors/building/authentication>
- Claude Code MCP:
  <https://docs.claude.com/en/docs/claude-code/mcp>
- OpenAI Apps SDK auth:
  <https://developers.openai.com/apps-sdk/build/auth>
- OpenAI Apps SDK connect from ChatGPT:
  <https://developers.openai.com/apps-sdk/deploy/connect-chatgpt>
- OpenAI Apps SDK troubleshooting:
  <https://developers.openai.com/apps-sdk/deploy/troubleshooting>
- MCP authorization spec 2025-06-18:
  <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>

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

Actualizacion de factibilidad WorkOS:

```text
WorkOS pasa los 4 checks preliminares:
  1. pricing viable para beta/proyecto personal;
  2. Standalone Connect existe para apps con auth propia;
  3. permite Login URI HTTPS hacia Astral;
  4. soporta MCP auth con CIMD/DCR/resource indicators.

Queda por validar con cuenta/dashboard real:
  - billing info en production.

Validado el 2026-05-19:
  - WorkOS dashboard real;
  - DCR/CIMD/resource indicator/Login URI;
  - smoke real Claude Web;
  - smoke real ChatGPT.
```

Actualizacion Slice 9:

```text
Astral ya publica discovery OAuth/MCP minimo cuando FEATURE_REMOTE_MCP=true:
  - GET /.well-known/oauth-protected-resource
  - GET /.well-known/oauth-protected-resource/api/mcp/v1
  - 401 WWW-Authenticate con resource_metadata

En Slice 9 esto solo hacia discoverable el resource server. La validacion
JWT/OAuth se agrego despues en Slice 10; el login/consent bridge de usuario real
se agrego despues en Slice 11.
```

Actualizacion WorkOS dashboard + metadata real:

```text
Proyecto WorkOS: aurea-core
Environment: Staging
AuthKit issuer:
  https://thoughtful-trinket-33-staging.authkit.app

Authorization Server Metadata confirmado:
  /.well-known/oauth-authorization-server
  issuer=https://thoughtful-trinket-33-staging.authkit.app
  jwks_uri=https://thoughtful-trinket-33-staging.authkit.app/oauth2/jwks
  authorization_endpoint=/oauth2/authorize
  token_endpoint=/oauth2/token
  registration_endpoint=/oauth2/register
  client_id_metadata_document_supported=true
  grant_types_supported=authorization_code, refresh_token
  code_challenge_methods_supported=S256

Connect / MCP Auth:
  Dynamic Client Registration: enabled
  Client ID Metadata Document: enabled
  Resource Indicator:
    https://astral.soydanielamedina.com/api/mcp/v1
  External Sign-in URI:
    https://astral.soydanielamedina.com/auth/workos/connect

Connect dynamic app:
  Claude/ChatGPT pueden crear la app via DCR/CIMD.
  No configurar ni depender de mcp:ask / mcp:read_hd / mcp:write_bodygraph como OAuth scopes.
```

Nota importante aprendida en el smoke Claude Web: AuthKit anuncia scopes OAuth
estandar (`openid`, `profile`, `email`, `offline_access`). Astral no debe
anunciar `mcp:ask` / `mcp:read_hd` / `mcp:write_bodygraph` como OAuth scopes publicos para WorkOS,
porque clientes como Claude pueden pedirlos durante OAuth y WorkOS puede
rechazar el flujo con `invalid_scope` o fallar el token exchange. En V1, OAuth
solo autentica identidad; Astral deriva permisos MCP internamente desde plan y
onboarding:

```text
free    -> sin MCP
basic   -> mcp:read_hd + mcp:write_bodygraph
premium -> mcp:read_hd + mcp:write_bodygraph + mcp:ask
```

---

## Estado actual de Astral

Ya existe:

- `/api/mcp/v1` detras de `FEATURE_REMOTE_MCP`;
- transporte Streamable HTTP stateless;
- `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`;
- auth beta con PAT hasheado en `mcp_tokens`;
- validacion OAuth/JWT WorkOS por issuer/JWKS/audience/resource;
- Login URI gate/bridge en `/auth/workos/connect` para sesion, plan y
  onboarding;
- creacion real de `user_identities(provider='workos')` durante el flow OAuth;
- creacion/actualizacion lazy de `mcp_clients` y `mcp_consents` al validar el
  primer access token WorkOS real;
- consentimiento en `mcp_consents`;
- audit en `mcp_audit_events`;
- `McpPrincipal` con `userId`, `clientId`, `scopes`, `audience`, `tokenId`;
- cuota mensual compartida para `mcp:ask` y budgets tecnicos para tools MCP;
- `ask_astral_guide_v1` en `mcp_read_only`;
- deterministic HD tools:
  - `find_channel_by_gates_v1`
  - `find_channels_by_gate_v1`
  - `get_center_for_gate_v1`
- MCP Apps bodygraph V1 tools:
  - `open_bodygraph_form_v1`
  - `search_birth_places_v1`
  - `create_my_bodygraph_from_birth_v1`
  - `get_active_bodygraph_image_v1`
  - `get_active_bodygraph_pdf_v1`
- MCP Apps bodygraph V1 UI bridge:
  - usa `_meta.ui.resourceUri` como contrato MCP Apps portable;
  - el widget intenta `@modelcontextprotocol/ext-apps` (`App.connect` +
    `callServerTool`) para Claude/MCP Apps hosts;
  - mantiene `window.openai.callTool` como fallback ChatGPT/OpenAI Apps;
  - dentro del iframe, fallback JSON-RPC `tools/call` por `postMessage`;
  - fuera del iframe, el texto de `open_bodygraph_form_v1` explica como llamar
    la tool manualmente si el host no renderiza UI.
  - estado actual: implementado y cubierto por tests/smoke backend; pendiente
    UAT real de la UI bodygraph embebida en Claude y ChatGPT antes de declararla
    producto final.
- smoke verde con Claude Code HTTP + bearer;
- `npm run smoke:mcp` cubriendo auth, transport, scopes, tools, cuota y
  discovery OAuth/MCP.

No existe en Astral porque se delega a WorkOS:

- Authorization Server Metadata / OIDC discovery propia de Astral;
- authorization code + PKCE para usuarios;
- Dynamic Client Registration o Client ID Metadata Documents propios de
  Astral; hoy se delegan a WorkOS.

Validado despues de este genesis:

- smoke real de Claude Web;
- smoke real de ChatGPT.

Nota: esos smokes validaron el conector Remote MCP/OAuth y tools existentes. El
form MCP Apps de bodygraph V1 es posterior y requiere UAT propio en hosts reales.

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

### Diagrama PM del flujo completo

Este es el flujo que deberia ocurrir para un usuario final cuando instala Astral
MCP en Claude, Claude Code, ChatGPT u otro cliente compatible:

```text
Usuario en Claude/ChatGPT/Claude Code
        |
        | configura:
        | https://astral.soydanielamedina.com/api/mcp/v1
        v
Cliente intenta listar/usar tools MCP
        |
        v
Astral MCP responde:
  "necesito OAuth para este recurso"
  401 + WWW-Authenticate + resource_metadata
        |
        v
Cliente lee metadata de Astral
        |
        v
Cliente abre WorkOS/AuthKit OAuth
        |
        v
  WorkOS manda al usuario a:
  https://astral.soydanielamedina.com/auth/workos/connect
  ?external_auth_id=...
        |
        v
Astral resuelve usuario con SuperTokens
        |
        +-- no hay sesion ---------> login/signup Astral
        |
        +-- cuenta inactiva -------> bloqueo
        |
        +-- onboarding pendiente --> completar onboarding
        |
        +-- plan no habilitado ----> upgrade / no emitir token util
        |
        +-- scopes no permitidos --> upgrade / no emitir token util
        |
        v
Astral llama completion API de WorkOS
        |
        v
WorkOS muestra consentimiento OAuth si corresponde
        |
        v
Cliente recibe access token
        |
        v
Cliente llama /api/mcp/v1 con Bearer token
        |
        v
Astral valida:
  firma + issuer + audience + expiry + scopes
  usuario Astral + estado + plan + onboarding
  cliente + consentimiento/grant interno
        |
        v
tools/list y tools/call solo con lo permitido
```

Traduccion brutalmente simple:

```text
OAuth dice: "este cliente externo tiene un token valido".
SuperTokens dice: "este humano es este usuario de Astral".
Astral decide: "este usuario, con este plan, puede o no puede usar este scope".
WorkOS ayuda a emitir tokens y mostrar consentimiento OAuth.
Claude/ChatGPT deciden como mostrar el boton Connect, errores y reintentos.
```

### Que pasa si el usuario instala el MCP

Instalar/configurar el MCP en el cliente no significa que ya pueda usarlo.
Significa que el cliente sabe donde esta el servidor. El primer uso real dispara
autenticacion/autorizacion.

```text
Instalo connector
        |
        v
Cliente prueba conexion / lista tools
        |
        +-- sin token:
        |     Astral responde 401 con metadata OAuth
        |     Cliente muestra "Connect" o abre browser OAuth
        |
        +-- token valido y usuario habilitado:
        |     Astral lista/ejecuta tools permitidas
        |
        +-- token valido pero plan/scope no habilitado:
        |     Astral responde 403 controlado
        |     Cliente muestra error; Astral debe tener pagina/copy de upgrade
        |
        +-- token vencido/invalidado:
              Astral responde 401
              Cliente deberia reautenticar
```

Claude Code con PAT beta hoy puede seguir funcionando de forma manual para
desarrollo. Claude Desktop/Web y ChatGPT como producto final necesitan OAuth; no
deberiamos pedirle a un usuario final que copie tokens.

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
        | gate de estado/plan/onboarding/scopes
        v
WorkOS completa OAuth
        |
        | consentimiento OAuth si corresponde
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

### Factibilidad WorkOS investigada

WorkOS encaja para un proyecto personal/beta sin necesidades enterprise.

Confirmado desde la investigacion:

- **Pricing beta**: AuthKit tiene un tramo gratis hasta 1M monthly active users.
  OAuth connections no aparecen como costo separado en el material revisado. En
  produccion puede pedir billing info, pero el uso MCP/OAuth sin enterprise
  add-ons se espera de costo bajo o cero al inicio.
- **Standalone Connect**: existe justamente para apps que ya tienen auth propia
  y quieren usar AuthKit/WorkOS como authorization server OAuth sin migrar login.
- **Login URI hacia Astral**: se puede configurar una Login URI HTTPS por
  environment. WorkOS redirige con `external_auth_id`; Astral autentica con
  SuperTokens y llama la completion API server-side.
- **Consent**: WorkOS/AuthKit maneja el consentimiento OAuth. Astral igual debe
  autorizar server-side tools, plan, scopes y `mcp_consents`.
- **CIMD/DCR**: WorkOS documenta soporte MCP con Client ID Metadata Documents,
  Dynamic Client Registration, Resource Indicators, PKCE y metadata OAuth. CIMD
  esta off por default y debe habilitarse en Dashboard; DCR es opcional para
  compatibilidad con clientes mas viejos.
- **Token validation**: Astral valida JWT via JWKS/issuer/audience y mapea el
  token a `McpPrincipal` desde Slice 10.

Configuracion esperada para Astral:

```text
Login URI:
  https://astral.soydanielamedina.com/auth/workos/connect

MCP resource indicator:
  https://astral.soydanielamedina.com/api/mcp/v1

Claude redirect URI:
  https://claude.ai/api/mcp/auth_callback

ChatGPT redirect URI:
  https://chatgpt.com/connector/oauth/{callback_id}
  En el smoke real no hizo falta configurar un callback_id manual en Astral;
  el flujo quedo mediado por WorkOS/DCR/CIMD.
```

Decision de scope:

```text
No necesitamos enterprise ahora.
No usar SSO enterprise.
No usar SCIM / Directory Sync.
No pagar custom domain WorkOS al inicio.
No comprar soporte premium.
No activar Audit Logs/Radar pagos salvo necesidad futura.
```

### Riesgos de WorkOS

- Vendor nuevo.
- Pricing de beta parece viable, pero hay que validar billing/product gating en
  una cuenta real antes de implementar.
- Una sola Login URI por environment puede condicionar staging/prod.
- Hay que elegir un identificador estable para WorkOS (`users.id`) desde el dia
  uno para evitar conflictos de email/external user.
- Hay que confirmar en Dashboard que CIMD/DCR esten habilitables en el plan real.
- ChatGPT quedo validado en smoke real via WorkOS/DCR/CIMD.
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
identity mas amplia. Queda como referencia futura, no como alternativa activa
para el ciclo personal/beta.

### Stytch

Viable y serio para Connected Apps/OAuth, pero menos obvio que WorkOS si el
objetivo es preservar SuperTokens y sumar solo OAuth MCP. Queda como referencia
futura, no como alternativa activa para el ciclo personal/beta.

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

## Permisos MCP internos iniciales

Mantener permisos MCP internos minimos:

```text
mcp:read_hd
mcp:write_bodygraph
mcp:ask
```

Nota posterior al smoke real: no anunciar estos valores como OAuth scopes
publicos de WorkOS. La metadata publica debe anunciar scopes OAuth estandar
(`openid`, `profile`, `email`, `offline_access`). Astral deriva estos permisos
internos desde plan, onboarding, estado y consentimiento espejo.

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
  - get_active_bodygraph_image_v1
  - get_active_bodygraph_pdf_v1

mcp:write_bodygraph
  - open_bodygraph_form_v1
  - search_birth_places_v1
  - create_my_bodygraph_from_birth_v1

mcp:ask
  - ask_astral_guide_v1
```

Regla: `tools/list` solo muestra tools permitidas por token valido + policy
interna + consent/grant espejo + plan vigente.

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

La identidad MCP termina siempre en:

```ts
McpPrincipal {
  userId: string;
  clientId: string;
  scopes: string[];
  audience: string;
  tokenId: string | null;
}
```

Con PAT beta, `tokenId` es el id de `mcp_tokens`. Con OAuth WorkOS, `tokenId`
queda `null` porque `mcp_audit_events.token_id` referencia `mcp_tokens`; el
audit igual queda agrupable por `userId + clientId + toolName`.

Decisiones resueltas en Slice 10:

- `external_id`/`externalId` firmado del token WorkOS se prefiere como subject
  de Astral cuando existe; si no viene, se usa `sub`. Ese valor se mapea via
  `user_identities(provider='workos', provider_user_id=<subject>)`;
- el `audience/resource` validado es la resource URI absoluta:
  `https://astral.soydanielamedina.com/api/mcp/v1`;
- los scopes OAuth se leen desde `scope`, `scp`, `scopes` o `permissions`, pero
  los permisos MCP de producto se derivan internamente desde Astral;
- `client_id`, `azp` o `cid` se usan si vienen en el token. Si WorkOS emite un
  token validado sin client id, Astral usa el fallback interno estable
  `workos-authkit`.

Decisiones pendientes para Slice 11+:

- como persistir el espejo interno de consentimiento/grant cuando WorkOS maneja
  el consentimiento OAuth real;
- como representar revocacion en `mcp_consents` y/o proveedor externo;
- como actualizar scopes en `mcp_consents` dado que hoy hay un unico grant
  activo por `user_id + client_id`;
- si se necesita persistir `jti`/grant OAuth en una tabla propia.

## Contrato producto decidido para V1

Esta seccion baja el criterio PM decidido antes de codear Slice 11. No es una
limitacion tecnica de OAuth; es la politica de producto que Astral debe aplicar.

### Decision de planes

```text
free:
  - no Remote MCP de producto
  - puede ver upgrade/login/onboarding, pero no recibe acceso util a tools

basic:
  - permite mcp:read_hd
  - permite mcp:write_bodygraph
  - no permite mcp:ask en V1

premium:
  - permite mcp:read_hd
  - permite mcp:write_bodygraph
  - permite mcp:ask
```

Razonamiento:

- `mcp:read_hd` exporta parte del activo central de Astral; no conviene abrirlo
  gratis por defecto.
- `mcp:ask` consume LLM y puede transformarse en un canal paralelo de uso. No
  debe ser ilimitado ni quedar separado del producto principal. En V1,
  `mcp:ask` debe consumir la misma cuota mensual del chat web del usuario.
- `mcp:ask` no debe implicar `mcp:read_hd`. Un cliente puede hacer preguntas a
  Astral sin recibir datos HD crudos/exportables.
- `mcp:read_hd` no debe implicar `mcp:ask`. Leer datos deterministas y pedir
  guia LLM son permisos distintos.
- `mcp:write_bodygraph` no debe implicar `mcp:ask`; reemplazar carta activa es
  un workflow deterministico auditado, no un canal LLM.

### Decision de cuota para `mcp:ask`

```text
mcp:ask consume la misma cuota mensual que el chat web:
  free: no aplica porque free no tiene Remote MCP;
  basic: no aplica en V1 porque basic no tiene mcp:ask;
  premium: consume del limite mensual premium vigente.
```

Implicacion: `mcp:ask` no debe ser un bypass de `/api/chat`. Para `mcp:ask`, la
regla producto visible y operativa es la cuota mensual normal del plan. Los
budgets MCP defensivos quedan por tool cuando aplique.

### Gating obligatorio

Antes de completar el flow OAuth con WorkOS, Astral debe validar:

```text
1. hay sesion web Astral o se puede iniciar login/signup;
2. el usuario existe en users;
3. users.status = active;
4. users.onboarding_status = complete;
5. users.plan habilita Remote MCP;
6. WORKOS_API_KEY esta configurado para completar el flow.
```

WorkOS Standalone Connect redirige a la Login URI con `external_auth_id`. En la
documentacion revisada, esa redireccion no trae `client_id` ni scopes. Por eso
Astral no debe inventarlos en `/auth/workos/connect`: el bridge completa la
autenticacion de usuario; el resource server crea/actualiza el espejo interno
de `mcp_clients/mcp_consents` cuando recibe el access token real. Si el token
no trae `client_id`, usa `workos-authkit` como client id interno despues de
validar firma, issuer, audience, subject y scopes OAuth.

Despues de recibir un token en `/api/mcp/v1`, Astral debe volver a validar:

```text
1. firma JWT/JWKS;
2. issuer WorkOS esperado;
3. audience/resource = MCP_RESOURCE_URL;
4. expiry;
5. scopes;
6. user_identities(provider='workos') -> users.id;
7. users.status;
8. users.onboarding_status;
9. users.plan;
10. mcp_clients.status;
11. consentimiento/grant interno vigente o espejo OAuth derivable del token
    WorkOS valido;
12. para `mcp:ask`, cuota mensual del chat web.
```

No alcanza con que WorkOS emita un token. El resource server sigue siendo Astral.

### Escenarios PM

| Escenario | Experiencia esperada | Comportamiento server | Slice 11 |
|---|---|---|---|
| Usuario premium activo y onboarded conecta | Conecta, consiente y ve HD deterministico, bodygraph write y ask mientras tenga cuota mensual. | Link WorkOS->Astral; OAuth usa scopes estandar; Astral deriva `mcp:read_hd + mcp:write_bodygraph + mcp:ask` por plan. | Implementar |
| Usuario basic activo y onboarded conecta | Conecta y ve HD deterministico + bodygraph write, sin ask. | Astral deriva `mcp:read_hd + mcp:write_bodygraph`; bloquea `mcp:ask` con upgrade required. | Implementar |
| Usuario basic pide `mcp:ask` | Ve upgrade/premium required. | No completar grant util para `mcp:ask`; tool call devuelve 403. | Implementar como rechazo |
| Usuario free intenta conectar | Ve upgrade/paywall MCP. | No crear grant util; bloquear tools. | Implementar como rechazo |
| Visitante no registrado | Ve login/signup Astral. | Sin usuario no hay completion util; despues de signup cae en free/onboarding. | Implementar |
| Usuario logueado pero onboarding pendiente | Ve completar onboarding. | No emitir acceso util hasta `onboarding_status=complete`. | Implementar |
| Usuario disabled/banned | Ve bloqueo de cuenta. | 403 `account_inactive`; no grant ni tools. | Implementar |
| Token vencido/invalido | Cliente deberia pedir reconectar. | 401 + `WWW-Authenticate` con metadata. | Ya base, reforzar tests |
| Scope insuficiente | Cliente muestra error o step-up si lo soporta. | 403 `insufficient_scope`; no ejecutar tool. | Ya base, reforzar tests |
| Consent/grant revocado | Cliente debe reconectar si reintenta. | 401/403 controlado; no ejecutar tool. | Minimo ahora, UI completa defer |
| Cliente desconocido por DCR/CIMD | Puede registrarse o identificarse via WorkOS. | Crear/actualizar `mcp_clients` solo si pasa politica beta. | Implementar minimo |
| ChatGPT no habilitado por plan/admin del usuario | Usuario no puede conectar desde ChatGPT. | Fuera de Astral; no llega o llega incompleto. | Documentar smoke |

### Errores/copy que debe poder soportar Astral

Estos codigos son para control interno/API. El texto exacto visible en
Claude/ChatGPT puede estar controlado por el cliente, no por Astral.

```text
authentication_required:
  "Inicia sesion o crea tu cuenta de Astral para conectar este MCP."

onboarding_required:
  "Completa tu carta y onboarding antes de conectar Astral a herramientas externas."

plan_upgrade_required:
  "Remote MCP esta disponible para planes pagos."

account_inactive:
  "Tu cuenta no esta activa. Contacta soporte."

consent_required:
  "Vuelve a conectar Astral desde tu cliente MCP."

insufficient_scope:
  "Este cliente no tiene permiso para usar esta herramienta."

message_limit_reached:
  "Alcanzaste la cuota mensual de chat de tu plan."
```

### Responsabilidades por capa

```text
Claude / ChatGPT / Claude Code
  - UI de agregar connector
  - boton Connect
  - popup/browser OAuth
  - reintentos o errores visibles
  - confirmaciones propias del host

WorkOS/AuthKit
  - authorization endpoint
  - token endpoint
  - DCR/CIMD
  - consentimiento OAuth
  - access/refresh tokens
  - JWKS

Astral web/backend
  - login/signup real con SuperTokens
  - Login URI /auth/workos/connect
  - mapping WorkOS subject -> users.id
  - plan/status/onboarding gates
  - mcp_clients/mcp_consents como espejo interno
  - token validation en /api/mcp/v1
  - tools/list/tools/call filtrados por scope/plan
  - cuota mensual chat para mcp:ask, audit y rollback
```

### Decision de consentimiento interno

WorkOS documenta que AuthKit maneja el consentimiento OAuth y que Astral no
necesita mostrar una segunda pantalla de consentimiento. Por lo tanto, el
`mcp_consents` interno de Astral debe tratarse como espejo/grant operativo para
enforcement y auditoria, no como reemplazo del consentimiento OAuth.

Implicacion tecnica para Slice 11:

```text
/auth/workos/connect
  - autentica usuario Astral;
  - si no hay sesion, redirige a /auth con redirectToPath al flow WorkOS;
  - valida status/onboarding/plan;
  - llama WorkOS completion API;
  - crea/actualiza user_identities(provider='workos');
  - redirige al redirect_uri de WorkOS.

/api/mcp/v1
  - no confia solo en mcp_consents;
  - valida token y scopes en cada request;
  - revalida usuario/plan/status/onboarding;
  - crea/actualiza mcp_clients desde el client_id del JWT WorkOS o fallback
    interno `workos-authkit`;
  - crea/actualiza mcp_consents como espejo interno desde scopes permitidos
    por token + plan;
  - hace que mcp:ask consuma cuota mensual de chat web;
  - filtra tools y bloquea tool calls fuera de contrato.
```

Si el usuario cancela consentimiento en WorkOS, no deberia existir token util.
Puede quedar un grant interno espejado; eso no da acceso por si solo porque
`/api/mcp/v1` siempre exige token valido. En un hardening posterior conviene
sincronizar revocacion/cancelaciones si WorkOS expone eventos o APIs utiles.

### Que queda fuera de V1

No implementar todavia:

- OAuth propio con `oidc-provider`;
- enterprise SSO/SCIM;
- custom domain WorkOS;
- UI completa de revocacion/conectores conectados;
- scopes personales futuros;
- `get_current_transit_context_v1`;
- `get_my_profile_summary_v1`;
- `analyze_my_transit_impact_v1`;
- MCP para usuarios free;
- cuota MCP separada como contrato de producto para `mcp:ask`.

---

## Plan por slices

### Slice 8 - OAuth feasibility / WorkOS spike

Objetivo: validar antes de comprometer arquitectura.

Checks:

- crear cuenta/proyecto WorkOS;
- confirmar en dashboard real que el uso AuthKit/Connect/MCP no agrega costo
  para beta/proyecto personal;
- confirmar si production requiere billing info;
- configurar resource/application para Astral MCP;
- configurar Login URI:
  `https://astral.soydanielamedina.com/auth/workos/connect`;
- definir resource indicator:
  `https://astral.soydanielamedina.com/api/mcp/v1`;
- probar metadata/discovery esperado;
- habilitar/verificar CIMD;
- habilitar/verificar DCR si hace falta para compatibilidad;
- documentar redirect URIs de Claude y ChatGPT;
- confirmar que no estamos activando enterprise SSO, SCIM, custom domain, soporte
  pago, Audit Logs pagos ni Radar pago;
- no tocar tools.

Exit criteria:

- queda claro si WorkOS puede ser el primary path;
- no hay costos enterprise ni add-ons pagos necesarios para beta;
- Login URI hacia Astral funciona conceptualmente con `external_auth_id`;
- CIMD/DCR quedan confirmados o descartados con evidencia de dashboard;
- si no puede, se activa fallback `oidc-provider`.

### Slice 9 - Discovery compliance en Astral

Objetivo: que `/api/mcp/v1` sea discoverable por clientes MCP modernos.

Implementar:

- `401 WWW-Authenticate` con `resource_metadata`; **implementado**.
- Protected Resource Metadata; **implementado**.
- Authorization Server Metadata linkeada a WorkOS o issuer propio; **linkeada
  via `MCP_AUTHORIZATION_SERVER_ISSUER`**.
- tests para 401/discovery; **implementado**.
- smoke curl de metadata; **implementado**.

Config nueva:

```text
FEATURE_REMOTE_MCP=false
MCP_RESOURCE_URL=https://astral.soydanielamedina.com/api/mcp/v1
MCP_AUTHORIZATION_SERVER_ISSUER=https://thoughtful-trinket-33-staging.authkit.app
WORKOS_API_KEY=<secret in Render/dashboard only>
```

Notas:

- `MCP_RESOURCE_URL` debe coincidir con el Resource Indicator configurado en
  WorkOS.
- `MCP_AUTHORIZATION_SERVER_ISSUER` no es secreto.
- `WORKOS_API_KEY` es secreto; no commitear valores reales.
- si `FEATURE_REMOTE_MCP=false`, discovery y `/api/mcp/v1` siguen sin
  registrarse.
- si falta `MCP_AUTHORIZATION_SERVER_ISSUER`, la metadata responde 503 para no
  anunciar un OAuth flow incompleto.

### Slice 10 - Token verification bridge

Objetivo: aceptar OAuth access tokens ademas de PAT beta.

Implementar:

- validacion JWT/OAuth token; **implementado con `jose`**.
- issuer/JWKS WorkOS; **implementado via `MCP_AUTHORIZATION_SERVER_ISSUER`**.
- audience/resource validation; **implementado contra `MCP_RESOURCE_URL`**.
- OAuth scope extraction; **implementado desde `scope`, `scp`, `scopes` y
  `permissions`, pero solo como validacion del token OAuth estandar; los
  permisos MCP no dependen de scopes WorkOS**.
- mapping a `McpPrincipal`; **implementado usando `external_id`/`externalId`
  firmado cuando existe, con fallback a `sub`, via
  `user_identities(provider='workos', provider_user_id=<subject>)`**.
- coexistencia con PAT beta; **PAT se intenta primero y sigue usando
  `mcp_tokens`**.
- audit con `tokenId/jti`; **parcial**: OAuth no inserta `token_id` porque
  `mcp_audit_events.token_id` referencia `mcp_tokens`. Para OAuth queda
  `tokenId=null` y audit sigue agrupando por user+client+tool. Si se necesita
  jti persistido, agregar columna/tabla OAuth en otro slice.

Decision de mapping:

```text
WorkOS access token
  external_id|externalId=<astral users.id> si WorkOS lo emite;
  si no, sub=<workos subject>
  client_id|azp|cid=<OAuth client id, si el proveedor lo emite>
  fallback client id interno=workos-authkit
  scope/scp/scopes/permissions incluye scopes OAuth estandar
        |
        v
user_identities
  provider='workos'
  provider_user_id=<subject>
        |
        v
users.id
        |
        v
mcp_consents(user_id, client_id)
  scopes derivados del plan Astral, no de scopes WorkOS
        |
        v
McpPrincipal
```

Implicacion: Slice 10 deja la verificacion lista, pero un token real no va a
autorizar hasta que Slice 11 cree el link `workos -> users.id` y el
`mcp_consents` correspondiente.

### Slice 11 - Astral login + consent bridge

Objetivo: conectar OAuth flow con usuario real de Astral.

Implementar:

- Login URI hacia Astral (`/auth/workos/connect`);
- SuperTokens session check y login/signup redirect si no hay sesion;
- resolve user + auto-link existente;
- gates de `status`, `onboarding_status` y `plan`;
- enforcement de producto: `free=no MCP`,
  `basic=mcp:read_hd+mcp:write_bodygraph`,
  `premium=mcp:read_hd+mcp:write_bodygraph+mcp:ask`;
- `mcp:ask` consume la cuota mensual del chat web;
- WorkOS completion API usando `external_auth_id`;
- creacion/actualizacion de `user_identities(provider='workos')` con el
  `users.id` enviado a WorkOS como id externo;
- creacion/actualizacion lazy de `mcp_clients` y `mcp_consents` al validar el
  primer access token WorkOS real;
- tests para premium/basic/free/pending/inactive/missing consent;
- no duplicar consentimiento OAuth si WorkOS ya lo maneja.

### Slice 12 - Claude Desktop / Claude Web smoke

Objetivo: validar cliente real.

Checks:

- agregar connector con URL publica;
- completar OAuth;
- `tools/list` con scopes correctos;
- call `get_center_for_gate_v1`;
- call `ask_astral_guide_v1`;
- audit y cuota compartida correctos.

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
- la UI MCP Apps de bodygraph V1 renderiza y ejecuta search/create en Claude y
  ChatGPT reales;
- ambos usan OAuth/discovery;
- `mcp:read_hd`, `mcp:write_bodygraph` y `mcp:ask` filtran tools correctamente;
- `ask_astral_guide_v1` sigue `mcp_read_only`;
- `mcp:ask` no persiste `chat_messages` ni dispara `memory_writer`;
- `mcp:write_bodygraph` solo limpia contexto dependiente durante replace
  confirmado;
- cuota compartida/audit siguen activos para `mcp:ask`;
- budgets tecnicos por tool siguen activos donde correspondan;
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
   - Mitigacion: minimizar write tools; exigir scope dedicado, confirmacion y
     auditoria para efectos laterales; no exponer profile raw, memory raw,
     intake completo ni birth data innecesaria.

---

## Preguntas abiertas

Bloqueantes antes de implementar:

- WorkOS requiere billing info para habilitar production aunque el costo sea
  cero bajo 1M MAU?
- Claude/ChatGPT en las cuentas actuales tienen acceso a custom connectors?
- Cual es el `callback_id` real de ChatGPT cuando se cree la app/connector?

No bloqueantes:

- si `mcp.astral.guide` existira en Fase 2;
- si se retirara PAT beta despues de OAuth;
- si se agregaran transit tools en otro ciclo;
- si se publica directory/listing o queda beta privada;
- si algun dia se agregan enterprise SSO/SCIM, fuera del alcance actual.

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
