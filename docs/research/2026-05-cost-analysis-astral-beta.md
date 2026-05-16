# Análisis financiero LLM — Astral beta

**Investigación**: sub-agent con cálculos basados en datos reales de `llm_calls` de Daniela (prod) + precios OpenAI/Anthropic mayo 2026.
**Fecha**: 2026-05-15 / 2026-05-16.
**Origen**: pregunta "¿cuánto sale realmente esto a 100 / 1000 users?"

---

## 1. Asumpciones (datos reales)

Datos extraídos de `llm_calls` de Daniela en prod:

- **Chat** (`runAstralAgentStream`): system prompt ~10-15K tokens. Por request: ~14K input + ~500-700 output. Datos reales: in=14106-15423, out=31-673.
- **Memory writer**: ~2K input + ~300-500 output, se invoca después de cada chat. Datos reales: in=818-2344, out=138-487.
- **Report**: ocasional, ~3K input + ~3K output.
- **Extraction Vision**: una vez por user (onboarding), usa gpt-4o.

## 2. Costo por turn completo (chat + memory writer)

| Escenario | Chat $/turn | Writer $/turn | Total $/turn |
|---|---|---|---|
| Todo gpt-4o | 0.04225 | 0.00675 | **$0.04900** |
| Híbrido actual (4o chat + mini writer) | 0.04225 | 0.000405 | **$0.04266** |
| Todo gpt-4o-mini (estado actual) | 0.002535 | 0.000405 | **$0.00294** |

Supuestos: chat 14.5K in / 600 out; writer 1.5K in / 300 out (midpoints de los rangos reportados).

## 3. Costo mensual a 10 msg/día/user, 30 días

| Users | Turns/mes | Todo 4o | Híbrido 4o+mini | **Todo mini (actual)** |
|---|---|---|---|---|
| 10 | 3,000 | $147 | $128 | **$8.80** |
| 100 | 30,000 | $1,470 | $1,280 | **$88** |
| 1,000 | 300,000 | $14,700 | $12,795 | **$882** |

Report ($0.018/run) y extraction ($0.05/user one-shot) son ruido frente al chat (<2% del total).

## 4. Punto de quiebre

Para un founder solo en beta el umbral razonable es **~$200–$300/mes**.

- **Todo gpt-4o-mini**: aguanta 1000 users a $882/mes. Sostenible en beta.
- **Híbrido 4o+mini**: cruza $200 con ~16 users. **Insostenible sin revenue**.
- **Todo gpt-4o**: insostenible casi desde el inicio.

## 5. Comparación con Claude (chat only, writer queda en mini)

| Modelo chat | $/turn (sin cache) | $/turn (con cache 90% hit) | Mensual 100 users |
|---|---|---|---|
| gpt-4o (baseline) | 0.04225 | n/a | $1,280 |
| Sonnet 4.6 | 0.0525 | **0.0174** | **$526** con cache |
| Haiku 4.5 | 0.0175 | **0.0058** | **$186** con cache |
| **gpt-4o-mini (actual)** | 0.002535 | ~0.0015 | **$45-88** |

Anthropic prompt caching SÍ aplica acá: el system prompt de 10-15K tokens (HD condensed + business pack + detection rules) es **estable entre turns del mismo user y compartible entre users** — cache reads cuestan 10% del input rate, writes 1.25x. El system prompt grande es exactamente el caso de uso óptimo del feature.

**Caveat sobre cache**: TTL 5 min default, 1h beta. Con tráfico esporádico (Daniela hizo 0.86 msg/día), el hit rate real puede bajar. Conviene cache compartido del bloque global (HD + business pack + rules ≈ 11K tokens) que SÍ se reusa entre users.

## 6. Recomendación específica

**Decisión adoptada en el refactor 2026-05**: mantener `gpt-4o-mini` + agregar tool use (5 tools deterministas) + prompt cache automático.

Justificación con números:
- A 100 users: **$45-88/mes** (real, con tools) vs $1,280/mes (gpt-4o sin tools) → **93% de ahorro**.
- A 1000 users: ~$450-880/mes vs $12,795 → diferencia que decide si el producto es rentable o no.
- Mini con tools rinde **100% accuracy en caso Daniela (5/5 PASS)** — igual que gpt-4o sin tools.

**Pendiente como beads**:
- **memory_writer en Batch API** (OpenAI batch = 50% off): es asíncrono por naturaleza, no bloquea UX. Writer pasa de $0.000405 a $0.0002/turn — marginal en absoluto ($60/mes ahorro a 1000 users) pero gratis de implementar.
- **Multi-provider abstraction** para experimentar con Haiku 4.5 + caching: si el cache de Anthropic compensa, podríamos llegar a $186/mes con calidad incluso superior. Eval A/B antes de prender.

**NO routear por complejidad todavía**: el detector cuesta más en mantenimiento del que ahorra en beta. Todos los chats pasan por el mismo modelo barato + tools.

**SÍ gastá más en chat (visible) que en writer/report (internos)**: el writer en mini está bien; report puede quedar en mini sin que se note.

## 7. Resumen ejecutivo

A 100 users (target realista en 3-6 meses):

- Estado actual post-refactor: **~$45-88/mes**.
- Si no hubiéramos refactoreado: **~$1,280/mes** (gpt-4o forzado por alucinaciones).
- Ahorro proyectado: **93%**.
- Calidad: **igualada o superior** (caso Daniela 100% vs 0% pre-refactor).

El refactor pagó solo el primer mes contra 100 users.
