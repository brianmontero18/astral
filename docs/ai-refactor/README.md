# Astral AI Refactor — Knowledge Pack

Carpeta-handoff para retomar el refactor de la capa de IA de Astral en una sesión nueva con contexto completo.

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `00-product-position.md` | Decisión estratégica: qué tipo de producto es Astral. Lee esto primero. |
| `01-current-state-audit.md` | Mapeo exhaustivo de la capa de IA actual del codebase (modelos, prompts, context assembly, observabilidad). Generado por sub-agente Explorer sobre el código real. |
| `02-research-advisor-patterns.md` | Investigación de mercado: cómo construyen su capa de IA Pi, Replika, Lindy, Manus, Anthropic, Character.AI, Mem0, Letta, Hume EVI, ChatGPT Memory, Co-Star. Patrones aplicables ranked por ROI. |
| `03-research-context-engineering.md` | State of the art Q4 2025 / Q1 2026 en context engineering: long-context vs RAG, structured outputs, multi-agent, memory architectures, model selection, evals, observability tooling. |
| `04-research-holistic-competitors.md` | Análisis competitivo del espacio holístico+IA: Co-Star, CHANI, The Pattern, Sanctuary, HumanDesign.ai, Bella, mental health AI verticals. Qué funciona vs qué no. |
| `05-plan.md` | Plan de refactor sintetizado: gaps críticos, principios de diseño, fases priorizadas, sprints, auto-audit, lo que NO se va a hacer. |
| `06-advisor-quality-audit.md` | Rúbrica cualitativa y mini corpus real/sanitizado para evitar respuestas genéricas tipo ChatGPT antes del rewrite de persona. |

## Cómo retomar en una sesión nueva de Claude

Pegale este prompt al iniciar la sesión:

```
Estoy retomando el refactor de la capa de IA de Astral Guide. La investigación
y el plan completo viven en docs/ai-refactor/ — léelos en este orden:

  1. docs/ai-refactor/00-product-position.md  (decisión estratégica)
  2. docs/ai-refactor/05-plan.md              (plan + sprints + auto-audit)
  3. docs/ai-refactor/06-advisor-quality-audit.md (rúbrica anti-respuesta genérica)
  4. docs/ai-refactor/01-current-state-audit.md (estado histórico del código)

Los archivos 02-04 son material de research de respaldo — consultá según
necesites. El plan ya cita los hallazgos relevantes inline. El doc 06 es la
fuente cualitativa para extender evals antes de tocar persona/prompt.

Varios sprints ya avanzaron. Antes de proponer cambios, leé el bead activo y
verificá el estado real con `bd show astral-y3c` + `bd ready`. No asumas que
Sprint 1 sigue siendo el próximo paso.

Importante: backend/src/__tests__/prompt-eval.ts ya tiene foundation de
evals (structure + grounding incluyendo anti-hallucination). Sprint 3 los
EXTIENDE, no los crea de cero. Leelo antes de planear el harness.
```

## Orden de ejecución (resumen, ver `05-plan.md` para detalle)

| Sprint | Foco | Estado |
|---|---|---|
| **Sprint 0** | Posicionamiento + este knowledge pack | ✅ done |
| **Sprint 1** | Intake en chat + observability + 👍👎 | ✅ done |
| Sprint 2 | Persistent memory layer (living document) | ✅ done |
| Sprint 3 | Eval harness (Hamel methodology) | pending |
| Sprint 4 | KV-cache discipline + anti-sycophancy persona | pending |
| Sprint 5 | Migration a Claude Sonnet 4.5 con A/B | ✅ done |
| Sprint 6+ | Structured outputs, Editor loop, model routing, tools, prompt library | pending |

## Notas para el agente que retome

- Chat usa el path canónico v2 (`backend/src/agent-service-v2.ts`) con Vercel AI SDK y modelo configurable por env.
- Reports/extracción/tránsitos viven en `backend/src/report/`, `backend/src/extraction-service.ts` y `backend/src/transit-service.ts`.
- `analyzeTransitImpact()` en `transit-service.ts` es deterministic — el LLM **no** calcula carta. Esto es un moat. **No romper.**
- Intake/memoria/profile ya forman parte del contexto de chat; antes de cambiarlo, verificá el assembler actual y sus tests.
- Tests tienen un stub R2 in-memory en `helpers.ts`. Las refactors de chat/agent deben mantener ese stub funcionando.
- El UAT plan está en `docs/uat-test-plan.md` — los contratos user-facing no cambian con este refactor. Lo que cambia es la arquitectura interna.
