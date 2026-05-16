# Memoria conversacional e historial — patrones 2026

**Investigación**: sub-agent multi-source (Anthropic memory tool, OpenAI Responses API, Mem0 papers, ChatGPT/Claude.ai behavior, benchmarks).
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta "¿estamos gastando tokens al pedo mandando historial completo?"

---

## 1. Patrones de historial en producción

| Patrón | Cómo funciona | Cuándo rompe | Costo relativo | Adopción real |
|---|---|---|---|---|
| **Full history** (Astral antes del refactor) | Manda todos los turns en cada call | ~20-30 turns / 10-30K tokens | Crece O(n²): cada turn re-envía todo lo anterior | Solo prototipos. OpenAI/Anthropic NO lo recomiendan |
| **Sliding window** (últimos N) | Mantiene últimos K mensajes verbatim | Pierde contexto temprano abruptamente | Constante, predecible | N=10-20 turns es lo típico en LangChain `ConversationBufferWindowMemory` |
| **Summarization rolling** | LLM condensa turns viejos | Pierde detalles si el prompt de resumen es débil | +1 LLM call extra cada N turns | Anthropic lo hace server-side ("compaction"); OpenAI lo hace en Responses API |
| **Hybrid summary+window** | Resumen de >N + últimos N literales | Pocos problemas. Es el patrón ganador | Bajo amortizado | **Default en producción** (ChatGPT, Claude.ai, Cursor) — típicamente resume >20 y conserva últimos 10 |
| **RAG sobre history** | Embedding de mensajes pasados, retrieve por similitud | Cuando el thread es enorme (cientos de turns) | Infra extra (vector store) | Character.ai, companions, asistentes long-lived. Sobrekill para Astral hoy |
| **Living document (Mem0/memory_md)** | Hechos estructurados en un doc | Si el writer alucina o pierde info | 1 LLM call por turn (puede ser cheap model) | Astral ya lo tiene. Mem0 reporta **−90% tokens** y +26% accuracy vs full-context |

**Veredicto oficial**:
- **OpenAI** recomienda **Responses API con `previous_response_id`** + **compaction** server-side. No quieren que mandes el historial completo.
- **Anthropic** combina **memory tool** (persistente, file-based) + **context compaction** automática al acercarse al límite. Es el patrón "hybrid summary+memory file" oficial.

## 2. Cómo lo hacen las apps mainstream

- **ChatGPT.com**: hechos extraídos en "Memory" (~33 facts típicos) + resumen breve del thread reciente. Cuando se llena el window, **trim los mensajes recientes, conservar el memory profile**. Es exactamente el patrón de Astral con `memory_md`.
- **Claude.ai**: 200K-1M window + "Generate memory from chat history" (opcional). Si el thread se llena, trim/resumen automático. Recomienda explícitamente "pedile a Claude que produzca un resumen estructurado antes de continuar" — 4K resumen de 40K thread ≈ 90% señal preservada.
- **Cursor**: window grande + RAG sobre código, no sobre history. La conversación es relativamente corta porque el contexto pesado es el code.
- **Character.ai**: memory box de ~400 chars + rolling window + pinned messages. No tiene true long-term memory; usuarios serios usan extensiones de terceros con vector DB.

## 3. Cost & latency en gpt-4o-mini para Astral

A $0.15/M input, **30 turns × 30K tokens = ~$0.0045/call** (estado pre-refactor con full history).

- Sin prompt caching el costo crece **cuadráticamente** con turns.
- **Prompt caching automático** en gpt-4o-mini (≥1024 tokens) da **−50% input** sobre tokens cacheados. System prompt + memory_md (estable) **deberían cachearse siempre** — ponerlos PRIMERO en el array de mensajes.
- Latencia: cada 10K tokens extras = +1-2s percibidos.

## 4. Mem0 / Letta / LangMem — quién usa qué

- **Mem0**: el ganador en benchmarks (LOCOMO 91.6, LongMemEval 93.4) y en adopción para "chats personalizados con un user". Living doc + extracción asíncrona. **Lo que Astral ya hace artesanalmente con `memory_md`**.
- **Letta** (ex-MemGPT): memoria jerárquica OS-style (core/recall/archival). Mejor para agentes con tareas largas, no chat personal. Overkill para Astral.
- **LangMem**: solo si ya vivís en LangChain. No es el caso.

## 5. Threads / segmentación

- ChatGPT y Claude.ai tienen **"New chat" manual** — no auto-detección. El research de NN/G confirma que usuarios mezclan tópicos en un mismo thread y eso es OK si la memoria está bien.
- **Auto-detection de cambio de tópico existe en papers** pero NO es producción mainstream. Daniela mezclando "luna nueva + HD + negocio" **no es el problema** mientras el `memory_md` capture los hechos clave.

## 6. Veredicto operativo para Astral (post-refactor)

**Hecho ya** (en este refactor):
1. ✅ Hybrid window: enviamos últimos **30 mensajes** verbatim + `memory_md` en system prompt. Cortamos todo lo anterior. A 10 users resuelve el problema por meses.
2. ✅ Prompt caching: system prompt + `memory_md` (semi-estable) al principio del array para activar OpenAI auto cache.
3. ✅ `memory_md` como single source of truth para hechos persistentes (nombre, tipo HD, negocio). Es Mem0 artesanal.

**NO hecho todavía** (decisiones justificadas):
- **Threads / `conversation_id`**: prematuro a 10 users. Daniela mezclando temas no degrada si el memory_md está bien. Re-evaluar a 100+ users o cuando alguien explícitamente lo pida.
- **RAG sobre history**: prematuro. Activarlo solo si una conversación cruza 100+ turns.
- **Migrar a Mem0/Letta**: no aporta a este tamaño. Implementación custom ya es el patrón correcto.
- **Compaction de history viejo** (en lugar de truncate duro): identificado como mejora pendiente. Trade-off entre `+1 LLM call` por turn vs preservar info de mensajes 31+. Pendiente de deliberación con sparring + architect.

**Cuándo introducir threads**: cuando un user típico llegue a >50 turns o cuando observes que el LLM confunde contextos a pesar del `memory_md`. UX = botón "Nueva conversación" manual, no auto-detection.

**Próximo bottleneck real**: la **calidad del memory_writer**, no el largo del historial. Si el writer pierde info importante, ningún patrón de history compensa.

## Fuentes

- [OpenAI conversation state guide](https://developers.openai.com/api/docs/guides/conversation-state)
- [OpenAI prompt caching](https://platform.openai.com/docs/guides/prompt-caching)
- [Anthropic memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic memory + compaction cookbook](https://platform.claude.com/cookbook/tool-use-memory-cookbook)
- [Mem0 paper (arXiv 2504.19413)](https://arxiv.org/abs/2504.19413)
- [Mem0 LLM chat history summarization guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025)
- [Mem0 vs OpenAI vs LangMem benchmarks](https://mem0.ai/blog/benchmarked-openai-memory-vs-langmem-vs-memgpt-vs-mem0-for-long-term-memory-here-s-how-they-stacked-up)
- [Best AI agent memory frameworks 2026 (Atlan)](https://atlan.com/know/best-ai-agent-memory-frameworks-2026/)
- [How ChatGPT memory works, reverse-engineered](https://llmrefs.com/blog/reverse-engineering-chatgpt-memory)
- [Character.AI: helping characters remember](https://blog.character.ai/helping-characters-remember-what-matters-most/)
- [Claude context window & memory management](https://www.datastudios.org/post/claude-ai-context-window-token-limits-context-persistence-conversation-length-and-memory-managem)
- [Claude Code context compaction deep dive](https://oldeucryptoboi.com/blog/context-compaction-deep-dive/)
- [LangChain context window management strategies](https://apxml.com/courses/langchain-production-llm/chapter-3-advanced-memory-management/context-window-management)
- [Recursively Summarizing for long-term dialogue memory (arXiv 2308.15022)](https://arxiv.org/html/2308.15022v3)
- [NN/G: 6 types of conversations with GenAI](https://www.nngroup.com/articles/AI-conversation-types/)
