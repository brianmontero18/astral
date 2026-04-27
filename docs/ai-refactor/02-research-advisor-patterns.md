# Market & Pattern Research — Personalized Advisor LLM Architectures

**Fecha**: 2026-04-26
**Generado por**: sub-agente general-purpose con WebSearch/WebFetch
**Scope**: cómo construyen su capa de IA productos comparables a Astral (advisor personalizado con context persistente)

---

## Executive Summary

1. **El "living document" pattern es mainstream y outperform vector RAG para personalización a small/medium scale.** Anthropic Claude Memory (CLAUDE.md hierarchy) y Andrej Karpathy's "LLM Knowledge Base" rechazan vector embeddings + RAG en favor de Markdown files editable maintained por el LLM mismo. Karpathy claims a ~100 articles / ~400k words esto es suficiente sin retrieval infrastructure.

2. **Mem0 es la memoria architecture más rigurosa publicada para production agents** — extract-then-consolidate pipeline (ADD/UPDATE/DELETE/NOOP operations) con published benchmarks: 91.6 en LoCoMo, 26% improvement sobre OpenAI's memory, 91% lower p95 latency, 90% lower token cost. Worth treating as reference design.

3. **El blog de context engineering de Manus es el single piece más actionable de public engineering writing para advisor-style agents.** KV-cache hit rate is "the single most important metric"; cached tokens son 10× cheaper en Sonnet. Usan file system como unbounded context, mask tool logits en lugar de dynamic tool removal, y deliberately preserve errors en context.

4. **Multi-agent viene a costo brutal.** Anthropic publicly states que su multi-agent research system usa **~15× más tokens** que chat. Outperforms single-agent en 90.2% en research tasks pero "not a good fit" para tasks con shared context o interdependencies. Otros research found single agents matched o beat multi-agent en 64% de tasks at half the cost.

5. **Co-Star es template-based, no LLM-driven (históricamente).** Su "AI" es una NLG layer que rellena snippets escritos por freelance human astrologers contra NASA ephemeris data. Solo su nuevo "astrology machine" feature usa GPT-3/ChatGPT para Q&A. The Pattern es similar — proprietary algorithms sobre birth-chart features, no generative LLMs at the core.

6. **Character.AI's competitive moat es inference cost (int8 KV cache, multi-query attention, sliding-window, cross-layer cache sharing) — no memoria.** Sirven ~20k qps a <1¢/hour de conversation, 13.5× cheaper que competitors usando commercial APIs. Memory-wise usan "inter-turn caching" + summarization pero memory gaps documented son known weakness.

7. **Replika split work across multiple models behind one persona.** Eugenia Kuyda confirmed publicly: "rerouting between different models, retrieval augmented generation, pinging a bunch of different databases, and also some language models that are working on top of the conversation to extract memories, to summarize conversations, to understand emotions." Este es el canonical model-routing pattern para personal AI.

8. **Lindy's biggest lesson: put the agent on rails.** Flo Crivello stated "The more you can put your agent on rails... the more reliable it's going to be." Walked away de "give the LLM a big prompt + tools and pray" — Lindy 2.0 es GUI-driven workflows con explicit triggers and steps. Agent memory bloat hurts even con large context.

9. **Prompt caching es el single highest-ROI optimization para long-running personalized agents.** Anthropic: 90% cost reduction, 85% latency reduction; cache reads $0.30/MTok vs $3/MTok base on Sonnet. Manus reports a 100:1 input-to-output token ratio y trata KV cache hit rate como su north-star metric.

10. **Hume EVI productized un clean pattern para "persistent advisor across sessions"**: `chat_id` per session, `chat_group_id` linking resumed sessions, custom session IDs para backend correlation, mid-conversation context injection para RAG/knowledge bases. Es well-designed minimal API surface para el use case.

---

## Per-Product Findings

### Manus AI — Mejor public engineering writeup en este espacio

Source: Yichao "Peak" Ji's blog post, el most cited public agent context-engineering document de 2025.

Concrete techniques:
- **KV-cache as north-star metric**: "the KV-cache hit rate is the single most important metric for a production-stage AI agent." Cached tokens cost $0.30/MTok vs $3/MTok uncached on Claude Sonnet (10× savings). Reportan 100:1 input-to-output token ratio.
- **Stable prefixes son mandatory.** Never include timestamps en system prompts. Use deterministic JSON serialization. Use session IDs para route requests al mismo worker.
- **File system as unbounded context.** Three-tier memory: context window → file system (agent-operable) → masked action space.
- **Logit masking, no dynamic tool removal.** Usan `auto`/`required`/`specified` function-calling modes by masking token logits en decode rather than mutating tool list (que rompe KV cache).
- **Todo list recitation.** Constantly rewriting un todo list pushes el global plan al model's recent attention span — explicitly to combat "lost-in-the-middle."
- **Preserve errors in context.** "Leave the wrong turns in the context... when the model sees a failed action — and the resulting observation or stack trace — it implicitly updates its internal beliefs."
- **Explicitly rejected**: aggressive context compression ("any irreversible compression carries risk"), few-shot patterns ("drift, overgeneralization, hallucination"), dynamic action spaces.
- Rebuilt el framework 4 veces. Llaman al iterative tuning "Stochastic Graduate Descent."

URLs:
- https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus
- https://www.zenml.io/llmops-database/context-engineering-for-production-ai-agents-at-scale

### Anthropic — Multi-agent research system & Claude Memory

**Multi-agent research system blog** (Anthropic Engineering, Jun 2025):
- Architecture: Opus 4 lead agent + multiple Sonnet 4 subagents en paralelo; orchestrator-worker pattern.
- Performance: **+90.2%** sobre single Opus 4 en internal research evals.
- Cost: **~15× más tokens** que chat (single agents already use ~4× more).
- "Token usage by itself explains 80% of the variance" en performance en BrowseComp.
- Lead agent saves research plan a persistent memory porque context truncates a 200k tokens.
- Anti-patterns observed: spawning 50 subagents para simple queries, agents picking SEO content over academic sources, subagents duplicating work.
- "Some domains that require all agents to share the same context or involve many dependencies between agents are not a good fit for multi-agent systems today."

**Claude Memory feature** (shipped Sept 2025, expanded Oct 2025 a Pro/Max):
- File-based: hierarchical CLAUDE.md files (Enterprise → Project → User levels). Explicit rejection de vector DBs.
- Auto-synthesizes facts de chat history every ~24h; user puede también write directly via tool.
- Known weakness: as CLAUDE.md grows, "the model's ability to pinpoint the most relevant piece of information... diminishes."

**Prompt caching** (the operational lever):
- 90% cost / 85% latency reduction. Cache write 1.25× base, cache read 0.10× base. 5-min TTL default; 1-hour TTL available a higher write cost. Break-even después de 2 calls.

URLs:
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/news/prompt-caching
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool

### Lindy — Real talk on production agent platforms

From Latent Space podcast (Flo Crivello, CEO):
- **Pivot from Lindy 1.0 (free agent) to Lindy 2.0 (rails)**: GUI workflow builder con explicit triggers + steps. Quote: "The more you can put your agent on rails, one, the more reliable it's going to be, obviously, but two, it's also going to be easier to use for the user."
- **"60-70% de los prompts que la gente type don't mean anything."** Driving el move away from text-based agent definition.
- **Claude 3.5 Sonnet removed el model bottleneck**: "It is actually shocking the extent to which the model is no longer the limit."
- **Memory bloat is real even con large context.** Actively prune memory logs. Users get a "memory saving skill" — explicit control sobre lo que gets recorded.
- **"Poor man's RLHF":** cuando users edit drafted outputs antes de send, esos edits get embedded y retrieved para future tasks.
- **Append-only ledger pattern para nodes** — cada step appends, prefix stays stable, prompt caching works.
- **Multi-agent via Lindy-invokes-Lindy**, separated by jobs-to-be-done.
- Anecdote: su support bot estaba hallucinating YouTube links hasta que added "don't rickroll people, please don't rickroll" al system prompt.

URL: https://www.latent.space/p/lindy

### Character.AI — Cost moat, weak memory

- Scale: ~20,000 qps, <1¢/hour-of-conversation, 33× cheaper que at launch, 13.5× cheaper que competitors usando commercial APIs.
- In-house model family **Kaiju**: dense transformer + int8 quantization (weights, activations, KV cache), multi-query attention, sliding-window attention, cross-layer cache sharing. Trained natively in int8.
- Memory: "inter-turn caching" + summarization. Documented user complaints sobre memory gaps y persona drift; system fails narrative continuity tests because of "stateless inference, theatrical memory, and per-turn plausibility optimization."
- Not the role model para memory — pero el role model para serving cost.

URLs:
- https://blog.character.ai/optimizing-ai-inference-at-character-ai/
- https://blog.character.ai/inside-kaiju-building-conversational-models-at-scale/

### Replika — Multi-model orchestration behind one persona

- Eugenia Kuyda (interview): "rerouting between different models, retrieval augmented generation, pinging a bunch of different databases, and also some language models that are working on top of the conversation to extract memories, to summarize conversations, to understand emotions." Canonical model-routing pattern.
- Started fully scripted; CakeChat (open-sourced 2018) was their first generative dialogue system (Keras seq2seq con emotional conditioning). Around 2022 estaban en un fine-tuned ~1.5B GPT-2 XL. Now their own LLM family.
- 80–90% del dialogue is generative; el resto still scripted (relationship modes etc.).
- Long-term memory was, as of Kuyda's recent interviews, still being figured out — explicitly do not have full LTM.

URLs:
- https://www.cognitiverevolution.ai/creating-compassionate-ai-with-replikas-eugenia-kuyda/
- https://en.wikipedia.org/wiki/Replika

### Pi (Inflection AI) — Less here than the marketing implies

- Rise-and-fall arc: Inflection-1/2/3 powered Pi; team largely moved a Microsoft en March 2024. Pi continues pero engineering blog es sparse.
- Claimed architecture: API gateway → context DB → Inflection model con safety/sentiment/PII layers. "Recursive Sentiment Loop" mentioned en third-party recaps pero not documented technically by Inflection.
- Personal knowledge graph claimed pero no published schema.
- Inflection-3 marketed at 1M-token context, 40% lower hallucination rate vs 2024 baseline. **Skeptic's note:** most "Pi memory" details I found were on third-party blogs, not Inflection's own engineering writing. Treat as marketing.

URL: https://inflection.ai/blog

### Hume EVI — Clean session-persistence API design

- `chat_id` per WebSocket session; `chat_group_id` links resumed sessions into one logical conversation; custom session IDs para backend correlation.
- Para resume: pass `resumed_chat_group_id` query param en next handshake.
- EVI 3 supports **mid-conversation context injection** para RAG/knowledge bases — el model accepts new context while it is speaking.
- Esto es un small but production-tested API design pattern para "advisor that picks up where you left off." Worth copying the shape of.

URLs:
- https://dev.hume.ai/docs/speech-to-speech-evi/features/resume-chats
- https://dev.hume.ai/docs/speech-to-speech-evi/features/chat-history

### OpenAI ChatGPT Memory

- Two channels: explicit "Saved Memories" (cap ~1500-1750 words / 100-200 entries en Plus/Pro después de Feb 2025 expansion) y "Reference chat history" (unlimited, derived from past chats).
- April 2025: full chat-history reference rolled out a Plus/Pro globally.
- User reports "memory full" errors y unpredictable retrieval — see Embrace The Red's reverse-engineering writeup.
- Para Custom GPTs específicamente: 20 file slots, 512MB each, retrieval is via embedding; consistent user complaints que custom GPT knowledge files retrieve worse que same content uploaded inline.

URLs:
- https://openai.com/index/memory-and-new-controls-for-chatgpt/
- https://embracethered.com/blog/posts/2025/chatgpt-how-does-chat-history-memory-preferences-work/

### Co-Star — Mostly NOT an LLM product

- Founded 2017, NYC. NASA JPL ephemeris data → algorithm picks aspects → strings together snippets escritos por **freelance astrologers and writers**. Not generative AI para el core daily push notifications.
- Added an "astrology machine" feature on top of GPT-3/ChatGPT para Q&A. Co-Star themselves said most general LLMs are "awful at astrology" porque don't ground in real planetary positions.
- Architectural pattern: deterministic planetary calculation + curated human-written snippet library + selection algorithm + (newer) LLM Q&A layer con curated grounding. Closest spiritual analog a Astral's "deterministic transit impact + LLM interprets the calculated data" decision.

URL: https://www.inverse.com/article/54991-costar-astrology-app-how-it-works

### Mem0 — Reference architecture for agent memory

The most concrete production memory paper available.

- **Two phases**: Extraction (LLM converts messages into entity/relation triples) y Update (each new fact compared to top-K similar existing facts en vector store; LLM picks ADD / UPDATE / DELETE / NOOP).
- **Mem0ᵍ variant**: stores memory as a directed labeled graph con un Conflict Detector para overlapping facts.
- **Benchmarks**: 91.6 LoCoMo, 93.4 LongMemEval, 64.1/48.6 BEAM (1M/10M); avg <7k tokens/retrieval; 26% LLM-as-judge improvement over OpenAI's memory feature; 91% lower p95 latency; >90% lower token cost que full-history baselines.
- The ADD/UPDATE/DELETE/NOOP four-op pattern is reusable as primitive even sin their library.

URLs:
- https://arxiv.org/abs/2504.19413
- https://mem0.ai/research

### Letta / MemGPT — Hierarchical memory as OS

- Three-tier design (Core / Recall / Archival memory) inspired by virtual memory paging.
- **Core Memory**: small block pinned to context, agent-editable via tools (user persona, preferences).
- **Recall Memory**: full conversation log, searchable but not pinned.
- **Archival Memory**: external store (vector DB), agent queries via tool calls.
- Letta added "sleep-time compute": background agents refine memory blocks while user is idle, vs MemGPT donde memory edits blocked the response.

URLs:
- https://www.letta.com/blog/agent-memory
- https://docs.letta.com/concepts/memgpt/
- https://arxiv.org/abs/2310.08560

### Karpathy's LLM Knowledge Base — Deliberately RAG-less

- All Markdown, all the time. The LLM is the librarian — reads raw inputs, writes structured wiki entries, generates summaries y backlinks, runs "lint" passes para inconsistencies.
- Stage 1 ingest (raw/), stage 2 compile (wiki/), stage 3 active maintenance (LLM scans, links, fixes).
- Karpathy's claim: at ~100 articles / ~400k words, navigation via summaries + index is sufficient — no embeddings needed. Once past that, you need a retrieval layer.
- The "user owns the data, AI is a sophisticated editor" framing.

URLs:
- https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an
- https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f

### Notion AI

- 2022–2024 data infrastructure rebuild was prerequisite para AI features. Built a Notion-specific data lake. RAG over user content requires expensive **permission-tree denormalization** to respect access controls — interesting cautionary tale para any product where privacy/ACL matters.

URL: https://www.zenml.io/llmops-database/scaling-data-infrastructure-for-ai-features-and-rag

---

## Concrete Patterns Astral Could Borrow — Ranked by Signal-to-Effort

### Tier 1 — High signal, low effort

1. **Prompt caching with stable prefix.** Cache el system prompt + user HD profile + this-week's-transits block (que ya cambia en weekly ISO key). Anthropic data: 90% input-cost reduction, 85% latency reduction. Break-even at 2 calls. *Effort: low — config flag on the API call.*

2. **Living-document user profile maintained by the LLM** (Karpathy / Claude Memory pattern). Single Markdown file per user que grows con su business intake, conversations, decisions. Re-injected wholesale into context at each turn while it's small. *Effort: low at small scale; growing pains documented at >100k words.*

3. **Mem0's ADD/UPDATE/DELETE/NOOP fact operations** para any structured memory. Even sin their lib, the four-op LLM-controlled update pattern prevents memory bloat y contradictions. *Effort: medium.*

4. **Deterministic computation BEFORE LLM call** (already in Astral's stack via `analyzeTransitImpact()`). Co-Star validates this approach: el LLM should interpret pre-calculated data, never infer it. *Effort: zero — already done; lean into it harder.*

### Tier 2 — High signal, medium effort

5. **Append-only context ledger** (Lindy). Each step in a multi-turn flow appends; never mutates earlier turns. Maximizes prompt cache hits. *Effort: medium.*

6. **Logit-masked tool restriction** (Manus). When some tools should be unavailable in some states, mask logits rather than deleting tools (que busts KV cache). Requires API-level control; OpenAI/Anthropic both support `tool_choice: required/specified`. *Effort: medium.*

7. **Sleep-time / background memory compaction** (Letta). Run summarization y consolidation off the user's critical path. *Effort: medium — needs a worker.*

8. **Model routing**: cheap classifier → cheap retrieval/extraction model (e.g. Haiku/4o-mini) → expensive synthesis (Sonnet/Opus/4o). LMSYS/RouteLLM, Lindy, Replika, OpenAI all do this. Quoted savings 50–90%. *Effort: medium.*

9. **Hume's chat_id / chat_group_id pattern** para "advisor across sessions" UX. Two-level identifier: session and conversation. *Effort: low — schema-level decision.*

### Tier 3 — High signal, high effort (consider only if Astral grows in that direction)

10. **Multi-agent orchestrator-worker** (Anthropic, Manus). 90% better en research-style breadth tasks pero **15× the tokens**. Bad fit para tightly coupled tasks. Astral's weekly-report generation could plausibly use a planner + 2–3 specialist subagents (HD analyst, business strategist, marketing-copy writer), pero cost will dominate. *Effort: high.*

11. **Hierarchical memory tiers (working / episodic / semantic / procedural)** — Letta's full design. Most production systems implement only two layers well; the four-layer ideal is research-grade. *Effort: very high.*

### Patterns to deliberately NOT adopt

- **Vector RAG over a single user's data at small scale.** Karpathy + Claude Memory explicitly reject it; para <100k-word user histories, full re-injection beats embeddings on coherence y is simpler.
- **Few-shot examples** of past good outputs in the prompt. Manus: "drift, overgeneralization, hallucination."
- **Dynamic tool list mutation between turns.** Busts KV cache; Manus, Anthropic, y Lindy all confirm.
- **Aggressive context compression / summarization that throws away the original.** Manus: "any irreversible compression carries risk" because the agent can't predict which observation becomes critical later.

---

## Failure Modes Documented Publicly

- **Memory drift**: gradual increase in hallucination rate from poisoned/contradictory memory entries. Mem0's ADD/UPDATE/DELETE/NOOP exists exactly to prevent this. Lindy actively prunes memory even on Sonnet 3.5.
- **Lost in the middle**: en long contexts, mid-context information gets ignored. Manus's "todo recitation" is the cheapest known mitigation.
- **Stateless theatricality** (Character.AI failure mode): models will optimize each turn para plausibility within the turn, drifting persona over time. Documented in third-party studies.
- **Context bloat from too many tools / too many memories**: tool-selection accuracy drops from ~80% to ~50% con large libraries. Tool search retrieval (Anthropic Claude 4.5) restored it to 88%.
- **"ChatGPT-flavored" generic responses**: documented mitigations are (a) explicit exclusion lists in the system prompt ("don't recommend SaaS examples"), (b) iterative refinement on first draft, (c) anti-sycophancy prompt ("you are skeptical, you double-check"), (d) hyper-specific persona constraints rather than generic "act as advisor."
- **Permission/ACL leakage in RAG** (Notion). Si your retrieval includes the wrong user's data, you have a privacy incident, not a quality bug.

---

## What I Searched For But Couldn't Find Good Info On

1. **Pi Inflection's actual memory architecture.** Inflection's own engineering blog is sparse; most "Pi memory" details are third-party recaps que read like marketing reverse-engineering. The "Recursive Sentiment Loop" concept appears only on aggregator blogs. **Treat as unverified.**
2. **Adept's architecture.** Largely defunct as a public company since the Amazon acquihire; no new engineering material.
3. **Rabbit's actual stack** (the LAM). Plenty of marketing about "Large Action Models," very little engineering substance; widely considered hype-driven.
4. **Cognosys** has only marketing pages. No engineering blog, no podcast interviews, no published architecture details.
5. **The Pattern's stack.** Zero engineering content from the company itself; only third-party "build a Pattern clone" tutorials.
6. **MyHumanDesign / HumanDesign.com tools** — no AI integrations are documented publicly. The HD-software niche is small y proprietary.
7. **Replika's current model details.** Kuyda's interviews are high-level. The shift from CakeChat → GPT-2 XL → "their own LLMs" is documented at a slogan level, not at an architecture level.
8. **Co-Star's astrology-machine prompt and grounding strategy** — they confirmed using ChatGPT but didn't publish how they ground it in their content library.
9. **Character.AI memory implementation specifically.** Their inference posts are excellent; their memory implementation is unpublished. The "memory gap" complaints come from users, not from Character.AI.
10. **Mem.ai's current stack.** They've pivoted multiple times; no recent engineering writing.

---

## Sources

- [Manus: Context Engineering for AI Agents](https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus)
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Anthropic — Prompt caching with Claude](https://www.anthropic.com/news/prompt-caching)
- [Anthropic — Memory tool docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Anthropic — Prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Latent Space — Agents @ Work: Lindy.ai (Flo Crivello)](https://www.latent.space/p/lindy)
- [Lindy — A Complete Guide to AI Agent Architecture](https://www.lindy.ai/blog/ai-agent-architecture)
- [Character.AI — Optimizing AI Inference](https://blog.character.ai/optimizing-ai-inference-at-character-ai/)
- [Character.AI — Inside Kaiju](https://blog.character.ai/inside-kaiju-building-conversational-models-at-scale/)
- [Cognitive Revolution podcast — Eugenia Kuyda on Replika](https://www.cognitiverevolution.ai/creating-compassionate-ai-with-replikas-eugenia-kuyda/)
- [Replika — Wikipedia overview](https://en.wikipedia.org/wiki/Replika)
- [Inflection AI blog](https://inflection.ai/blog)
- [Hume EVI — Resuming Chats](https://dev.hume.ai/docs/speech-to-speech-evi/features/resume-chats)
- [Hume EVI — Chat History](https://dev.hume.ai/docs/speech-to-speech-evi/features/chat-history)
- [Hume — Announcing EVI 3 API](https://www.hume.ai/blog/announcing-evi-3-api)
- [OpenAI — Memory and new controls for ChatGPT](https://openai.com/index/memory-and-new-controls-for-chatgpt/)
- [Embrace The Red — Reverse-engineering ChatGPT memory](https://embracethered.com/blog/posts/2025/chatgpt-how-does-chat-history-memory-preferences-work/)
- [Inverse — How Co-Star actually works](https://www.inverse.com/article/54991-costar-astrology-app-how-it-works)
- [Mem0 paper (arXiv 2504.19413)](https://arxiv.org/abs/2504.19413)
- [Mem0 research / benchmarks](https://mem0.ai/research)
- [Letta — Agent Memory](https://www.letta.com/blog/agent-memory)
- [Letta — Rearchitecting the agent loop](https://www.letta.com/blog/letta-v1-agent)
- [MemGPT paper (arXiv 2310.08560)](https://arxiv.org/abs/2310.08560)
- [VentureBeat — Karpathy's LLM Knowledge Base bypasses RAG](https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an)
- [Karpathy llm-wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [LMSYS — RouteLLM](https://www.lmsys.org/blog/2024-07-01-routellm/)
- [Anthropic — Advanced tool use (tool search)](https://www.anthropic.com/engineering/advanced-tool-use)
- [Notion data infrastructure for AI features (ZenML)](https://www.zenml.io/llmops-database/scaling-data-infrastructure-for-ai-features-and-rag)
- [Mem0 — Reducing hallucinations with grounded memory](https://mem0.ai/blog/reducing-hallucinations-llms-with-grounded-memory)
- [Skywork — Claude Memory deep dive](https://skywork.ai/blog/claude-memory-a-deep-dive-into-anthropics-persistent-context-solution/)
