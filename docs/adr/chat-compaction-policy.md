# ADR: Politica de compactacion del chat

Estado: Aceptado
Fecha: 2026-05-24
Area: Chat, memoria conversacional, context awareness
Bead: `astral-e2h.11`

Nota 2026-05-24: `docs/adr/model-aware-context-policy.md` supersede la decision
operativa de mantener `CHAT_HISTORY_TURNS=60` como criterio primario de
historial. La decision central de esta ADR sigue vigente: no hay compactacion
destructiva ni mezcla automatica de summaries en `memory_md` en V1.

## Contexto

`astral-7i8` proponia `POST /me/chat/compact`: generar un resumen con un
modelo barato, escribirlo en `users.memory_md` y truncar o borrar
`chat_messages`. Esa solucion parece natural si se copia el patron de
herramientas tecnicas como Claude Code, pero en Astral V1 mezcla tres problemas
distintos:

1. **Context pressure**: cuanto contexto se manda al modelo.
2. **Continuidad conversacional**: que matices de la charla siguen disponibles.
3. **Memoria persistente**: que hechos estables de la usuaria sobreviven entre
   sesiones.

Astral V1 ya tiene:

- selector model-aware de historial por token budget en el chat canonico;
- `users.memory_md` como Living Document de facts persistentes;
- memory writer fire-and-forget cada primer turn y cada 3 user turns;
- `GET /api/me/chat/context-budget` para medir presion de contexto por bloque;
- telemetria de selection via `context_breakdown_json.selection` y log
  `chat_context_history_selected`.

La pregunta de este ADR no es "como implementamos compact", sino si V1 debe
tener una accion de compactacion y que significa sin crear deuda contra V2
threads/per-profile.

## Definicion canonica

En Astral, **compactar** significa reducir el contexto que se envia al modelo,
no borrar el historial visible de la usuaria ni mezclar automaticamente una
sesion completa dentro de la memoria persistente.

Scopes separados:

| Scope | Persistencia actual | Semantica | Puede compactarse en V1? |
|---|---|---|---|
| Historial visible | `chat_messages` | Registro literal de la conversacion | No destructivamente |
| Contexto enviado al LLM | selector model-aware + prompt | Working context del proximo turn | Si, por seleccion/resumen |
| Memoria persistente | `users.memory_md` | Facts estables sobre usuaria, negocio, preferencias | Solo por memory writer |
| Resumen de conversacion | no existe en V1 | Episodic summary de turns viejos | No hasta tener storage separado |

`memory_md` no es un basurero para summaries de sesion. Es memoria semantica
estable. Meter ahi un resumen conversacional mezcla episodios, decisiones
temporales y matices que despues se inyectan en todos los turns futuros.

## Decision

**No implementar compact destructivo en V1.**

Esto descarta el scope original de `astral-7i8`:

- no `POST /me/chat/compact` que borre o trunque `chat_messages`;
- no summary de conversacion mergeado directo en `users.memory_md`;
- no auto-compact silencioso;
- no modal que prometa que "la memoria queda intacta" si en realidad se esta
  reescribiendo memoria con un resumen imperfecto.

La politica V1 queda:

1. Mantener seleccion bounded de historial via
   `docs/adr/model-aware-context-policy.md`: token-budgeted y model-aware.
2. Mantener `users.memory_md` como Living Document de facts persistentes,
   actualizado solo por `memory-writer.ts`.
3. Usar `GET /api/me/chat/context-budget` para mostrar presion de contexto.
4. En frontend, el banner de `.7` debe ser de **context pressure**, no de
   compactacion destructiva.
5. Reabrir implementacion de compact solo si telemetria real o feedback de
   usuarias muestra que el sistema pierde continuidad pese a `memory_md` y la
   ventana seleccionada por token budget.

## Politica de UX para `.7`

El copy no debe decir "compacta tu conversacion" en V1 si no hay accion segura
de compactacion.

UX aceptada para V1:

- Banner suave, no modal.
- Explica que la conversacion esta creciendo y que Astral prioriza los mensajes
  recientes junto con la memoria guardada.
- Acciones permitidas:
  - `Seguir asi`: descarta el banner por la sesion.
  - `Entendido`: alias si se prefiere una sola accion.
- Acciones no permitidas en V1:
  - `Compactar conversacion`.
  - `Borrar mensajes viejos`.
  - compact automatico silencioso.

Triggers recomendados para `.7`:

- `percentUsed >= 70` si `contextWindowTokens` existe;
- `history` domina el budget de forma material;
- `context_breakdown_json.selection.omittedMessageCount > 0` con
  `selection.reason` para distinguir hard cap defensivo de token budget, o log
  `chat_context_history_selected`;
- drift fuerte de calibracion si `.6` lo expone al cliente.

No disparar banner por caracteres ni por numero bruto de mensajes como unico
factor. Eso reintroduce la heuristica arbitraria que la epic elimino.

## Si compaction se vuelve necesaria antes de V2

La implementacion minima aceptable no es el endpoint original. Debe cumplir:

1. **Summary separado de `memory_md`**: crear un artefacto de resumen
   conversacional con scope propio. Ejemplo conceptual:
   `chat_context_summaries(user_id, range_start_id, range_end_id, summary,
   model, created_at)`.
2. **Historial reversible**: conservar `chat_messages` como registro literal.
   El LLM puede omitir turns viejos del contexto enviado, pero el producto no
   debe borrar el historial visible como efecto lateral de compactar.
3. **Atomicidad**: si se genera summary y se marca un rango resumido, ambas
   operaciones se confirman juntas o ninguna.
4. **Observabilidad**: registrar modelo, tokens, rango cubierto y version del
   prompt de summarization.
5. **No auto-compact V1**: la accion debe ser manual hasta tener data real de
   que una automatizacion mejora el producto.
6. **Tests de continuidad**: conversacion larga -> summary separado -> siguiente
   turn conserva decisiones relevantes sin contaminar memoria persistente.

Este storage separado probablemente pertenece a V2 threads/per-profile, no a la
V1 mono-carta actual. Por eso no se crea ahora.

## Alternativas consideradas

### A. No compactar en V1

Adoptada. Menor deuda y respeta el sistema existente. El costo es que la UI no
tiene una accion correctiva fuerte, solo awareness.

### B. Summary en `memory_md` + borrar/truncar `chat_messages`

Descartada. Simple, pero irreversible a nivel producto, contamina memoria
semantica con episodios y hace que cada error del summarizer se vuelva contexto
persistente.

### C. Summary separado + soft archive

Correcta tecnicamente, pero requiere storage y semantica de conversacion que V1
todavia no tiene. Es la forma aceptable si el problema aparece antes de V2.

### D. Threads/per-profile V2

Probablemente es el fix raiz para topic drift y scope drift. Una coach HD con
su carta, clientas y negocio necesita contextos separados, no un resumen mas
agresivo de un unico thread global.

### E. Auto-compact silencioso

Descartada para V1. Puede esconder perdida de informacion, complicar debugging
y sorprender a la usuaria.

## Impacto sobre beads

- `astral-7i8` debe cerrarse o supersederse: el endpoint destructivo queda fuera
  de scope V1.
- `astral-e2h.7` debe refactorizarse: el banner sigue siendo valido como
  context-awareness, pero sin boton de compactacion.
- Una futura task de compaction real debe depender de V2 threads/per-profile o
  crear antes el storage separado de summaries.

## Fuentes externas consultadas

- Anthropic Claude Code documenta `/compact` y auto-compact como comandos de un
  entorno tecnico de desarrollo, no como contrato de producto para apps de
  coaching: https://docs.anthropic.com/en/docs/claude-code/slash-commands
- OpenAI Agents SDK expone trimming de sesiones como gestion del historial que
  se envia al modelo, separada del almacenamiento persistente de la aplicacion:
  https://openai.github.io/openai-agents-python/sessions/
- LangGraph documenta memory y summarization como patrones con estado explicito
  y operaciones de trim/delete controladas, no como merge ciego en una memoria
  semantica global: https://docs.langchain.com/oss/python/langgraph/add-memory
- Mem0 separa operaciones de memoria persistente por usuario y enfatiza add,
  search, update y delete como CRUD de memoria, no como simple resumen de chat:
  https://docs.mem0.ai/

## Fuentes internas consultadas

- `docs/adr/context-budget-tracking.md`
- `docs/architecture/chat-llm-system.md`
- `docs/architecture/refactor-2026-05-decisions.md`
- `docs/research/2026-05-conversational-memory-patterns.md`
- `docs/research/2026-05-context-engineering-best-practices.md`
- `backend/src/memory-writer.ts`
- `backend/src/services/guide-service.ts`
