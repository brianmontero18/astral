# Context Workspace Architecture

**Fecha:** 2026-05-10
**Estado:** arquitectura conceptual v0, no implementación final
**Capa:** modelo de datos, endpoints y contratos frontend
**Leer antes:** [bodygraph-relacional.md](./bodygraph-relacional.md), [context-workspace-ux.md](./context-workspace-ux.md)
**Leer después:** [context-workspace-e2e-plan.md](./context-workspace-e2e-plan.md), [context-workspace-migration-plan.md](./context-workspace-migration-plan.md)

Este documento baja la intención y la UX a contratos de producto/arquitectura. No es una spec ejecutable final. Su objetivo es darle a futuros agentes un mapa claro para diseñar migraciones sin romper la app actual.

## Problema Técnico-Producto

Hoy Astral usa `users.profile` como bodygraph canónico. Ese perfil alimenta:

- onboarding;
- chat;
- reportes;
- tránsitos;
- assets;
- memoria.

Eso funciona con una carta principal. No funciona cuando la cuenta necesita múltiples sujetos y conexiones. La arquitectura objetivo debe separar:

```text
Cuenta autenticada
  ≠
Sujeto analizado
  ≠
Conexión relacional
  ≠
Superficie activa
```

## Principios De Arquitectura

1. **`users` representa la cuenta, no la carta.**
2. **`subjects` representa cartas/bodygraphs individuales.**
3. **`connections` representa vínculos A+B persistentes.**
4. **Todo Chat/Informe/Tránsitos debe recibir `contextId`.**
5. **La UI no consume tablas ni respuestas crudas. Consume ViewModels.**
6. **La migración debe mantener compatibilidad con `users.profile` hasta completar el cambio.**
7. **E2E define el contrato antes del refactor.**

## ContextRef

La abstracción central:

```ts
type ContextKind = "subject" | "connection";

interface ContextRef {
  id: string;
  kind: ContextKind;
}
```

Todo flujo debe poder responder:

```text
¿Cuál es el ContextRef activo?
¿Qué superficie se está renderizando sobre ese ContextRef?
```

## Modelo DB Conceptual

No usar estos nombres como migración literal sin spec técnica. Son el modelo conceptual recomendado.

### users

Sigue representando la cuenta autenticada.

```text
users
  id
  name
  email
  plan
  role
  status
  onboarding_status
  onboarding_step
  created_at
  updated_at
```

Campos legacy a mantener temporalmente:

```text
users.profile
users.profile_asset_id
users.intake
users.memory_md
```

Durante migración, esos campos pueden mapearse al sujeto principal.

### subjects

Representa una entidad individual analizable.

```text
subjects
  id
  user_id
  kind                 -- self | client | partner_family | business | animal | symbolic | other
  display_name
  is_primary           -- true para "Mi carta"
  privacy_label        -- private default
  created_at
  updated_at
  archived_at
```

Reglas:

- cada cuenta tiene exactamente un subject primario al terminar onboarding;
- subject primario reemplaza mentalmente a `users.profile`;
- terceros pueden usar alias;
- borrar subject debe tener reglas claras si participa en conexiones.

### subject_bodygraphs

Representa el bodygraph vigente de un sujeto.

```text
subject_bodygraphs
  id
  subject_id
  profile_json
  source_asset_id
  profile_hash
  birth_data_policy    -- stored | minimized | absent
  created_at
  updated_at
```

Decisión pendiente:

- una tabla versionada permite historial;
- un campo `subjects.profile_json` simplifica V1.

Recomendación: diseñar para versionado, implementar simple si el costo es alto.

### subject_intakes

Intake narrativo asociado a un sujeto.

```text
subject_intakes
  subject_id
  intake_json
  updated_at
```

El intake actual de negocio del usuario se migra al subject primario.

### connections

Objeto relacional persistente.

```text
connections
  id
  user_id
  display_name
  relationship_kind    -- business | client | partner | family | friendship | team | other
  subject_a_id
  subject_b_id
  notes_json
  created_at
  updated_at
  archived_at
```

Reglas:

- V1 soporta dos sujetos;
- `subject_a_id` y `subject_b_id` no pueden ser iguales;
- conexiones de tercero + tercero son permitidas, pero no happy path inicial;
- borrar un subject debe bloquear, archivar o borrar conexiones dependientes con confirmación.

### context_threads

Thread conversacional por contexto.

```text
context_threads
  id
  user_id
  context_kind         -- subject | connection
  context_id
  created_at
  updated_at
```

### chat_messages

Evoluciona de `user_id` únicamente a thread/context.

```text
chat_messages
  id
  thread_id
  user_id
  role
  content
  feedback_*
  created_at
```

Compatibilidad temporal:

- mensajes legacy sin thread se asignan al thread del subject primario;
- mientras exista legacy, no mezclar historial nuevo de conexiones con historial viejo.

### context_memories

Memoria persistente scopiada.

```text
context_memories
  id
  user_id
  context_kind
  context_id
  memory_md
  updated_at
```

Regla crítica:

- memoria de `Brian` no debe inyectarse como memoria de `Cliente X`;
- una conexión puede tener memoria propia;
- memoria global de cuenta, si existe, debe estar separada y ser muy limitada.

### context_reports

Reportes por contexto.

```text
context_reports
  id
  user_id
  context_kind
  context_id
  tier
  report_kind          -- individual | relational
  context_hash
  content
  tokens_used
  cost_usd
  created_at
  updated_at
```

`context_hash` debe incluir:

- subject: profile hash + intake hash;
- connection: hash de subject A + subject B + connection metadata/intake.

### assets

Assets deben poder asociarse a sujeto.

```text
assets
  id
  user_id
  subject_id nullable
  filename
  mime_type
  file_type
  storage_key
  created_at
  updated_at
```

Durante migración, assets legacy sin `subject_id` pueden mapearse al subject primario si son activos.

### transit_cache

Sigue siendo colectivo, no por contexto.

```text
transit_cache
  cache_key
  data
  created_at
```

La personalización/relación se calcula por request o por ViewModel derivado.

## Endpoints Conceptuales

No son rutas finales. Son contrato de capacidad.

### Contextos

```text
GET /api/contexts
```

Devuelve sujetos y conexiones disponibles para el usuario.

```text
GET /api/contexts/:contextId
```

Devuelve el workspace model para un contexto.

### Sujetos

```text
POST /api/subjects
PATCH /api/subjects/:subjectId
DELETE /api/subjects/:subjectId
GET /api/subjects/:subjectId
```

Crear/editar/borrar entidades individuales.

```text
POST /api/subjects/:subjectId/bodygraph
```

Sube/reemplaza el bodygraph de un sujeto.

### Conexiones

```text
POST /api/connections
PATCH /api/connections/:connectionId
DELETE /api/connections/:connectionId
GET /api/connections/:connectionId
```

Crear/editar/borrar conexiones A+B.

### Chat

```text
GET /api/contexts/:contextId/messages
POST /api/contexts/:contextId/chat
POST /api/contexts/:contextId/chat/stream
DELETE /api/contexts/:contextId/messages?fromId=...
```

El backend resuelve contexto y arma prompt según `contextKind`.

### Reportes

```text
GET /api/contexts/:contextId/report?tier=...
POST /api/contexts/:contextId/report
POST /api/contexts/:contextId/report/share
GET /api/contexts/:contextId/report/pdf
```

Reportes individuales y relacionales comparten endpoint pero no plantilla.

### Tránsitos

```text
GET /api/contexts/:contextId/transits?mode=today&timeZone=...&clientNow=...
GET /api/contexts/:contextId/transits?mode=next7Days&timeZone=...
```

Para sujeto:

- calcula impacto personalizado contra su bodygraph.

Para conexión:

- calcula impacto en A;
- impacto en B;
- lectura dinámica A+B;
- lectura del tránsito sobre la conexión.

## Contratos Frontend

La UI no debería consumir respuestas crudas de DB/API. Debe consumir modelos de pantalla.

### WorkspaceContextModel

```ts
type WorkspaceContextKind = "subject" | "connection";

interface WorkspaceContextModel {
  id: string;
  kind: WorkspaceContextKind;
  title: string;
  subtitle: string;
  badge: string;
  isPrimary: boolean;
  availableSurfaces: Array<"chat" | "report" | "transits" | "chart" | "dynamics">;
  privacyHint?: string;
}
```

### ContextLibraryModel

```ts
interface ContextLibraryModel {
  primarySubject: WorkspaceContextModel;
  subjects: WorkspaceContextModel[];
  connections: WorkspaceContextModel[];
  recent: WorkspaceContextModel[];
  actions: {
    canCreateSubject: boolean;
    canCreateConnection: boolean;
  };
}
```

### ContextShellModel

```ts
interface ContextShellModel {
  activeContext: WorkspaceContextModel;
  navItems: Array<{
    id: "chat" | "report" | "transits" | "chart" | "dynamics";
    label: string;
    enabled: boolean;
  }>;
  quickActions: Array<{
    id: string;
    label: string;
    targetSurface: string;
  }>;
}
```

### ChatScreenModel

```ts
interface ChatScreenModel {
  context: WorkspaceContextModel;
  title: string;
  description: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    pending?: boolean;
  }>;
  quickActions: Array<{ label: string; prompt: string }>;
  composerPlaceholder: string;
}
```

### ReportScreenModel

```ts
interface ReportScreenModel {
  context: WorkspaceContextModel;
  reportKind: "individual" | "relational";
  state: "missing" | "ready" | "stale" | "generating" | "error";
  title: string;
  sections: Array<{
    id: string;
    title: string;
    body: string;
    tier: "free" | "premium";
  }>;
  actions: Array<{ id: string; label: string }>;
}
```

### TransitScreenModel

Debe extender el ADR actual.

```ts
interface TransitScreenModel {
  context: WorkspaceContextModel;
  mode: "today" | "next7Days";
  layer: "summary" | "subjectA" | "subjectB" | "dynamics";
  header: {
    title: string;
    activeTimeLabel: string;
    rangeLabel: string;
  };
  primaryInsight: {
    eyebrow: string;
    title: string;
    body: string;
    facts: string[];
  };
  sections: Array<{
    id: string;
    title: string;
    items: Array<{ title: string; body: string; facts: string[] }>;
  }>;
  timeline?: unknown;
  actions: Array<{ id: string; label: string }>;
}
```

## Adapter Pattern Recomendado

```text
API response
  ↓
context repository
  ↓
surface adapter
  ↓
ScreenModel
  ↓
presentational components
```

Guardrails:

- componentes visuales no importan `fetch*`;
- componentes visuales no calculan reglas HD;
- UI no decide si un centro queda definido por una puerta aislada;
- chat no reconstruye contexto desde texto libre;
- reportes no leen `users.profile` directamente en frontend;
- tránsitos no reciben `UserProfile` como escape hatch salvo en compat temporal.

## Compatibilidad Legacy

Durante la migración:

- `users.profile` sigue siendo source of truth para la app actual;
- se crea un subject primario que representa `users.profile`;
- endpoints `/api/me/*` pueden seguir funcionando como wrappers del subject primario;
- chat legacy se considera thread del subject primario;
- report legacy se considera reporte individual del subject primario;
- asset activo legacy se asocia al subject primario.

## Preguntas Técnicas Bloqueantes Para La Spec

1. ¿Se implementa `subject_bodygraphs` como tabla versionada o `subjects.profile_json` para V1?
2. ¿Cómo se representa `contextId`: UUID único global o par `kind + id`?
3. ¿Los endpoints nuevos conviven con `/api/me/*` o los reemplazan en una sola migración?
4. ¿Cómo se migra `users.memory_md` sin contaminar sujetos/conexiones?
5. ¿Qué hashing exacto invalida informe relacional?
6. ¿Qué operación borra conexiones cuando se borra un sujeto?

## Decisión Temporal

Diseñar la implementación como migración incremental:

1. E2E congela comportamiento actual.
2. Subject primario se introduce como sombra de `users.profile`.
3. Biblioteca usa sujetos/conexiones.
4. Chat, reportes y tránsitos migran a `contextId`.
5. Legacy `/api/me/*` queda como compat hasta eliminarlo con seguridad.
