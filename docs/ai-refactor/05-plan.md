# Astral AI Refactor — Plan

**Fecha**: 2026-04-26
**Status**: aprobado por owner. Sprint 0 cerrado (este doc + `00-product-position.md`). Sprint 1 = next.

> Este plan se construyó cruzando el mapeo del estado actual del código (`01-current-state-audit.md`) con investigación de mercado (`02-`, `03-`, `04-`). Las secciones de research dejan citas inline a sus fuentes; este plan resume las decisiones, no repite la evidencia.

## Estado actual — auditoría sintetizada

### 🟢 Lo que ya está bien (no romper)

| # | Fortaleza | Por qué importa |
|---|---|---|
| 1 | `analyzeTransitImpact()` es deterministic (`backend/src/transit-service.ts`) | Co-Star/CHANI confirman: el LLM **nunca debe** calcular la carta. Astral ya lo hace. **Lean into it.** |
| 2 | Estructura del profile rica (type, channels, gates, centers, variable, intake) | Material crudo para personalización real. |
| 3 | Spanish-only consistency + streaming SSE en chat | UX foundations OK. |
| 4 | `buildSystemPrompt()` es pure-functional | Refactor-friendly. |
| 5 | Premium report con 3 calls paralelos para sub-tipos de contenido | Estructura correcta, falta capa de coherencia. |

### 🔴 Gaps críticos — en orden de impacto sobre "se siente personal vs se siente ChatGPT"

| # | Gap | Evidencia |
|---|---|---|
| 1 | **Intake del negocio NO se inyecta en chat** — el user llena 10 min de contexto y el chat no lo ve | El intake vive en `users.intake`, pero `agent-service.ts:buildSystemPrompt()` no lo lee. Sera vs Wysa/Woebot: la diferencia entre "lo borro" y "me quedo" es memoria/contexto persistente. |
| 2 | **Cero memoria entre sesiones** | Mem0 + Karpathy LLM-wiki + Claude Memory feature = consenso: living-document pattern es el ganador a esta escala. Astral hoy = stateless. |
| 3 | **Conversation history sin límite** → context rot inevitable | Chroma "Context Rot" (2025): degradación medible empieza a 1k–32k tokens en TODOS los frontier models. Astral hoy mete toda la history. |
| 4 | **System prompt sin estructura cache-friendly** | Manus: "KV-cache hit rate is the single most important metric" — 10× ahorro en Sonnet con prefijos estables. Astral no usa caching. |
| 5 | **gpt-4o-mini para advisor chat** | 2025-2026 comparisons unánimes: Claude Sonnet 4.5 gana en tono, nuance, anti-sycophancy para advisor tasks. |
| 6 | **Observability básica + foundation de prompt evals — pero falta LLM-as-judge y application al pipeline real** | Existen `prompt-eval.ts`/`prompt-eval.test.ts` con 8 funciones puras (structure, format, grounding incluyendo anti-hallucination de gates). Pero solo cubren reports, no chat; corren contra fixtures, no output real; sin LLM-as-judge ni custom data viewer (Hamel methodology). Foundation para extender, no construir desde cero. |
| 7 | **System prompt sin disciplina anti-sycophancy** | npj Digital Medicine 2025: 100% compliance con misinformation en advisors sin guardrails. |
| 8 | **Premium report = 3 parallel calls sin coherencia entre secciones** | ACE paper (Oct 2025): Generator + Reflector + Curator beats single-shot por +10.6%. |
| 9 | **Cero tracking de cost/tokens en chat** | Cost blow-up es failure mode documentado. Astral hoy = invisible. |
| 10 | **`[SECTION]` parsing frágil para reports** | Native structured outputs eliminan toda esa clase de bugs. |

## Diferenciación competitiva (recordatorio)

- **HumanDesign.ai (Bella)**: GPT-4 wrapper con prompt library de 2,000 prompts. Sin moat de contenido.
- **Próxima amenaza**: humandesign.io oficial con corpus de 2,500 horas de Ra Uru Hu (rights propietarios).
- **Posición ganable Astral**: NO competir en "autoridad HD" (perdés vs Jovian Archive). Doblar la apuesta en **"advisor de negocio holístico para emprendedores con sensibilidad woo"**. Hueco vacante a escala según research (Coachvox, Pi, Replika ocupan otros espacios).

Ver `00-product-position.md` para el detalle de esa decisión.

## Principios de diseño (no negociables)

1. **El LLM nunca calcula HD/astro** — solo narra datos pre-computados. (Ya está; reforzar con tools en P4.)
2. **KV-cache discipline**: prefijos estables, sin timestamps en prompts, append-only context.
3. **Memory como feature** — el advisor "te conoce" sesión a sesión. Living document por user.
4. **Eval-first** — todo cambio de prompt pasa por harness antes de prod.
5. **Right-altitude prompts** (Anthropic) — prompts más cortos, ejemplos canónicos no exhaustivos.
6. **Modelo donde importa** — Claude para advisor chat, gpt-4o para vision, Haiku/mini para clasificación.
7. **Single-agent default** — multi-agent solo donde el research muestra ROI (Editor loop en reports).
8. **Reversible by feature flag** — cada cambio user-facing detrás de un flag. Si tanquea métricas (👍/👎 ratio, eval pass-rate, retention), rollback es 1 línea de config, no un revert. Aplica especial a: P2.3 anti-sycophancy persona (riesgo de churn), P3.1 migración Sonnet (riesgo de costo + behavior shift), P3.2 structured outputs (riesgo de break en PDF rendering).

## Plan en fases

### 🔥 P1 — Wins inmediatos (~1-2 semanas, alto impacto user-facing)

**P1.1 Inyectar intake en chat system prompt**
- Cambio chico (~10 líneas en `buildSystemPrompt`).
- Agregar sección `<business_context>` con `actividad`, `objetivos`, `desafios`.
- Resultado: el advisor sabe lo que hace tu cliente, sus desafíos, sus objetivos.
- **Mayor mover de aguja en "feels personal" hoy mismo.**

**P1.2 Persistent memory layer (Living Document)**
- Agregar `user_memory` (tabla nueva o columna `users.memory_md TEXT`).
- Patrón Mem0: en cada N mensajes, LLM cheap (Haiku o gpt-4o-mini con prompt corto) extrae facts y los integra al markdown vía operaciones ADD/UPDATE/DELETE/NOOP.
- En cada chat turn, el markdown completo va al system prompt (cacheable).
- **Feature que más diferencia vs ChatGPT.** Mata el "tengo que re-explicarme cada vez".

**P1.3 Observability básica**
- Trackear tokens + cost per chat message (no solo reports).
- Botón 👍/👎 en respuestas de chat (ya existe `frontend-asset-errors` test pattern, similar UI).
- Logging estructurado de cada LLM call: model, tokens_in/out, cost_usd, latency_ms, user_id, session_id, prompt_hash.
- Pre-requisito para todo lo que viene.

### 🟢 P2 — Calidad y disciplina (~1-2 semanas)

**P2.1 Eval harness — EXTENDER el existente, no crear desde cero**

> **Foundation existente** (`backend/src/__tests__/prompt-eval.ts` + `prompt-eval.test.ts`): 8 eval functions puras que cubren structure (7 secciones, orden, no-pre-text, min sentences), format (no-markdown, español heurístico) y grounding (mentions gates, **no-hallucinated-gates**, mentions centers). Solo aplican a output de reports, no a chat. Solo corren contra fixtures, no contra output real.

Lo que falta agregar (en orden):
- **Aplicar evals existentes al pipeline real** — correr `runEvals()` sobre cada report generado en prod, loggear pass/fail, alertar en degradación.
- **Extender evals a chat output** — sin estructura de 7 secciones, foco en grounding (mentions gates/centers/canales del user) + no-hallucinated-gates + uso del intake.
- **Custom data viewer** (extender admin panel existente) — ver cada conversación con: input completo, system prompt, output, eval results, 👍/👎 user.
- **30 conversaciones de seed con label binario** (good/bad) + critique en texto libre. Punto de partida para training de juez.
- **LLM-as-judge con rúbricas** (capa nueva sobre las puras):
  - ¿está groundeado en gates/centros específicos del user?
  - ¿usa el intake del negocio?
  - ¿es específico o genérico?
  - ¿hay sycophancy?
  - ¿se inventa atributos del user?
- **Target**: judge-vs-human alignment >90%.
- **Estilo**: binary + critique, no scale 1-5 (Hamel).

**P2.2 KV-cache discipline + prompt caching**
- Reordenar `buildSystemPrompt`:
  - **Prefijo estable**: rol + principios + profile (cacheable).
  - **Sufijo dinámico**: transits semana + memory + mensaje actual.
- Eliminar todo timestamp del prompt.
- Activar OpenAI prompt caching (gratis al pasar 1024 tokens, ya estamos arriba).
- Si después migramos a Anthropic (P3.1), explicit caching con cache_control breakpoints.

**P2.3 Anti-sycophancy + persona afilado**
- Reescribir system prompt usando Constitutional AI principles.
- Reglas explícitas:
  - "Discrepá si el plan del user no aprovecha su diseño."
  - "No validés ideas genéricas."
  - "Señalá inconsistencias entre objetivo declarado y patrón de comportamiento."
- Remover lenguaje vago tipo "te acompaño en…" → reemplazar con "tu Manifesting Generator con autoridad sacral acá necesita…".
- Test: pedirle al advisor algo objetivamente malo y ver si lo señala.

### 🟡 P3 — Arquitectura (~2-3 semanas)

**P3.0 (precondition) — Retry/fallback strategy para chat**
- Hoy si OpenAI cae, chat se rompe. Antes de migrar de modelo, necesitamos circuit breaker + fallback.
- Patrón: retry exponencial 2x, después fallback a modelo backup.

**P3.1 Migración a Claude Sonnet 4.5 para chat (con A/B + eval)**
- Agregar Anthropic SDK.
- Feature flag: porcentaje de chats van a Claude vs gpt-4o-mini.
- Comparar via eval harness (P2.1) + 👍/👎 ratio.
- Decisión a 2 semanas con datos.
- ⚠️ Riesgo de costo: ~10× el precio nominal vs gpt-4o-mini ($3/M vs $0.15/M). Con prompt caching baja a ~3-5×. **Solo migrar si el eval dice que el lift en quality justifica el costo.**

**P3.2 Structured outputs para reports**
- Reemplazar `[SECTION]` parsing por JSON schema nativo (OpenAI structured outputs / Anthropic tool use as schema).
- Migrar el rendering de PDF → input es JSON validado.
- Feature flag + dual-mode parsing por al menos 2 semanas.
- Elimina toda la clase de bugs "el LLM olvidó el separador".

**P3.3 Editor loop (Generator + Critic) en premium reports**
- Después de los 3 calls paralelos, un Critic-LLM revisa:
  - Coherencia de tono entre secciones
  - Factualidad respecto a profile/intake
  - Ausencia de contradicciones
  - Specificidad (no genérico)
- Si critic señala issues, regenera la sección.
- ACE paper: +10.6% pero agrega 1 LLM call extra por report. ROI alto en quality, costo manejable porque reports son baja frecuencia.

### 🔵 P4 — Optimización avanzada (cuando haya volumen real)

**P4.1 Model routing por task**
- Classifier (Haiku) detecta tipo de query: "estrategia / copy / decisión / reflexión / pregunta sobre HD".
- Routea: estrategia/copy → Sonnet (necesita reasoning), pregunta HD → 4o-mini con tool calls.

**P4.2 Tool calling para fact lookup**
- `lookup_hd_gate(N)`: retorna info estructurada del gate.
- `lookup_user_recent_decisions()`: lee de chat_messages + memory.
- `lookup_transit_for_date(date)`: retorna impacto deterministic.
- LLM pide facts en vez de stuffearlas todas.

**P4.3 Curated prompt library (business-flavored)**
- 30-50 prompts iniciales tipo HumanDesign.ai pero **business-flavored**:
  - "¿Cómo posiciono mi servicio según mi diseño?"
  - "¿Qué energía aprovecho esta semana para vender?"
  - "¿Cuándo es mi ventana de comunicación esta semana?"
- Suggested-questions en la UI guían al user a queries donde el AI performa fuerte.

**P4.4 Background memory consolidation**
- Worker async: cada N horas pasa por user_memory y refactoriza/dedup.
- Sleep-time compute (Letta pattern). Saca el costo del critical path del user.

## Lo que NO voy a hacer (deliberado)

| Decisión | Por qué |
|---|---|
| Multi-agent para chat | Anthropic: 15× tokens. UIUC study: 4-220× tokens. Single-agent default per research. |
| Vector DB / RAG sobre data del user | Karpathy + Claude Memory: a <100k tokens, in-context wins, RAG es overhead. |
| LangGraph/CrewAI/AutoGen | Escala actual no lo justifica. Mastra (TS) opcional cuando crezca, no ya. |
| Few-shot examples en prompts | Manus: drift, overgeneralization, hallucination. |
| Memoria mediante "summary del chat" | Brevity bias documentado en ACE paper — pierde detalle. Better: structured living document (P1.2). |
| Migrar de OpenAI a Anthropic sin A/B | Cambio de modelo a ciegas = riesgo. Eval primero (P2.1), después decidir (P3.1). |

## Auto-audit del plan — blind spots y ajustes

Reviso críticamente antes de ejecutar.

### Blind spots encontrados y corregidos

1. **Cost shift de migrar a Claude**: ~10× precio nominal. Con caching baja, pero sigue siendo decisión de costo. **Ajuste**: P3.1 condicionado a P2.1 eval funcional + decisión cuantitativa.

2. **A/B testing con N=1 user**: imposible. **Ajuste**: shadow mode (corre nuevo prompt en paralelo, comparamos offline en eval set). A/B real cuando N>30.

3. **Retry/fallback strategy**: omitido. **Ajuste**: agregado P3.0 como precondition de P3.1.

4. **Migración de reports existentes** si cambia JSON schema en P3.2: feature flag + dual-mode parsing por 2 semanas mínimo.

5. **Documentación de decisiones**: este pack `docs/ai-refactor/` cubre. Cualquier decisión nueva debe escribirse acá o en spec separada.

6. **Intake conversacional vs estático**: hoy es form. Research sugiere intake conversacional (Sera, Hume EVI). **Ajuste**: P1.1 inyecta el static intake. Fase futura (no priorizada): conversational intake con memory layer ya operativo.

7. **Riesgo humandesign.io**: si Astral compitiera en autoridad HD, perdía. Por eso `00-product-position.md` afila la posición a "advisor de negocio con HD lens".

8. **Sycophancy backlash**: P2.3 podría alienar users que disfrutan validación. Mitigación: medir 👍/👎 antes y después; ajustar dosis si churn sube.

### Lo que el plan NO cubre (gaps consciously deferred)

**Engineering / técnico:**
- Conversational intake (form → conversation). Defer hasta P1.2 (memory) operativo.
- Multilingual chat (hoy solo español). No prioritario.
- Voice input/output (no en producto hoy, defer).
- Mobile-specific UX (responsive existe, deeper UX defer).
- Public API para coaches de Daniela (defer).
- Hume EVI `chat_id` / `chat_group_id` pattern para session boundaries explícitos (hoy todo en un solo log; pattern útil cuando el producto crezca).

**Product / negocio (mencionados como ganadores en research, defer hasta tener tracción real):**
- **Bundled content / "staff writers" curado** (CHANI/Pattern pattern): contenido escrito por humanos junto al AI. Para Astral: contenido escrito por Daniela bundleado con el chat. Decisión de producto, no engineering.
- **Live-human escalation** (Sanctuary pattern): al pasar plan premium, opción de booking de sesión 1:1 con Daniela. Upsell natural y retiene users que el AI no puede ayudar.
- **Daily push-notification habit anchor** (Co-Star pattern): hoy Astral es weekly. Daily check-in con transit-light para crear hábito. Trade-off: agrega latency operativa y push fatigue risk.
- **Marketplace de prompts comunitario** (HDAI tiene): users pueden compartir prompts de "preguntas que les funcionaron". Network effect. Defer hasta N>100 users.

## Sprints de ejecución

| Sprint | Foco | Entregables | Pre-requisitos |
|---|---|---|---|
| **Sprint 0** | Posicionamiento + knowledge pack | Este doc + `00-product-position.md` + carpeta `docs/ai-refactor/` | — |
| **Sprint 1** | P1.1 + P1.3 | Intake en chat + tracking cost/tokens + 👍👎 UI | Sprint 0 |
| **Sprint 2** | P1.2 (memory) | Living document layer + writeback automático | Sprint 1 (necesita observability para medir) |
| **Sprint 3** | P2.1 (evals) | Aplicar `prompt-eval.ts` existente al pipeline real + extender a chat + custom data viewer + 30 seed conversations + LLM-as-judge harness | Sprint 1 (necesita data tracked). Foundation existente: `prompt-eval.ts` con 8 functions estructurales/grounding. |
| **Sprint 4** | P2.2 + P2.3 | KV-cache discipline + anti-sycophancy persona | Sprint 3 (cambios de prompt pasan por evals) |
| **Sprint 5** | P3.0 + P3.1 | Retry/fallback + migración Sonnet con A/B/shadow | Sprint 3 |
| **Sprint 6+** | P3.2, P3.3, P4 | Structured outputs, editor loop, model routing, tools, prompt library | Según necesidad |

## Definición de "done" para Sprint 1

(Ejemplo de granularidad — el agente que ejecute Sprint 1 debe dejar este checklist verde)

- [ ] `buildSystemPrompt()` lee `intake` del profile y lo inyecta en sección `<business_context>`
- [ ] Test integración: chat con intake setteado refleja contexto en respuesta (eval manual con 3-5 inputs).
- [ ] Tabla `llm_calls` o columnas en `chat_messages` con: model, tokens_in, tokens_out, cost_usd, latency_ms, prompt_hash.
- [ ] Endpoint `POST /api/messages/:id/feedback` con body `{ thumb: 'up' | 'down', note?: string }`.
- [ ] UI: botones 👍/👎 sobre cada mensaje del assistant en chat.
- [ ] Admin panel: muestra cost/token total per user para últimos 7 días.
- [ ] Tests pasan, TS compila, deploy verde en Render.

## Notas finales

- Este plan es un mapa, no una contracta rígida. Si en Sprint N descubrimos algo, ajustamos `05-plan.md` (este doc) y avisamos en commit.
- Cada sprint cierra con un commit que incluye: código + tests + actualización de este doc si la prioridad cambió.
- Para retomar este trabajo en otra sesión: ver `README.md` con prompt literal para iniciar contexto.
