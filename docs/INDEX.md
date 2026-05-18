# Índice de documentación — Astral

> Si querés interiorizarte del proyecto, leé en este orden.
> Si buscás algo puntual, usá el índice por categoría.

---

## 🚀 Empezar acá

Si entrás al proyecto por primera vez (humano o AI agent):

1. **[`/Users/brmontero/astral/AGENTS.md`](../AGENTS.md)** — fuente de verdad para AI agents (reglas Astral, skills, workflow, prohibiciones).
2. **[`architecture/project-overview.md`](architecture/project-overview.md)** — stack, estructura del repo, flujo de datos, API, decisiones técnicas, layout crítico.
3. **[`architecture/chat-llm-system.md`](architecture/chat-llm-system.md)** — cómo funciona la capa de IA *hoy* (diagrama ASCII + capas).
4. **[`human-design-reference.md`](human-design-reference.md)** — referencia técnica HD (puertas, canales, centros, tránsitos).

---

## 📐 Arquitectura

| Doc | Qué tiene |
|---|---|
| [`architecture/project-overview.md`](architecture/project-overview.md) | Stack, estructura del repo, flujo de datos, API endpoints, decisiones técnicas, layout crítico del frontend, design system. **Punto de entrada técnico para el proyecto**. |
| [`architecture/chat-llm-system.md`](architecture/chat-llm-system.md) | Diagrama del flujo turn-by-turn del chat con LLM, capas de abstracción, comparación con industria 2026. **Lectura obligada para PM o engineer que toca AI**. |
| [`architecture/refactor-2026-05-decisions.md`](architecture/refactor-2026-05-decisions.md) | Decisiones técnicas del refactor AI (mayo 2026): por qué tools y no post-validator, por qué Vercel AI SDK, por qué mini y no 4o. |
| [`architecture/bug-investigation-daniela-2026-05.md`](architecture/bug-investigation-daniela-2026-05.md) | Caso real que motivó el refactor: profile contaminado, file_type natal vs hd, root cause analysis. |

---

## 🔬 Investigación de industria — mayo 2026

Reports de sub-agents que investigaron contra docs oficiales (Anthropic, OpenAI, Mem0, Vercel) y blogs técnicos. Cada uno responde una pregunta operativa concreta.

| Doc | Pregunta que responde |
|---|---|
| [`research/2026-05-context-engineering-best-practices.md`](research/2026-05-context-engineering-best-practices.md) | ¿Estamos estructurando bien el system prompt para activar prompt caching? Layered context, lost-in-the-middle. |
| [`research/2026-05-conversational-memory-patterns.md`](research/2026-05-conversational-memory-patterns.md) | ¿Cómo gestionar historial sin gastar tokens al pedo? Mem0, sliding window, threads, RAG. |
| [`research/2026-05-agentic-patterns-tool-use.md`](research/2026-05-agentic-patterns-tool-use.md) | ¿Cómo evitar alucinaciones por diseño? Tool use, structured outputs, SDKs comparados. |
| [`research/2026-05-openai-tiers-and-rate-limits.md`](research/2026-05-openai-tiers-and-rate-limits.md) | OpenAI tiers, TPM/RPM, batch API, prompt cache automático, Tier 1 vs Tier 5. |
| [`research/2026-05-fallback-patterns-industry.md`](research/2026-05-fallback-patterns-industry.md) | ¿Cómo manejan rate limits y outages Cursor, Perplexity, Vercel AI? Multi-provider fallback chains. |
| [`research/2026-05-rate-limit-ux-patterns.md`](research/2026-05-rate-limit-ux-patterns.md) | ¿Cómo comunicar fallos al usuario sin frustrarlo? Mensajes textuales de ChatGPT, Claude, Cursor. |
| [`research/2026-05-cost-analysis-astral-beta.md`](research/2026-05-cost-analysis-astral-beta.md) | Costos proyectados para Astral a 10/100/1000 users, comparación 4o vs mini vs Claude. |

---

## 🎯 Specs y planes activos

| Doc | Qué es |
|---|---|
| [`chat-v2-rollout.md`](chat-v2-rollout.md) | Plan de roll-out del path v2 (Vercel AI SDK + tools). Criterios de cierre cuantitativos, queries SQL para telemetría. |
| [`hd-transit-refactor-spec.md`](hd-transit-refactor-spec.md) | Spec del refactor de tránsitos. |
| [`transits-time-selector-adr.md`](transits-time-selector-adr.md) | ADR: selector temporal de tránsitos (diario/semanal). |
| [`transits-time-selector-technical-plan.md`](transits-time-selector-technical-plan.md) | Plan técnico del selector temporal. |
| [`transits-time-selector-test-plan.md`](transits-time-selector-test-plan.md) | Plan de tests del selector temporal. |
| [`transits-relational-ux.md`](transits-relational-ux.md) | UX de tránsitos relacionales. |
| [`premium-report-v2-spec.md`](premium-report-v2-spec.md) | Spec del informe premium v2. |
| [`freemium-spec.md`](freemium-spec.md) | Spec del modelo freemium. |
| [`context-workspace-architecture.md`](context-workspace-architecture.md) | Arquitectura del context workspace. |
| [`context-workspace-e2e-plan.md`](context-workspace-e2e-plan.md) | Plan E2E del context workspace. |
| [`context-workspace-migration-plan.md`](context-workspace-migration-plan.md) | Plan de migración del context workspace. |
| [`context-workspace-ux.md`](context-workspace-ux.md) | UX del context workspace. |
| [`ux-refactor-plan-2026-05.md`](ux-refactor-plan-2026-05.md) | Plan de refactor UX 2026-05. |
| [`ux-audit-2026-05.md`](ux-audit-2026-05.md) | Auditoría UX 2026-05. |
| [`remote-mcp-architecture-proposal.md`](remote-mcp-architecture-proposal.md) | Propuesta de arquitectura para exponer Astral Guide como Remote MCP, con Slices 0-7 capturados. |
| [`remote-mcp-implementation-recon-plan.md`](remote-mcp-implementation-recon-plan.md) | Reconocimiento del codebase y slices para implementar Remote MCP sin romper chat/auth existentes; Slices 0-7 capturados. |
| [`remote-mcp-client-smoke-matrix.md`](remote-mcp-client-smoke-matrix.md) | Matriz de compatibilidad beta para clientes MCP reales (Claude Code, Codex, Cursor, ChatGPT, Gemini) capturada en Slice 6. |
| [`remote-mcp-oauth-connectors-genesis.md`](remote-mcp-oauth-connectors-genesis.md) | Genesis de la siguiente etapa: OAuth/discovery para conectar Astral MCP con Claude Desktop/Web y ChatGPT sin PAT manual. |

---

## 📚 Referencias técnicas

| Doc | Qué es |
|---|---|
| [`human-design-reference.md`](human-design-reference.md) | Tabla de 64 puertas + grados zodiacales, mapeo gate→center, 36 canales, jerarquía de planetas. |
| [`bodygraph-extraction-notes.md`](bodygraph-extraction-notes.md) | Notas sobre extracción de bodygraphs HD desde PDFs. |
| [`bodygraph-relacional.md`](bodygraph-relacional.md) | Bodygraph relacional (compatibilidad entre cartas). |
| [`competencia.md`](competencia.md) | Análisis de competencia (HumanDesign.ai, humandesign.io, etc). |
| [`r2-setup.md`](r2-setup.md) | Setup de Cloudflare R2 (storage de assets). |

---

## 🔐 Operaciones — auth, admin, runbooks

| Doc | Qué es |
|---|---|
| [`admin-invite-runbook.md`](admin-invite-runbook.md) | Cómo invitar usuarios premium/basic vía admin. |
| [`admin-auth-invite-handoff.md`](admin-auth-invite-handoff.md) | Handoff del flujo admin/auth invite. |
| [`codebase-recon-ux-refactor.md`](codebase-recon-ux-refactor.md) | Reconocimiento del codebase para el refactor UX. |

---

## ✅ QA, evaluación y testing

| Doc | Qué es |
|---|---|
| [`qa-agent-prompt.md`](qa-agent-prompt.md) | Prompt para el agente de QA. |
| [`qa-report.md`](qa-report.md) | Reportes de QA. |
| [`uat-coverage-audit.md`](uat-coverage-audit.md) | Auditoría de cobertura UAT. |
| [`uat-test-plan.md`](uat-test-plan.md) | Plan de tests UAT. |
| [`manual-eval-guion.md`](manual-eval-guion.md) | Guión de evaluación manual del chat. |

---

## 📦 AI refactor (knowledge pack)

Sub-directorio dedicado al refactor AI completo (precede al refactor 2026-05):

- [`ai-refactor/00-product-position.md`](ai-refactor/00-product-position.md) — posicionamiento del producto.
- [`ai-refactor/01-current-state-audit.md`](ai-refactor/01-current-state-audit.md) — auditoría del estado.
- [`ai-refactor/02-research-advisor-patterns.md`](ai-refactor/02-research-advisor-patterns.md) — research de patrones advisor.
- [`ai-refactor/03-research-context-engineering.md`](ai-refactor/03-research-context-engineering.md) — research context engineering (versión expandida).
- [`ai-refactor/04-research-holistic-competitors.md`](ai-refactor/04-research-holistic-competitors.md) — competidores holísticos.
- [`ai-refactor/05-plan.md`](ai-refactor/05-plan.md) — plan general del refactor.
- [`ai-refactor/README.md`](ai-refactor/README.md) — README del knowledge pack.

---

## 🏛️ Otros / históricos

- [`report-architecture-deliberation.md`](report-architecture-deliberation.md) — deliberación de arquitectura del informe.

---

## Convención de naming

- **`docs/architecture/`**: cómo funciona algo HOY. Update cuando el sistema cambia.
- **`docs/research/`**: snapshot de research externo. Inmutable después del primer commit (es histórico). Nombrar con fecha del research.
- **`docs/*.md`** (root): specs activos, planes, ADRs, referencias técnicas, runbooks operativos.

Para crear un doc nuevo, decidí primero: ¿describe la verdad de hoy (architecture)? ¿Es captura de research externo (research)? ¿O es un plan/spec/ADR (root)? Usá nombres explícitos: `<tema>-<fecha>.md` para research, `<tema>.md` para architecture / planes activos.
