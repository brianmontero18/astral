# Remote MCP production learnings

**Estado**: verdad operativa despues del smoke real Claude Web + ChatGPT.
**Fecha**: 2026-05-19.
**Servidor MCP**: `https://astral.soydanielamedina.com/api/mcp/v1`.
**Proveedor OAuth**: WorkOS AuthKit Standalone Connect.
**Audiencia**: PMs tecnicos, architects y AI agents que tengan que replicar este
patron en otra app.

Nota de alcance: este doc captura el smoke real del conector Remote MCP/OAuth.
La UI embebida MCP Apps para calcular bodygraph se agrego despues y necesita su
propio UAT real en Claude/ChatGPT antes de considerarse validada como producto.

Docs relacionados:

- [`remote-mcp-oauth-connectors-genesis.md`](remote-mcp-oauth-connectors-genesis.md)
- [`remote-mcp-architecture-proposal.md`](remote-mcp-architecture-proposal.md)
- [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md)

Referencias oficiales utiles:

- WorkOS Standalone Connect: <https://workos.com/docs/authkit/connect/standalone>
- WorkOS Standalone Connect API: <https://workos.com/docs/reference/workos-connect/standalone>
- MCP authorization spec: <https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization>
- Claude connector authentication: <https://claude.com/docs/connectors/building/authentication>
- OpenAI Apps SDK auth: <https://developers.openai.com/apps-sdk/build/auth>
- OpenAI Apps SDK connect from ChatGPT: <https://developers.openai.com/apps-sdk/deploy/connect-chatgpt>
- OpenAI Apps SDK troubleshooting: <https://developers.openai.com/apps-sdk/deploy/troubleshooting>

Este doc no reemplaza las specs oficiales. Captura la diferencia entre "lo que
la documentacion dice que deberia funcionar" y "lo que tuvimos que ajustar para
que funcione en produccion con clientes reales".

---

## Resumen PM

Lo que logramos:

```text
Claude Web  -> Astral Remote MCP -> OK
ChatGPT     -> Astral Remote MCP -> OK
WorkOS OAuth bridge              -> OK
SuperTokens web login            -> sigue siendo login web de Astral
PAT/bearer beta                  -> sigue existiendo para dev/smoke
```

La arquitectura que funciono no fue "migrar Astral a OAuth". Fue separar tres
responsabilidades:

```text
SuperTokens = login web de Astral
WorkOS      = authorization server OAuth para clientes externos
Astral      = resource server MCP + permisos de producto
```

La decision clave: OAuth autentica identidad y emite tokens; Astral decide que
tools existen para cada usuario segun plan, onboarding y estado interno.

## Abstracciones canonicas

Para replicar este patron en otra app, pensar en estas piezas, no en archivos:

```text
MCP client
  Claude, ChatGPT, Claude Code, Codex u otro cliente compatible.

Resource server
  Tu backend MCP. Expone tools y verifica access tokens.

Authorization server
  El proveedor OAuth. En Astral es WorkOS AuthKit Standalone Connect.

Login bridge
  Endpoint de tu app al que WorkOS redirige para autenticar al humano
  con el login existente.

Product policy
  La capa propia que decide si el usuario puede usar MCP y que tools ve.

Consent/audit mirror
  Tablas internas para trazabilidad, permisos derivados, revocacion futura
  y debugging de producto.
```

Regla reusable:

```text
El proveedor OAuth prueba "quien es el humano y para que resource va el token".
Tu app decide "que puede hacer este usuario dentro de mi producto".
```

---

## Diagrama de bloques

```text
                 +--------------------+
                 | Claude / ChatGPT   |
                 | MCP client         |
                 +---------+----------+
                           |
                           | 1. POST /api/mcp/v1 sin bearer
                           v
                 +---------+----------+
                 | Astral MCP server  |
                 | Resource server    |
                 +---------+----------+
                           |
                           | 2. 401 WWW-Authenticate
                           |    resource_metadata=...
                           v
                 +---------+----------+
                 | Protected Resource |
                 | Metadata           |
                 +---------+----------+
                           |
                           | 3. authorization_servers=[WorkOS issuer]
                           v
                 +---------+----------+
                 | WorkOS AuthKit     |
                 | Authorization      |
                 | Server             |
                 +---------+----------+
                           |
                           | 4. Login URI + external_auth_id
                           v
                 +---------+----------+
                 | Astral web auth    |
                 | SuperTokens        |
                 +---------+----------+
                           |
                           | 5. Usuario logueado + plan valido
                           |    POST WorkOS complete API
                           v
                 +---------+----------+
                 | WorkOS OAuth       |
                 | consent + token    |
                 +---------+----------+
                           |
                           | 6. Claude/ChatGPT llama MCP con bearer
                           v
                 +---------+----------+
                 | Astral validates   |
                 | JWT + user + plan  |
                 +---------+----------+
                           |
                           | 7. tools/list + tools/call
                           v
                 +---------+----------+
                 | Astral tools       |
                 | ask + HD deterministic + audited bodygraph write |
                 +--------------------+
```

---

## Flujo de auth real

```text
Cliente MCP
  |
  | POST /api/mcp/v1
  | sin Authorization
  v
Astral MCP
  |
  | 401
  | WWW-Authenticate:
  |   Bearer resource_metadata="https://astral.../.well-known/oauth-protected-resource"
  v
Cliente lee metadata
  |
  | resource=https://astral.../api/mcp/v1
  | authorization_servers=[https://...authkit.app]
  | scopes_supported=[openid, profile, email, offline_access]
  v
WorkOS OAuth
  |
  | redirige a:
  | /auth/workos/connect?external_auth_id=...
  v
Astral Login URI
  |
  | si no hay sesion web valida:
  |   redirect /auth?redirectToPath=/auth/workos/connect?external_auth_id=...
  |
  | si hay sesion web valida:
  |   valida user.status
  |   valida user.onboarding_status
  |   valida user.plan
  |   llama WorkOS complete API
  v
WorkOS
  |
  | devuelve redirect_uri
  v
Astral redirect -> WorkOS -> Cliente MCP
  |
  | Cliente intercambia code por access token
  v
Cliente MCP llama /api/mcp/v1 con bearer
  |
  v
Astral valida JWT WorkOS
  |
  | firma via JWKS
  | issuer
  | audience/resource
  | subject
  | scopes OAuth estandar
  v
Astral resuelve usuario + permisos internos
  |
  | user_identities(provider='workos', provider_user_id=<sub/external_id>)
  | plan -> scopes MCP internos
  | consent mirror interno
  v
Tools disponibles
```

---

## Glosario corto

**MCP resource server**

El backend que expone tools. En Astral es `/api/mcp/v1`. No emite tokens; solo
los verifica y decide si ejecutar tools.

**Authorization server**

El servidor que corre OAuth. En Astral V1 es WorkOS AuthKit, no SuperTokens.

**Protected Resource Metadata**

JSON publico que le dice al cliente MCP: "este resource se autentica contra
este authorization server". Si esto esta mal, el cliente ni siquiera sabe donde
loguearse.

**Resource Indicator**

La URL exacta del recurso protegido: `https://astral.soydanielamedina.com/api/mcp/v1`.
Debe coincidir entre Astral, WorkOS y el token `aud`.

**Issuer**

El identificador del authorization server. En nuestro caso:
`https://thoughtful-trinket-33-staging.authkit.app`. Comparar strings exactos;
evitar drift con slash final.

**JWKS**

Endpoint publico de llaves para verificar JWTs WorkOS:
`/oauth2/jwks`.

**Login URI**

Endpoint de Astral que WorkOS invoca para autenticar al humano con el sistema
existente: `/auth/workos/connect`.

**external_auth_id**

ID temporal que WorkOS le pasa a Astral. Astral debe devolverlo a WorkOS en la
completion API. No se reutiliza entre intentos.

**DCR**

Dynamic Client Registration. Permite que Claude/ChatGPT creen su OAuth client
sin que nosotros carguemos client id/secret a mano.

**CIMD**

Client ID Metadata Document. Requisito practico para compatibilidad MCP con
clientes modernos que registran clientes dinamicos.

**OAuth scopes vs MCP permissions**

No son lo mismo en esta implementacion. OAuth usa scopes estandar:
`openid profile email offline_access`. MCP permissions (`mcp:read_hd`,
`mcp:write_bodygraph`, `mcp:ask`) son permisos internos derivados del plan
Astral.

---

## Decisiones que funcionaron

### 1. WorkOS como OAuth layer, no como login web

WorkOS Standalone Connect esta pensado para apps que ya tienen auth propia: la
app mantiene su login y WorkOS se encarga del OAuth externo. Eso calzo perfecto
con Astral porque SuperTokens ya era el login web.

Patron reusable:

```text
No migres tu app a OAuth para soportar MCP.
Agrega un authorization server externo que delegue login a tu app.
```

### 2. PAT para dev, OAuth para producto

PAT/bearer manual sirvio para:

```text
curl
Claude Code
Codex CLI
smoke local
```

Pero no sirve como producto para Claude Web o ChatGPT. Los conectores remotos
esperan discovery + OAuth.

### 3. Plan de producto manda, no los scopes del proveedor

Los permisos de tools se derivan asi:

```text
free    -> no MCP
basic   -> mcp:read_hd + mcp:write_bodygraph
premium -> mcp:read_hd + mcp:write_bodygraph + mcp:ask
```

Esto evita que el proveedor OAuth sea la fuente de verdad de producto. WorkOS
emite tokens; Astral decide el contrato de acceso.

### 4. Consent mirror interno

Astral mantiene `mcp_clients` y `mcp_consents` como espejo interno. Ese espejo
no reemplaza al token WorkOS: si no hay token valido, no hay acceso. Sirve para
auditar, filtrar tools y mantener contratos internos.

### 5. WorkOS configurado como authorization server externo

Configuracion que realmente quedo funcionando:

```text
WorkOS product:
  AuthKit Standalone Connect / MCP Auth

AuthKit issuer:
  https://thoughtful-trinket-33-staging.authkit.app

Astral MCP resource indicator:
  https://astral.soydanielamedina.com/api/mcp/v1

Astral Login URI:
  https://astral.soydanielamedina.com/auth/workos/connect

Dynamic Client Registration:
  enabled

Client ID Metadata Document:
  enabled
```

Requisitos que no controla el codigo Astral:

```text
Dominio publico HTTPS estable
WorkOS account/environment activo
WORKOS_API_KEY configurado solo en Render/dashboard
DCR/CIMD habilitados en WorkOS
Resource Indicator exacto en WorkOS
Login URI exacto en WorkOS
Claude/ChatGPT con acceso al feature de custom/remote connectors
```

No hizo falta para V1:

```text
OAuth propio en Astral
SSO enterprise
SCIM
WorkOS custom domain
otro Render service
client id manual para Claude/ChatGPT
secret pegado por el usuario
```

### 6. Logs diagnosticos temporales

Para llegar a verde hizo falta loguear de forma segura:

```text
hasBearer
error reason
tokenShape
iss
aud
kid
claim presence
```

Nunca loguear:

```text
bearer token raw
email
subject raw si no hace falta
profile / memory / intake
```

Hay un bead abierto para limpiar/bajar estos logs: `astral-r1i`.

### 7. Separar compatibilidad de seguridad

Los fixes de compatibilidad que aceptamos no aflojan la seguridad central:

```text
Aceptar application/octet-stream si el body es JSON-RPC valido.
Aceptar token sin client_id solo despues de verificar JWT completo.
Tratar stale web session como anonymous en Login URI.
```

Lo que no se relajo:

```text
issuer exacto
audience/resource exacto
firma via JWKS
subject presente
plan/status/onboarding internos
tools minimizadas; escrituras solo con scope dedicado, confirmacion y auditoria
```

---

## Findings que no eran obvios

### Finding 1: No anunciar `mcp:*` como OAuth scopes en WorkOS

Al principio Astral anunciaba:

```text
scopes_supported=[mcp:ask, mcp:read_hd]
```

Pero WorkOS AuthKit anunciaba scopes OAuth estandar:

```text
openid
profile
email
offline_access
```

Clientes reales pueden tomar `scopes_supported` literalmente. Claude fallo con
`invalid_scope` / token exchange fallido. La solucion fue:

```text
Protected Resource Metadata anuncia OAuth scopes estandar.
Astral deriva MCP permissions internamente por plan.
```

### Finding 2: El issuer debe ser exacto

El slash final puede importar segun cliente/proveedor. Normalizamos:

```text
https://thoughtful-trinket-33-staging.authkit.app
```

No:

```text
https://thoughtful-trinket-33-staging.authkit.app/
```

### Finding 3: WorkOS token real puede venir sin `client_id`

En el smoke real, el JWT venia asi:

```text
iss = WorkOS issuer
aud = Astral MCP resource URL
sub = presente
scope = string
client_id / azp / cid = ausente
```

Nuestro backend rechazaba el token por no tener `client_id`. El fix fue usar un
client id interno estable (`workos-authkit`) cuando el token ya paso:

```text
firma OK
issuer OK
audience/resource OK
subject OK
scope OAuth OK
```

Leccion reusable: no asumas que todos los proveedores emiten `client_id` en el
access token. Si tu resource server necesita un client id interno, define un
fallback estable despues de verificar criptograficamente el token.

### Finding 4: ChatGPT puede mandar JSON como `application/octet-stream`

ChatGPT hizo un probe MCP con:

```text
content-type: application/octet-stream
```

Fastify lo rechazo con `415`. El fix fue aceptar ese content type y parsearlo
como JSON si el payload lo permite.

Leccion reusable: clientes MCP reales no siempre mandan los headers ideales del
smoke local. El server debe ser estricto con seguridad, pero tolerante con
content-type cuando el body sigue siendo JSON-RPC valido.

### Finding 5: Cookies web stale rompen Login URI si se tratan como error duro

Cuando WorkOS abria:

```text
/auth/workos/connect?external_auth_id=...
```

SuperTokens podia responder:

```json
{"message":"try refresh token"}
```

Eso deja a Claude/ChatGPT colgados porque esperaban una pagina/login redirect,
no JSON tecnico.

El fix real fue tratar sesiones opcionales rotas como anonimas:

```text
stale cookie -> anonymous -> redirect /auth?redirectToPath=...
```

Leccion reusable: el Login URI debe ser UX-safe. Nunca debe filtrar errores
crudos de session middleware al usuario final.

### Finding 6: Duplicados de usuario pueden parecer bugs OAuth

Tuvimos dos usuarios Brian:

```text
Usuario A: email brianmontero18@gmail.com, basic, casi sin datos
Usuario B: email null, free, con assets/chats/llm_calls, sesion actual
```

El OAuth bridge bloqueaba por `plan_upgrade_required`, pero no era WorkOS ni
Claude: era identity mismatch interno.

Leccion reusable:

```text
Antes de culpar OAuth, auditar:
  users.email
  users.plan
  users.status
  users.onboarding_status
  user_identities
  datos asociados al usuario canonico
```

### Finding 7: El primer `401` es normal

Tanto Claude como ChatGPT suelen empezar con:

```text
POST /api/mcp/v1 sin bearer -> 401
```

Eso no es un error si incluye `WWW-Authenticate` con `resource_metadata`.

El problema empieza si despues del OAuth siguen apareciendo:

```text
hasBearer=true + invalid_token
hasBearer=true + invalid_audience
hasBearer=false en requests post-OAuth
```

### Finding 8: El Login URI es producto, no solo backend

`/auth/workos/connect` no puede comportarse como endpoint tecnico puro. Para el
cliente MCP, ese endpoint es la puerta de entrada humana. Tiene que:

```text
recibir external_auth_id
resolver sesion web si existe
redirigir a login si no existe
preservar redirectToPath
mostrar caminos claros ante plan insuficiente/onboarding pendiente
terminar en WorkOS complete API si el usuario esta habilitado
```

Si devuelve JSON tecnico, stack traces, `401` crudo o errores de refresh, el
usuario final ve "authorization failed" sin contexto.

### Finding 9: El smoke local no predice todos los clientes

`npm run smoke:mcp` y `curl` validan el contrato que controlamos. No cubren:

```text
browser redirects de Claude/ChatGPT
consent UI del proveedor
headers raros del cliente real
token claims exactos que emite WorkOS
stale cookies del navegador del usuario
feature availability del cliente
```

Leccion reusable: cada release que toque auth/discovery debe cerrar con al menos
un smoke real de un cliente humano, no solo suite local.

---

## Runbook de diagnostico

### Si falla antes de abrir login

Revisar:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-protected-resource/api/mcp/v1
WWW-Authenticate en 401
MCP_RESOURCE_URL exacto
MCP_AUTHORIZATION_SERVER_ISSUER exacto
WorkOS Resource Indicator exacto
```

### Si falla con `invalid_scope`

Revisar:

```text
scopes_supported en Protected Resource Metadata
WorkOS authorization server metadata
No anunciar mcp:* como OAuth scopes si WorkOS no los soporta
```

### Si falla con `plan_upgrade_required`

Revisar:

```text
users.plan
users.status
users.onboarding_status
user_identities
sesion web actual
duplicados por email/null email
```

### Si falla con `try refresh token`

Revisar:

```text
Login URI no debe usar middleware que pre-envie 401.
Sesion opcional rota debe ser anonymous.
Redirigir a /auth?redirectToPath=...
```

### Si falla con `invalid_token`

Loguear temporalmente:

```text
hasBearer
tokenShape
iss
aud
resource
alg
kid
hasSubject
hasClientId
hasExternalId
scopeType
permissionsType
```

Interpretacion:

```text
tokenShape=opaque
  -> proveedor emite opaque tokens; hay que usar introspection.

issuer distinto
  -> config WorkOS/issuer incorrecta.

aud distinto
  -> Resource Indicator / MCP_RESOURCE_URL no coincide.

kid no existe en JWKS
  -> issuer/JWKS equivocado o rotacion/cache.

hasClientId=false pero todo lo demas OK
  -> usar fallback interno estable si el proveedor no emite client_id.
```

### Si ChatGPT devuelve `415`

Aceptar `application/octet-stream` y parsear como JSON si corresponde.

---

## Blueprint para replicar en otra app

```text
1. Definir resource URL publico
   https://app.example.com/api/mcp/v1

2. Implementar MCP server stateless
   initialize
   ping
   tools/list
   tools/call

3. Publicar Protected Resource Metadata
   resource=<resource URL exacta>
   authorization_servers=[<issuer exacto>]
   scopes_supported=[scopes OAuth del proveedor]

4. Configurar WorkOS Standalone Connect
   Login URI=https://app.example.com/auth/workos/connect
   Resource Indicator=<resource URL exacta>
   DCR enabled
   CIMD enabled

5. Implementar Login URI
   recibe external_auth_id
   resuelve sesion web existente
   si no hay sesion: redirect login con redirectToPath
   valida usuario/producto
   llama WorkOS complete API
   redirect a redirect_uri

6. Validar access tokens en resource server
   firma via JWKS
   issuer exacto
   audience/resource exacto
   subject
   scopes OAuth estandar

7. Mapear identidad a usuario interno
   user_identities(provider='workos', provider_user_id=<sub/external_id>)

8. Derivar permisos internos
   plan/product/status/onboarding -> tools permitidas

9. Crear mirror interno
   mcp_clients
   mcp_consents
   audit events

10. Smoke real
   curl/PAT
   Claude Code
   Claude Web
   ChatGPT

11. Hardening
   stale sessions
   content-type quirks
   token diagnostics
   duplicate users
   log cleanup
```

---

## Diagrama de responsabilidades

```text
+--------------------------+-------------------------------+
| Capa                     | Responsabilidad               |
+--------------------------+-------------------------------+
| ChatGPT / Claude         | MCP client, OAuth flow UX      |
| WorkOS AuthKit           | OAuth AS, DCR/CIMD, tokens     |
| Astral /auth/workos      | Login bridge con sesion web    |
| SuperTokens              | Sesion humana dentro de Astral |
| Astral /api/mcp/v1       | Resource server MCP            |
| Astral policy            | Plan -> permisos MCP internos  |
| Astral tools             | ask + HD deterministic + audited bodygraph write |
| Astral audit/quota       | trazabilidad y limites         |
+--------------------------+-------------------------------+
```

---

## Diagrama de datos minimo

```text
users
  id
  email
  plan
  status
  onboarding_status
       |
       | 1:N
       v
user_identities
  provider='supertokens' -> login web
  provider='workos'      -> OAuth MCP subject

mcp_clients
  id='workos-authkit' o client_id real
  status

mcp_consents
  user_id
  client_id
  scopes_json derived from Astral plan

mcp_audit_events
  user_id
  client_id
  tool_name
  status
  metadata

llm_calls
  route='mcp_ask'
  user_id
  cost/tokens
```

---

## Anti-patterns detectados

No hacer:

- pedir al usuario pegar tokens bearer en Claude/ChatGPT;
- usar query params con secrets;
- mezclar cookies SuperTokens con bearer MCP;
- hacer que WorkOS scopes definan el producto Astral;
- anunciar `mcp:*` como OAuth scopes si el authorization server no los anuncia;
- asumir que todo token trae `client_id`;
- tratar stale web session como error JSON dentro del OAuth Login URI;
- confiar solo en tests locales: Claude y ChatGPT tienen quirks propios;
- dejar logs diagnosticos verbosos para siempre.

## One-page architecture diagram

Este es el diagrama que deberia poder leer otro AI agent antes de tocar codigo:

```text
                 PRODUCT INSTALL / CONNECT
                 -------------------------

User
  |
  | adds MCP URL
  v
Claude / ChatGPT
  |
  | POST /api/mcp/v1 without bearer
  v
Astral MCP resource server
  |
  | 401 + WWW-Authenticate:
  | resource_metadata=/.well-known/oauth-protected-resource
  v
Protected Resource Metadata
  |
  | resource = exact MCP URL
  | authorization_servers = [WorkOS issuer]
  | scopes_supported = OAuth scopes, not mcp:* permissions
  v
WorkOS AuthKit Standalone Connect
  |
  | OAuth + DCR/CIMD + consent + token issuance
  | redirects human to Astral Login URI with external_auth_id
  v
Astral Login Bridge
  |
  | uses SuperTokens web session
  | anonymous/stale session -> /auth?redirectToPath=...
  | valid session -> check status/onboarding/plan
  | enabled user -> WorkOS complete API
  v
WorkOS returns OAuth code/token to client
  |
  v
Claude / ChatGPT calls MCP with bearer
  |
  v
Astral validates token
  |
  | JWKS signature
  | issuer
  | audience/resource
  | subject
  | OAuth scopes
  v
Astral resolves internal principal
  |
  | user_identities(provider='workos')
  | mcp_clients / mcp_consents mirror
  | plan -> internal MCP permissions
  v
tools/list
  |
  +-- free    -> no MCP
  +-- basic   -> deterministic HD tools + bodygraph write tools
  +-- premium -> deterministic HD tools + bodygraph write tools + ask_astral_guide_v1
```

Invariant final:

```text
OAuth is delegated identity.
MCP permissions are product policy.
The resource server is the enforcement point.
```

---

## Estado final validado

```text
Claude Web:
  connector remoto OAuth -> OK
  tools disponibles -> OK

ChatGPT:
  connector remoto OAuth -> OK
  flow WorkOS -> OK

Astral:
  FEATURE_REMOTE_MCP=true en prod
  MCP_RESOURCE_URL=https://astral.soydanielamedina.com/api/mcp/v1
  MCP_AUTHORIZATION_SERVER_ISSUER=https://thoughtful-trinket-33-staging.authkit.app
  WorkOS Login URI=/auth/workos/connect
  SuperTokens sigue siendo auth web
```

---

## Pendientes recomendados

- `astral-r1i`: reducir/gatear logs diagnosticos MCP auth.
- Agregar runbook de revocacion/desconexion de connectors.
- Definir UI interna de "conectores conectados" si el producto lo necesita.
- Revisar si WorkOS production debe pasar de staging issuer a production issuer.
- Mantener smoke real de Claude/ChatGPT como parte de releases que toquen auth.
