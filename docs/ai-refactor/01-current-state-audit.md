# AI/LLM Layer Mapping — Astral Guide

**Fecha**: 2026-04-26
**Generado por**: sub-agente Explorer sobre el codebase real
**Scope**: inventario completo de integraciones LLM, prompts, context assembly, data flow

---

## 1. All Places That Call an LLM

### 1.1 Chat/Agent Service (Interactive Chat)

**File**: `backend/src/agent-service.ts`

#### Function: `runAstralAgent()`
- **Model**: `gpt-4o-mini` (line 159)
- **Max tokens**: 4096 (line 176)
- **Temperature**: not set (uses OpenAI default 1.0)
- **Streaming**: No — non-streaming response
- **Tools/Function calling**: No
- **Structured outputs**: No
- **When called**: POST `/api/chat` non-streaming path (routes/chat.ts:37-115)

#### Function: `runAstralAgentStream()`
- **Model**: `gpt-4o-mini` (line 159)
- **Max tokens**: 4096 (line 229)
- **Temperature**: not set (default 1.0)
- **Streaming**: Yes — SSE (Server-Sent Events) with `stream: true` parameter (line 229)
- **Tools/Function calling**: No
- **Structured outputs**: No
- **When called**: POST `/api/chat/stream` (routes/chat.ts:118-210)
- **Output format**: Yields string chunks; final event includes `{ done: true, transits_used, userMsgId, assistantMsgId }`

**API calls**: Both functions use `fetch()` to `https://api.openai.com/v1/chat/completions` (line 158, 220)

### 1.2 Report Generation (Weekly Reports)

**File**: `backend/src/report/generate-report.ts`

#### Function: `callLLM()` (internal helper)
- **Model**: `gpt-4o-mini` (line 19)
- **Max tokens**: 2048 (line 47)
- **Temperature**: not set (default 1.0)
- **Streaming**: No
- **Tools/Function calling**: No
- **Structured outputs**: No
- **API endpoint**: `https://api.openai.com/v1/chat/completions` (line 18)

#### Function: `callLLMWithRetry()`
- Wraps `callLLM()` with **1.5-second retry delay** (line 81)
- Silent fallback to empty content if both attempts fail (line 86)

#### Function: `generateReport()` — Orchestrates 1-3 LLM calls

**Free tier** (single call):
- Calls `buildCall1FreePrompt()` and passes system/user to `callLLMWithRetry()`
- Expected output: 3 sections (Type, Authority, Profile-teaser)

**Premium tier** (three parallel calls):
- Call 1: `buildCall1PremiumPrompt()` → 4 sections (Type, Authority, Profile, Work-rhythm)
- Call 2: `buildCall2Prompt()` → 3 sections (Decision-style, Positioning-offer, Client-dynamics)
- Call 3: `buildCall3Prompt()` → 2 sections (Visibility-sales, Next-30-days)
- Executed in parallel with `Promise.all()` (lines 157–161)

**Token tracking**:
- Returned from each `callLLM()` via `usage.prompt_tokens` and `usage.completion_tokens`
- Summed across all calls (lines 164–166)
- **Cost calculation**: gpt-4o-mini pricing hardcoded as `$0.15/1M input, $0.60/1M output` (line 169)

**When called**: POST `/me/report` or `/users/:id/report` (routes/report.ts:121-186)

### 1.3 Bodygraph Extraction (Vision-based Profile Parsing)

**File**: `backend/src/extraction-service.ts`

#### Function: `callOpenAI()` (internal helper)
- **Model**: `gpt-4o` (line 20) — **NOTE: Full GPT-4o, NOT mini**
- **Max tokens**: 4096 (line 550)
- **Temperature**: not set (default 1.0)
- **Streaming**: No
- **Tools/Function calling**: No
- **Structured outputs**: No — returns raw JSON string, then parsed

**When called**: POST `/api/extract-profile` (routes/extract.ts:13-68)

#### Two extraction paths:

**Path A: PDF files (preferred)**
- Detects PDF provider: MyHumanDesign or Genetic Matrix (lines 174–181)
- Extracts PDF text via pdfjs-dist (hd-pdf/pdf-text.ts)
- Parses text directly with provider-specific parsers (lines 611–619):
  - `parseGeneticMatrixText()` → extracts gates via regex
  - `parseMyHumanDesignText()` → extracts 26 gate.line pairs via regex
- Builds profile from gates, then merges HD summary (text parsing)
- **No LLM call for PDFs**

**Path B: Multiple files (text/image/PDF mix)**
- Calls LLM with `HD_PROMPT` (lines 39–88) to extract JSON
- Builds content parts via `buildFileParts()`:
  - Text files → plain text blocks (line 149)
  - PDFs → base64 with `data:application/pdf;base64,...` (line 157)
  - Images → base64 with `data:{mime};base64,...` and `detail: "high"` (line 165)
- Single `callOpenAI()` call (line 634)
- Parses returned JSON (line 635)
- Then calls `callOpenAI()` again with `MERGE_PROMPT` to normalize nulls (lines 643–645)

**Two LLM calls in Path B scenario** (lines 634, 643)

---

## 2. System Prompts

### 2.1 Chat/Agent System Prompt

**File**: `backend/src/agent-service.ts:45–149`
**Function**: `buildSystemPrompt(profile, transits, impact)`
**Dynamically assembled**: YES — context interpolated from user profile and transits

#### Structure (2,000+ tokens):

```
# Rol y objetivo
- AI Mentor unifying Human Design + real planetary transits + conscious marketing strategy
- Serves coaches, therapists, facilitators, wellness brands

# Instrucciones
## Filosofía
- Transit energy dictates when/what/how to communicate
- HD mechanics behind brand, leadership, business timing
- Ethical marketing: no manipulation, no artificial urgency

## Tono
- Elegant, elevated, direct
- Active sparring: flag if misaligned or wasting available energy
- Anchor every insight to specific gates/channels/centers
- Second person (vos/tú), warmth without complacency

## Reglas de datos
- Use ONLY real transits provided in <transits>
- If `impact` provided: use pre-computed impact data, don't recalculate
- When transit activates user's gate/channel/center: highlight and connect to communication/offer/brand energy
- When transit touches undefined center: mention conditioning potential and non-self avoidance

## Comportamiento de respuesta
- Specific question → direct answer, 3–8 sentences, integrate 3 layers (energy + design + strategy)
- Marketing/content/sales question → always from transit + design cross. No generic marketing.
- Weekly report → use exact output format specified

## Formato
- NO asterisks, markdown, or symbols
- No introductory text before first emoji in reports

# Contexto
<user_profile>: name, birth data (if available)
<human_design>: type, strategy, authority, profile, definition, incarnation_cross, not_self_theme, variable
<natal_channels>: user's defined channels
<personality_gates> / <design_gates>: activated gates with planet and line
<defined_centers> / <undefined_centers>: 9-center breakdown

<transits>: week range, calculated timestamp, planets with sign/degree/retrograde/hdGate/hdLine, activated_channels (collective)

<impact> (optional):
- personal_channels: user's gates + transiting planets completing channels
- conditioned_centers: undefined centers touched by transits
- reinforced_gates: user's gates hit by transits

# Formato de salida — Reporte semanal
7 exact sections with emojis (no text before first emoji):
1. 🔭 PANORAMA GENERAL
2. ⚡ ENERGÍA & CUERPO
3. 💼 TRABAJO & CREATIVIDAD
4. ❤️ VÍNCULOS & AMOR
5. 📣 COMUNICACIÓN & MARCA
6. 🧭 ESTRATEGIA DE LA SEMANA
7. ⚠️ PUNTOS DE ATENCIÓN

Rules:
- Min 3 substantive sentences per section
- 📣 must answer: what to communicate, tone, content type, sell/nurture/silence signal
- Every claim anchored to specific gate/channel/center from transits or design

# Recordatorio
Use ONLY provided transit[impact] data. Every insight must trace to concrete gates/channels/centers.
```

**Variable interpolation points**:
- Line 99: `name="${profile.name}"`
- Lines 100–108: Birth data, type, strategy, authority, profile, definition, incarnation cross, not-self theme, variable (with digestion, environment, sense)
- Lines 104–106: Channels, personality gates, design gates, defined/undefined centers
- Lines 112–127: Planet positions (name, sign, degree, retrograde, hdGate, hdLine), activated channels, impact data (personal channels, conditioned centers, reinforced gates)

**⚠️ NOTABLE**: el `intake` (business context) **NO se inyecta** en el system prompt del chat. Solo el HD profile + transits + impact.

### 2.2 Report Generation Prompts

**File**: `backend/src/report/prompts.ts`

#### Prompt 1: Free Tier (`buildCall1FreePrompt()`)

**System prompt** (lines 42–52):
```
Sos un experto en Diseño Humano. Responde EXCLUSIVAMENTE en español.

Tu tarea: generar 3 párrafos personalizados para un informe de Diseño Humano.

Párrafo 1 — TIPO: Conectá tipo con estrategia. Explicá cómo interactúa tipo específico con autoridad.
No repitas descripción genérica; personalizá con combinación única.

Párrafo 2 — AUTORIDAD: Explicá autoridad en contexto de tipo y perfil. Dá ejemplo práctico de uso.

Párrafo 3 — PERFIL (teaser): 2-3 oraciones conectando perfil con tipo y autoridad.
Insinuá continuación hacia trabajo, decisiones, posicionamiento. No des interpretación completa.

Formato: separar con "[SECTION]" en propia línea. Sin títulos, markdown, numeración.
Prosa directa en segunda persona (vos/tú). Tono: cálido pero directo, como mentor que te conoce.
```

**User message**: Profile block + optional intake block

#### Prompt 2: Premium Call 1 (`buildCall1PremiumPrompt()`)

**System** (lines 62–74):
```
Sos un mentor de negocio que usa Diseño Humano como marco de lectura aplicada. Responde EXCLUSIVAMENTE en español.

Tu tarea: generar 4 secciones. No hagas teoría separada; traducí diseño a decisiones, trabajo, uso práctico.

Sección 1 — TIPO: tipo + estrategia + autoridad operan juntos en práctica. Personalizá por perfil.

Sección 2 — AUTORIDAD: Cómo decide mejor esta persona, qué pasa al apurarse o decidir desde mente,
señales de claridad real. Si hay intake, conectá con situación.

Sección 3 — PERFIL: Interpretación aplicada. Cómo líneas afectan trabajo, vínculos profesionales,
forma de mostrarse. Si hay intake, conectá con desafíos y objetivos.

Sección 4 — CÓMO TRABAJÁS MEJOR: Diagnóstico sobre ritmo, sostenibilidad, sobreesfuerzo,
condiciones alineadas. Integrá definición, canales, variables solo si ayudan. Mentoría, no glosario.

Formato: [SECTION] separadas. Sin títulos, markdown. 3 párrafos breves cada una: diagnóstico,
aplicación, anti-patrón. Segunda persona. Tono: directo, cálido, específico.
```

#### Prompt 3: Premium Call 2 (`buildCall2Prompt()`)

**System** (lines 84–94):
```
Sos un mentor de negocio que usa Diseño Humano... Responde EXCLUSIVAMENTE en español.

Tu tarea: generar 3 secciones premium. Foco en negocio, oferta, clientes, toma de decisiones. No teoría.

Sección 1 — CÓMO DECIDIR SIN FORZARTE: timing, claridad, presión mal interpretada,
patrón común a decisiones equivocadas. Si hay intake, conectá con desafíos.

Sección 2 — DÓNDE ESTÁ TU MAYOR VALOR: dónde se expresa valor natural, qué problema/oferta calza,
cómo posicionarse. Podés usar perfil, canales, cruz si suman, pero aterrizá a negocio.

Sección 3 — CON QUIÉN SÍ, CON QUIÉN NO: dinámicas clientes, límites, red flags,
condiciones relación que cuidan energía y mejoran resultados. Centros abiertos, canales, sensibilidad.

Formato: [SECTION] separadas. Sin títulos, markdown. 3 párrafos breves: diagnóstico, aplicación,
anti-patrón. Segunda persona. Tono: claro, honesto, mentor.
```

#### Prompt 4: Premium Call 3 (`buildCall3Prompt()`)

**System** (lines 104–119):
```
Sos un mentor de negocio... Responde EXCLUSIVAMENTE en español.

Tu tarea: generar 2 secciones finales del informe premium.

Sección 1 — CÓMO TE CONVIENE COMUNICAR Y VENDER: traducí diseño a estilo visibilidad, contenido, venta.
Qué formatos/dinámicas favorecen, qué forma de comunicar fuerza. Si hay intake, conectá con actividad.

Sección 2 — PRÓXIMOS 30 DÍAS: síntesis breve de mentoring + acciones concretas. Incluir:
- 1 párrafo apertura
- línea exacta: "3 movimientos para hacer ahora"
- 3 bullets concretos
- línea exacta: "3 cosas para dejar de forzar"
- 3 bullets concretos
- línea exacta: "1 señal a observar este mes"
- 1 bullet concreto

Formato: [SECTION] separadas. Sin títulos extra, markdown complejo. Bullets con "-".
Segunda persona. Tono: claro, accionable, mentor.
```

### 2.3 Extraction Prompts

**File**: `backend/src/extraction-service.ts`

#### HD_PROMPT (lines 39–88)
Used for images, PDFs (Path B), or mixed file extraction. Spanish-only. JSON-only output expected. ~700 tokens.

#### MERGE_PROMPT (lines 90–130)
Normalizes multiple extraction results to single JSON, converts nulls to defaults.

---

## 3. Context Assembly

### 3.1 Chat Context

**File**: `backend/src/routes/chat.ts`

Flow (lines 37–115, 118–210):

1. **Resolve user**: From session (linked identity) → fetch user from DB → get `user.profile` (UserProfile) + `user.plan`
2. **Fetch transits**: `getTransitsCached()` (cached for current week)
3. **Compute impact**: `analyzeTransitImpact(transits, profile)` — deterministic, pre-computed (lines 92–95)
4. **Conversation history**: All prior messages passed as `messages` array in request
5. **Build system prompt**: `buildSystemPrompt(profile, transits, impact)` interpolates all three data sources
6. **Call agent**: `runAstralAgent()` or `runAstralAgentStream()` with messages + system prompt
7. **Persist**: `saveChatMessage()` stores last user message + full assistant response to SQLite `chat_messages` table

**Context shape sent to LLM**:
```
System prompt (2,000+ tokens):
  - User's HD profile (type, strategy, authority, gates, channels, defined/undefined centers)
  - Current week's transits (planets, signs, degrees, HD gates, retrograde status)
  - Pre-computed impact (personal channels, conditioned centers, reinforced gates)

User messages (conversation history):
  - All prior turns in session
  - Last user query
```

**Memory strategy**: Full conversation history (no summarization, no sliding window).

**⚠️ Intake del negocio** (`users.intake`) **NO está en el system prompt** del chat. Está disponible en DB pero `buildSystemPrompt()` no lo lee.

### 3.2 Report Generation Context

Flow:

1. **Fetch user profile**: `profile: UserProfile` con full HD data
2. **Fetch intake** (optional): `intake?: Intake` con `actividad`, `objetivos`, `desafios`
3. **Select prompts**: Based on tier (free vs premium)
4. **Build profile block**: `profileBlock(profile)` (lines 15–35 in prompts.ts)
5. **Build intake block**: `intakeBlock(intake)` (lines 6–12) — solo si tiene contenido
6. **Call LLM**: 1 (free) o 3 (premium) prompts en paralelo
7. **Parse output**: Split por `[SECTION]` marker, después `---`, después `\n\n` (fallback)
8. **Map to sections**: 10 sections per `SECTION_META`, populate with LLM output
9. **Track tokens**: Sum across all calls
10. **Calculate cost**: `$0.15/1M input + $0.60/1M output` hardcoded
11. **Persist**: Save to DB con profile hash (cache key)

**Transits in reports**: NOT used. Report es static HD analysis + business context, no time-dependent.

### 3.3 Extraction Context

#### PDF Path (preferred):
No LLM. Direct text extraction + regex parsing.

#### Multi-file Path:
1. Build content parts from assets (text, image, PDF base64)
2. **First call**: `callOpenAI(HD_PROMPT, parts)` con todos los archivos en single message
3. Parse JSON: Extract `UserProfile` JSON
4. **Second call**: `callOpenAI(MERGE_PROMPT, [extractions])` para normalizar nulls
5. Validate: `deriveChannelsAndCenters()` valida gates y deriva canales/centros implícitos

**No conversation history**: Each extraction es single-shot.

---

## 4. Report Generation Flow (Complete Pipeline)

### Route: POST `/me/report` o `/users/:id/report`

1. **Resolve user**: De sesión, obtener userId
2. **Load user**: Verificar plan, verificar tier permitido (free → free tier only)
3. **Compute profile hash**: `computeProfileHash(profile, intake)` SHA-256
4. **Check cache**: Si cached + hash matches, return cached
5. **Cooldown check**: 30-segundo mínimo entre generations per user
6. **Call generator**: `generateReport(profile, tier, openaiKey, intake)`
7. **Save report**: INSERT a `hd_reports`, después UPDATE con content
8. **Return**: `{ ...report, id, userId, createdAt }`

### Otras rutas de report
- `GET /me/report?tier=free|premium` — load cached
- `GET /me/report/pdf?tier=free|premium` — render PDF via `@react-pdf/renderer`
- `POST /me/report/share` — create share token (7-day expiry)
- `GET /report/shared/:token` — validate + render PDF

---

## 5. Chat Flow (Complete Pipeline)

### POST `/chat` (non-streaming)

1. Parse body: `{ profile?, userId?, messages }`
2. Resolve user: sesión o direct profile
3. Fetch transits: via `getTransitsCached()`
4. Compute impact: `analyzeTransitImpact(transits, profile)`
5. Call agent: `runAstralAgent(...)` con system prompt + messages
6. Persist messages: save user msg + assistant response a `chat_messages`
7. Return: `{ reply, transits_used, userMsgId, assistantMsgId }`

### POST `/chat/stream` (SSE)

1. Same setup
2. `runAstralAgentStream(...)` async generator
3. Cada chunk: `data: {"content":"chunk"}\n\n`
4. Accumulate while streaming to client
5. Persist messages después del stream
6. Send done event con metadata

### Otras rutas
- `GET /me/messages` — fetch chat history
- `DELETE /me/messages?fromId=N` — truncate desde message ID

---

## 6. Extraction Flow (Complete Pipeline)

### POST `/api/extract-profile`

1. Parse body: `{ assetIds: string[] }`
2. Resolve user
3. Fetch assets de DB
4. Choose extraction path:
   - **Path A: Single HD PDF** → text + regex (no LLM)
   - **Path B: Multi-file** → 2× LLM calls (extract + merge)
5. Return: `{ profile }`

---

## 7. Transit-to-LLM Bridge

**File**: `backend/src/transit-service.ts`

### Function: `analyzeTransitImpact(transits, hdProfile)`

**Deterministic computation** (NOT LLM-based):

1. Input: Current week's transit positions + user's activated gates + defined centers
2. Gate mapping: Build map of transit gates → transiting planets
3. **Four impact types**:
   - **Reinforced gates**: Transit gate ∈ user's gates → amplificación personal directa
   - **Personal channels**: User has gate A, transit has gate B, A-B is a channel → transit completing user's channel
   - **Conditioned centers**: Transit hits undefined center's gate → conditioning temporal
   - **Educational channels**: Both gates in transit (neither in user) → collective learning opportunity
4. Output: `TransitImpact` object con arrays
5. Passed to LLM en system prompt como `<impact>` block

**LLM's role**: Interpret pre-computed impact data. LLM does NOT recalculate; reads facts.

**🟢 Esto es un asset arquitectónico crítico que el research de mercado validó (Co-Star, CHANI patterns).**

---

## 8. Existing Specs en `docs/`

- `docs/human-design-reference.md`: HD mechanics reference
- `docs/hd-transit-refactor-spec.md`: Spec de transit refactor
- `docs/freemium-spec.md`: Quotas y tier model
- `docs/premium-report-v2-spec.md`: Spec del premium report
- `docs/qa-agent-prompt.md`: QA insights
- `docs/qa-report.md`: QA findings
- `docs/uat-test-plan.md` + `docs/uat-coverage-audit.md`: Coverage UAT
- `docs/r2-setup.md`: Setup de R2 storage
- `docs/report-architecture-deliberation.md`: Architecture decisions report

System prompts son **inline en código**, no separados en disco.

---

## 9. Observability & Evals

### Logging
- **Token usage**: Captured from OpenAI response, stored in DB (reports only)
- **Cost tracking**: Calculated and stored with reports
- **Error logging**: Via Fastify logger
- **Retry logging**: `console.error` on LLM failures

### Testing
- **No prompt evals found**
- **No LLM output validation**
- **Manual validation**: User feedback loop only

### Monitoring
- **Degraded mode flag**: Si algún LLM call en premium report retorna empty
- **No cost budgets**: Solo tracked
- **Rate limiting**: Solo 30-segundo cooldown en report generation

---

## 10. Tooling in Place

### SDK & Libraries
- **OpenAI**: Native `fetch()` to OpenAI API, no SDK (raw HTTP)
- **Fastify**: v5.3.2
- **TypeScript**: v5.8.3 (strict mode)
- **Testing**: vitest v4.1.2 (no active LLM tests)
- **PDF extraction**: pdfjs-dist v4.0.379
- **PDF rendering**: @react-pdf/renderer v4.3.2
- **Ephemeris**: swisseph-wasm v0.0.4

### No external orchestration
- No LangChain, LlamaIndex, semantic kernel
- No Anthropic SDK (OpenAI only)
- No vector DB or RAG

---

## Summary Metrics

| Dimensión | Valor |
|---|---|
| **LLM callsites** | 5 (chat agent, report gen, extraction) |
| **Models in use** | gpt-4o-mini (chat, reports), gpt-4o (extraction) |
| **Max tokens (chat/stream)** | 4096 |
| **Max tokens (report)** | 2048 |
| **Max tokens (extraction)** | 4096 |
| **System prompts** | 5 (agent, 4 report variants) |
| **System prompt lines** | ~150 (agent), ~90 (prompts.ts) |
| **Context assembly points** | 3 (chat, report, extraction) |
| **Data sources fed to LLM** | HD profile, transits, business intake (solo reports), conversation history |
| **Deterministic preprocessing** | Transit impact analysis (4 types) |
| **Output parsing strategies** | [SECTION] markers, --- separators, JSON parsing, regex |
| **Token tracking** | Reports only |
| **Cost tracking** | gpt-4o-mini hardcoded pricing only |
| **Retry strategy** | 1 retry con 1.5s delay (reports); none para chat/extraction |
| **Streaming** | Chat only (SSE) |
| **Conversation memory** | Full history, no summarization |
| **Observability** | Logging only; no evals, no automated validation |

---

## Critical Design Points (interpretación)

1. **Two models**: gpt-4o-mini para chat/reports (cheap, sufficient quality); gpt-4o para extraction vision

2. **System prompt strategy**: Single dynamic prompt para chat; separate prompts per report tier/call

3. **Deterministic vs. LLM**:
   - **Deterministic**: Transit impact analysis (4 tipos computed antes del LLM)
   - **LLM-interpreted**: El impact data en sí (LLM no recalcula, solo traduce a advice)

4. **Output parsing**: Multi-fallback (`[SECTION]` → `---` → `\n\n`)

5. **Report tiers**: Free (1 call, 3 sections) vs. Premium (3 parallel calls, 10 sections)

6. **Extraction paths**: PDF parsing (no LLM) preferred; fallback a Vision para mixed files

7. **Memory**: Chat usa full conversation history (no sliding window)

8. **Persistence**: Solo reports trackean tokens + cost; chat no

9. **Language**: Spanish-only prompts; todas las responses esperadas en español

10. **No tools/functions**: Pure text generation, no function calling, no structured outputs

---

## Gaps identificados (referenciados desde `05-plan.md`)

- **Intake del negocio NO está en chat** ← Sprint 1 lo arregla
- **No memory entre sesiones** ← Sprint 2
- **Conversation history sin límite** ← Sprint 2 (con memory) o futuro
- **No prompt caching** ← Sprint 4
- **No evals** ← Sprint 3
- **No anti-sycophancy explícito** ← Sprint 4
- **Premium report: 3 calls sin coherencia entre secciones** ← Sprint 6
- **No tracking cost/tokens en chat** ← Sprint 1
- **`[SECTION]` parsing frágil** ← Sprint 6
