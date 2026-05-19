# Remote MCP V3 - Human Design capability layer

**Estado**: declaracion inicial de intencion. No es spec ejecutable.
**Fecha**: 2026-05-19.
**Prerequisito producto**: V2 multi-profile / multiple profiles.
**Audiencia**: PMs tecnicos, architect, future AI agents.

Docs relacionados:

- [`remote-mcp-production-learnings.md`](remote-mcp-production-learnings.md)
- [`remote-mcp-oauth-connectors-genesis.md`](remote-mcp-oauth-connectors-genesis.md)
- [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md)
- [`human-design-reference.md`](human-design-reference.md)

---

## Intencion

V1 probo que Astral puede conectarse como Remote MCP a Claude Web y ChatGPT.
V3 debe responder una pregunta distinta:

```text
Para que deberia existir Astral MCP si el usuario ya esta usando Claude/ChatGPT?
```

Respuesta inicial:

```text
Astral MCP no debe intentar ser "otro chat".
Astral MCP debe ser una capa de capacidades de Human Design para AI clients.
```

El usuario trae el cerebro y los tokens de Claude/ChatGPT/Codex/Claude Code.
Astral aporta el cuerpo: calculos, contexto privado, perfiles, tránsitos,
permisos, fuentes estructuradas, auditoria y workflows de producto.

---

## Tesis de producto

La tool `ask_astral_guide_v1` fue util para validar el pipe, pero no deberia ser
el centro del producto MCP. Si el usuario ya esta en ChatGPT o Claude, ese host
ya es el LLM principal. El valor diferencial de Astral esta en disponibilizar
cosas que el LLM externo no sabe, no debe inventar, o no puede calcular con
confiabilidad.

```text
Mala direccion:
  ChatGPT -> ask_astral_guide_v1 -> otro LLM responde dentro de ChatGPT

Buena direccion:
  ChatGPT -> Astral tools -> datos/capacidades HD confiables
  ChatGPT usa esos resultados para razonar, escribir, planificar o ayudar.
```

La promesa V3:

```text
Usa Claude/ChatGPT como cerebro.
Usa Astral como sistema experto, calculadora HD y vault privado de perfiles.
```

---

## Principios

1. **Tools antes que agente**
   - Priorizar tools que devuelvan hechos, calculos, contexto estructurado o
     briefs.
   - Evitar wrappers de LLM salvo casos muy justificados.

2. **Read-only primero**
   - V3 debe empezar con lectura/capacidades seguras.
   - Escrituras y workflows con efectos laterales requieren confirmacion,
     auditoria y revocacion claras.

3. **Producto manda**
   - OAuth autentica.
   - Astral decide permisos por plan, rol, ownership y profile access.

4. **No PII innecesaria**
   - Exponer contexto util, no datos crudos sensibles.
   - Fecha/lugar/hora de nacimiento deben tratarse como sensibles.

5. **Host LLM compone**
   - Astral no necesita generar todos los textos finales.
   - Astral puede dar `context_pack`, `brief`, `source_pack`, `impact_summary`.

6. **Multi-profile cambia el juego**
   - V2 habilita el caso de coaches, consultoras y creadoras que trabajan con
     muchas personas.
   - V3 debe construirse encima de permisos por perfil, no solo "mi perfil".

---

## Usuarios objetivo

```text
Usuario individual premium
  Quiere usar Claude/ChatGPT con su propio diseño y transitos.

Coach / consultora HD
  Tiene multiples perfiles y quiere crear contenido, preparar sesiones,
  comparar diseños o revisar tránsitos para clientes.

Creator / operator
  Usa AI clients para redactar, planificar, sintetizar o producir assets
  usando contexto confiable de Astral.

Astral propio
  Futuro AI client propio de Astral puede consumir las mismas capabilities.
```

---

## Capas de capabilities

```text
+-----------------------------+---------------------------------------+
| Capa                        | Valor                                 |
+-----------------------------+---------------------------------------+
| HD deterministic engine     | Calculos y tablas que no deben variar |
| User/profile context vault  | Contexto privado autorizado           |
| Transit context             | Tiempo actual/futuro aplicado a HD    |
| Content/coaching briefs     | Inputs estructurados para el host LLM |
| Workflow/write tools        | Efectos laterales auditables          |
+-----------------------------+---------------------------------------+
```

---

## Tool families candidatas

### 1. Deterministic HD tools

Valor: evitar alucinaciones y dar primitives estables.

```text
get_gate_center_v1
get_channel_by_gates_v1
get_channels_by_gate_v1
get_profile_lines_meaning_v1
get_defined_centers_explanation_v1
```

Ya existe una primera version chica:

```text
find_channel_by_gates_v1
find_channels_by_gate_v1
get_center_for_gate_v1
```

Decision inicial: mantenerlas, pero no quedarse ahi. Son foundations, no el
producto final.

### 2. Bodygraph calculation tools

Valor: calcular o reconstruir datos HD de forma confiable.

Tool posible:

```text
calculate_bodygraph_v1
```

No empezar aceptando lugar libre como texto si no esta resuelto. Para V1 de esta
capability, preferir input ya normalizado:

```text
birth_date
birth_time
timezone
latitude
longitude
```

Una capability posterior podria resolver lugares:

```text
resolve_birth_place_v1
```

Riesgo: birth data es sensible. Requiere scope separado y politica clara.

### 3. My profile context tools

Valor: permitir que el LLM externo use el contexto Astral del usuario sin
inventarlo ni pedirle copiar/pegar datos.

Tools posibles:

```text
get_my_design_summary_v1
get_my_bodygraph_context_v1
get_my_active_gates_v1
get_my_defined_centers_v1
get_my_profile_context_pack_v1
```

Formato recomendado:

```text
structured facts
short explanations
source labels
no raw PII unless explicitly scoped
```

### 4. Multi-profile / coach tools

Valor: caso de uso mas fuerte para V3. Un coach usa ChatGPT/Claude como
copiloto, pero Astral como vault autorizado de clientes/perfiles.

Tools posibles:

```text
list_profiles_v1
get_profile_design_summary_v1
get_profile_context_pack_v1
compare_profiles_v1
get_profile_session_brief_v1
```

Escenario:

```text
"Prepara una sesion para Ana usando su diseño y los temas que vimos."

Host LLM llama:
  list_profiles_v1
  get_profile_context_pack_v1(profile_id)
  get_profile_session_brief_v1(profile_id)
```

Prerequisito: V2 debe definir ownership, permisos y lifecycle de multiples
perfiles.

### 5. Transit tools

Valor: tiempo. El LLM puede hablar de tránsitos en abstracto, pero Astral puede
calcular el contexto del dia y su impacto sobre un diseño.

Tools posibles:

```text
get_current_transit_context_v1
get_transits_for_date_v1
get_transit_impact_for_my_profile_v1
get_transit_impact_for_profile_v1
```

Escenario:

```text
"Dame ideas de contenido para esta semana para mi clienta Ana."

Host LLM llama:
  get_profile_context_pack_v1(profile_id)
  get_transits_for_date_v1(date)
  get_transit_impact_for_profile_v1(profile_id, date)
```

### 6. Content/coaching brief tools

Valor: Astral prepara el material correcto; el host LLM escribe con su propio
estilo/modelo.

Preferir:

```text
get_content_brief_for_profile_v1
get_coaching_angles_for_profile_v1
get_transit_content_brief_v1
get_report_source_pack_v1
```

Evitar como primera apuesta:

```text
generate_instagram_post_v1
generate_full_report_v1
analyze_everything_v1
```

Motivo: esas tools compiten con el host LLM y mezclan calidad editorial,
modelo, tono, costo y ownership del output.

### 7. Write/workflow tools

Valor: cerrar acciones dentro de Astral desde el AI client.

Tools futuras:

```text
create_profile_v1
update_profile_intake_v1
save_profile_note_v1
create_content_draft_v1
mark_report_ready_v1
```

No son V3 inicial. Requieren:

```text
confirmacion humana
audit fuerte
revocacion
idempotencia
permisos por perfil
rollback o historial
```

---

## Scopes preliminares

No decidir nombres finales todavia. Posible mapa:

```text
mcp:read_hd
  deterministic reference tools

mcp:calculate_hd
  bodygraph calculation

mcp:read_profile_summary
  own profile context packs

mcp:read_profiles
  multi-profile listing and selected profile context

mcp:read_transits
  current/date transit context

mcp:read_transit_impact
  transit impact against a profile

mcp:write_profiles
  future write tools, not initial V3
```

Guardrail: OAuth scopes publicos de WorkOS pueden seguir siendo estandar. Estos
son permisos internos de Astral, derivados por producto y enforcement propio.

---

## Roadmap tentativo

```text
V2:
  Multiple profiles dentro de Astral.
  Ownership, permisos, perfiles canonicos, UX y APIs base.

V3.0:
  Strategy/spec de capabilities MCP.
  Taxonomia de tools, scopes internos, data contracts y threat model.

V3.1:
  Read-only profile context packs para "my profile".

V3.2:
  Multi-profile read-only tools para coaches.

V3.3:
  Transit context + impact tools.

V3.4:
  Content/coaching brief tools.

V3.5:
  Optional write/workflow tools con confirmacion y audit.
```

---

## Diagrama PM

```text
                +------------------------+
                | Claude / ChatGPT       |
                | cerebro + tokens host  |
                +-----------+------------+
                            |
                            | tool calls
                            v
                +-----------+------------+
                | Astral Remote MCP      |
                | capability layer       |
                +-----------+------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
+---------------+   +---------------+   +---------------+
| HD engine     |   | Profile vault |   | Transit engine|
| deterministic |   | authorized    |   | date/current  |
+-------+-------+   +-------+-------+   +-------+-------+
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                +-----------+------------+
                | Structured context     |
                | facts / packs / briefs |
                +-----------+------------+
                            |
                            v
                +-----------+------------+
                | Host LLM composes      |
                | answer/content/session |
                +------------------------+
```

---

## Anti-goals iniciales

- No convertir MCP en un segundo chat Astral.
- No priorizar `ask_astral_guide_v1` como producto principal.
- No exponer birth data cruda por comodidad.
- No agregar write tools antes de resolver confirmacion/audit/revocacion.
- No crear scopes personales amplios tipo "read everything".
- No exponer perfiles de clientes sin modelo de ownership V2 cerrado.
- No hacer que WorkOS sea fuente de verdad de permisos de producto.

---

## Preguntas abiertas

| # | Pregunta | Para quien | Bloqueante |
|---|---|---|---|
| 1 | Que shape tendra V2 multi-profile: owner, client, workspace, coach, household? | PM/Architecture | Si |
| 2 | Que datos de birth/bodygraph se consideran PII o sensibles para MCP? | PM/Security | Si |
| 3 | El usuario individual y el coach comparten scopes o deben separarse por rol? | PM/Architecture | Si |
| 4 | Los profiles pueden tener consentimiento propio para ser usados por AI clients externos? | PM/Legal/Product | Si |
| 5 | Que output contract queremos para `context_pack`: markdown, JSON estructurado, ambos? | Architecture | No |
| 6 | Los transit tools deben depender de hora exacta o alcanza fecha/dia local en V3 inicial? | Product/HD | No |
| 7 | Content briefs deben ser neutros o incluir tono/estrategia de marca del coach? | Product | No |
| 8 | Que host clients son target de V3: ChatGPT, Claude, Claude Code, Codex, Astral propio? | PM | No |

---

## Slices iniciales propuestos

| Slice | Nombre | Entregable independiente |
|---|---|---|
| 0 | V3 strategy lock | Taxonomia, anti-goals, permisos internos y orden de capabilities. |
| 1 | MCP context-pack contract | Contrato de outputs para facts/context/briefs sin PII innecesaria. |
| 2 | My profile read-only tools | Primeras tools autenticadas que exponen contexto propio, no agente. |
| 3 | Multi-profile MCP readiness | Adaptar el plan a V2 multi-profile: ownership, profile IDs, access model. |
| 4 | Coach read-only profile tools | Listar perfiles y obtener context packs autorizados. |
| 5 | Transit context tools | Exponer contexto de tránsitos por fecha/current. |
| 6 | Transit impact tools | Aplicar tránsitos a un perfil autorizado. |
| 7 | Content/coaching brief tools | Briefs estructurados para que el host LLM genere contenido o sesiones. |
| 8 | Write tools decision gate | Decidir si/como habilitar escritura con confirmacion y audit. |

---

## Criterio de exito

V3 funciona cuando una persona puede abrir Claude/ChatGPT y pedir algo como:

```text
"Prepara una sesion para Ana esta semana usando su diseño y los tránsitos."
```

Y el host LLM puede resolverlo llamando capabilities de Astral, sin inventar
datos HD, sin copiar/pegar contexto manualmente y sin que Astral tenga que ser
el LLM principal.
