# Patrones agénticos y tool use — 2026

**Investigación**: sub-agent multi-source (Anthropic tools docs, OpenAI function calling, Vercel AI SDK, Claude Agent SDK, blogs técnicos).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta "¿hay forma de evitar que el LLM alucine sin parchear el output después?"

---

## 1. Tool use / function calling en 2026

**Anthropic** propone tools como bloques con `name`, `description` y `input_schema` JSON. Principios clave:
- Single responsibility (una tool = una capability)
- Descripción rica (Claude decide *cuándo* llamarlas leyéndola)
- **Strict mode** (`strict: true`) para garantizar que el schema se respete

Costo fijo: 346 tokens del system prompt de tool use + tokens de cada definición + `tool_use` / `tool_result` blocks en cada turno.

**OpenAI** es similar: `strict: true` + JSON Schema garantiza conformidad. Recomienda **siempre habilitar strict** y validar params en código antes de ejecutar — los modelos pueden alucinar args.

**Para Astral (validar puerta-canal)**: la respuesta clara en 2026 es **tool deterministic**, no structured output, no post-validator. El LLM debe *poder consultar* la verdad antes de afirmar, no afirmar y validar después (eso ya requeriría reescribir). Tools como `findChannelByGates(a, b)` y `findChannelsByGate(g)` exponen tu data canónica como capability.

## 2. Structured outputs

Para chat conversacional puro (texto al humano), structured outputs **no aplica al texto final**. Sí aplica para pasos intermedios: clasificación de intent, extracción de entidades, o un esquema de "draft + citations". JSON mode quedó como legacy; el patrón moderno es **Zod schema → `zodResponseFormat` → strict json_schema**, runtime validation incluida.

## 3. Multi-step reasoning patterns

- **Extended thinking / interleaved thinking** (Anthropic): el modelo razona entre tool calls. Patrón "Think-Act-Think-Act". Costo: tokens de thinking. Útil para tareas complejas; **overkill para chat HD de respuesta corta**.
- **ReAct**: estándar de facto del agentic loop. Aplica solo si hay >1 tool y la decisión de cuál llamar no es trivial. En Astral, sí aplica (varios tools deterministas).
- **Reflection / self-critique**: 2-5x compute, +11pts en HumanEval. Recomendado solo cuando hay dinero o seguridad en juego.
- **Sub-agents (Planner/Generator/Evaluator)**: pattern de Anthropic Q2 2026 para tareas largas. Para Astral (un chat turn) es overkill.

## 4. SDKs

| SDK | Fit Astral |
|---|---|
| **Vercel AI SDK** | Mejor DX para chat en Node + streaming. Tools nativos, swap provider con 1 línea. **Elegido por Astral**. |
| **OpenAI Agents SDK** | Mínimo mental footprint, primer-party con gpt-4o-mini. Limita branching complejo. |
| **Claude Agent SDK** | Agent loop completo + MCP nativo. Sobreingeniería para un chat turn. |
| **LangGraph** | Grafos durables, time-travel. Para Astral es industrial. |

## 5. Comparativa de approaches para Astral

| Approach | Calidad | Costo extra | Complejidad |
|---|---|---|---|
| **A.** System prompt monolítico (pre-refactor) | Bajo — alucina canales | 0 | Baja |
| **B.** Mismo call + post-output validator regex | Medio — detecta pero no corrige | +1 pasada local | Baja |
| **C.** Tools deterministas + strict mode (**ELEGIDO**) | Alto — fuerza al LLM a citar data canónica | +346 tokens system + 1-3 tool roundtrips | Media |
| **D.** C + reflection pass | Muy alto | 2-3x | Alta |
| **E.** Multi-agent (classify→retrieve→generate→review) | Muy alto | 4-5x | Muy alta |

## 6. Costo & calidad

- Tools: ~346 tokens fijos + ~50-150 por tool definida. Cada tool call ~100-300 tokens roundtrip. Para gpt-4o-mini (~$0.15/M input, $0.60/M output), un chat turn con 3 tools sube de ~$0.0005 a ~$0.0015 — irrelevante.
- Reflection: duplica costo pero solo se justifica si hay un evaluator con buen "critic signal".

## 7. Patrones deprecated en 2026

- LangChain heavy chains/abstracciones (Speakeasy y otros lo marcan).
- Manual prompt chaining sin tool loop.
- JSON mode (`{type:"json_object"}`) — reemplazado por strict json_schema.
- Custom agents sin SDK cuando hay alternativa nativa.

## 8. Veredicto

**Approach C: tool use deterministas + Vercel AI SDK + Zod schemas. Adoptado por Astral en `agent-service-v2.ts`**.

Para Astral hoy:
1. ✅ Tools expuestas: `findChannelByGates`, `findChannelsByGate`, `findChannelById`, `getCenterForGate`, `listAllChannels`. Cada una con descripción rica.
2. ✅ **Strict mode** + Zod schemas en los inputs.
3. ✅ Mantenemos `gpt-4o-mini` (costo). El system prompt v2 deja de ser enciclopedia: pasa a ser "consultá los tools antes de afirmar canales/puertas".
4. ✅ Streaming nativo via Vercel AI SDK preservado.
5. ✅ Sin reflection ni sub-agents — el bug que motivó esto (alucinación 8 → 20-34) se resuelve dándole al LLM la verdad accesible, no revisándola después.

Esto ataca el root cause: antes el LLM *inferiá* relaciones gate-channel desde memoria; ahora las *consulta* contra la tabla canónica.

## Fuentes

- [Anthropic Tool use overview](https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/overview)
- [OpenAI Function calling](https://platform.openai.com/docs/guides/function-calling)
- [OpenAI Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs)
- [Anthropic Extended Thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Claude Agent SDK TS](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Vercel AI SDK vs alternatives 2026](https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide)
- [Speakeasy agent framework comparison](https://www.speakeasy.com/blog/ai-agent-framework-comparison)
- [Reflection pattern cost/benefit 2026 — Zylos](https://zylos.ai/research/2026-03-06-ai-agent-reflection-self-evaluation-patterns)
- [Structured Outputs vs Zod 2026](https://dev.to/whoffagents/openai-structured-outputs-vs-zod-which-to-use-for-llm-response-validation-in-2026-366m)
