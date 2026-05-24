# ADR: Politica model-aware de context window e historial

Estado: Aceptado
Fecha: 2026-05-24
Area: Chat, context awareness, memoria conversacional
Bead: `astral-e2h.12`

## Contexto

`astral-e2h.5` y `astral-e2h.6` agregaron medicion de context budget por
bloques: modelo activo, provider, tokens usados, limite, porcentaje usado,
breakdown y calibracion post-call. `astral-e2h.7` usa esa medicion para mostrar
un banner preventivo.

Pero el selector real de historial sigue usando `CHAT_HISTORY_TURNS=60` como
criterio primario. Eso es incorrecto como politica de contexto:

- 60 mensajes cortos pueden pesar casi nada;
- 1 mensaje pegado desde un documento largo puede consumir mas que todo el
  historial;
- un cambio de `CHAT_MODEL` puede cambiar el context window sin que el selector
  se adapte;
- el frontend puede mostrar un porcentaje model-aware mientras el backend corta
  historial por una regla distinta.

La politica anti-alucinacion de Astral no puede basarse en cantidad de mensajes.
Tiene que basarse en el presupuesto real de tokens del modelo activo y en que
partes del contexto viajan efectivamente al LLM.

## Decision

Reemplazar `CHAT_HISTORY_TURNS=60` como criterio primario por seleccion de
historial basada en tokens y model-aware.

La regla canonica pasa a ser:

```text
context_window(model)
- reserve_response(route, model)
- reserve_tool_loop(route)
- safety_margin(model)
- system/profile/intake/memory/transits/impact/tools_schema/current_message
= available_history_budget
```

El backend debe seleccionar el historial literal mas reciente que entre en
`available_history_budget`, preservando orden y sin partir mensajes. Si no hay
presupuesto para historial, el request sigue con profile + memory + contexto
actual, pero el sistema debe registrar que omitio historial.

`CHAT_HISTORY_TURNS` puede sobrevivir solo como hard cap secundario defensivo
para evitar queries descontroladas o payloads absurdos. No puede ser la fuente
de verdad para calidad, UX ni observabilidad.

## Principios

1. **La medicion y el selector comparten logica.** El endpoint
   `/me/chat/context-budget`, la telemetria y el prompt real deben usar el mismo
   selector de contexto. Si la UI dice "70% usado", ese numero debe describir
   lo que se esta por mandar al modelo, no una simulacion paralela.
2. **El historial visible no se destruye.** `chat_messages` sigue siendo el
   registro literal de la conversacion. Seleccionar menos historial para el LLM
   no borra ni compacta la conversacion.
3. **`memory_md` no es summary de sesion.** Sigue siendo memoria semantica
   estable. El historial omitido no se mezcla automaticamente en memory.
4. **El mensaje actual tiene prioridad sobre historial viejo.** Si la usuaria
   pega un texto grande que entra en el modelo, se prioriza responder eso con
   profile/memory y se reduce historial. Si no entra, se rechaza con UX clara.
5. **Unknown model no inventa contexto.** Un modelo sin registry no puede
   producir porcentajes ni presupuestos confiables. Debe degradar de forma
   observable, no silenciosa.

## Politica de model registry

Crear una fuente central para specs de modelos usados por Astral:

```ts
interface ChatModelContextSpec {
  model: string;
  provider: "openai" | "anthropic";
  contextWindowTokens: number;
  maxOutputTokens: number;
  tokenizer: "o200k_base" | "anthropic_count_tokens" | "provider_reported";
  defaultResponseReserveTokens: number;
  defaultToolLoopReserveTokens: number;
  safetyMarginTokens: number;
}
```

Reglas:

- todo `CHAT_MODEL` productivo debe existir en el registry;
- el context window se lee del registry, no de constantes dispersas;
- el registry debe usarse para pre-call budget, UI percent y tests;
- cambiar `CHAT_MODEL` desde Render sin agregar spec es una configuracion
  degradada y debe loguear `chat_context_unknown_model`;
- para modelos unknown, la UI no muestra porcentaje y el selector usa un modo
  conservador con historial minimo o nulo hasta corregir la config.

En V1, OpenAI `gpt-4o-mini` y `gpt-4o` siguen usando `o200k_base` para
estimacion local y `totalUsage` post-call para calibracion.

## Politica de seleccion de historial

El selector debe recibir bloques ya tokenizados, no strings reconstruidos por
separado. La unidad de seleccion es `ChatMessage` completo.

Orden de prioridad:

1. system static + tools schema anti-alucinacion;
2. profile HD activo;
3. memory semantica (`users.memory_md`);
4. intake/transits/impact del turno;
5. current user message;
6. historial reciente que entre en el budget;
7. reserva de respuesta y tool loop.

Invariantes:

- no partir mensajes;
- no reordenar mensajes;
- conservar pares recientes cuando entren, pero no bloquear un mensaje actual
  por preservar un par viejo;
- registrar cantidad de mensajes seleccionados y omitidos;
- si el historial completo entra, no omitir nada;
- si history domina el budget, la UI puede advertir aunque el porcentaje total
  sea menor a los thresholds.

Shape conceptual:

```ts
interface SelectedChatContext {
  model: string;
  contextWindowTokens: number | null;
  selectedMessages: ChatMessage[];
  omittedMessageCount: number;
  omittedTokenEstimate: number;
  currentMessageTokens: number;
  historyTokenBudget: number;
  selectedHistoryTokens: number;
  estimatedTotalTokens: number;
  percentUsed: number | null;
  selectionReason:
    | "full_history_fits"
    | "token_budget_omitted_history"
    | "current_message_dominates"
    | "unknown_model_conservative";
}
```

## Mensajes individuales enormes

No truncar silenciosamente el mensaje actual. Esa seria la peor combinacion:
aparenta responder lo que la usuaria escribio, pero opera sobre una version
incompleta.

Politica:

1. Tokenizar el mensaje actual antes de llamar al LLM.
2. Si el mensaje entra con system/profile/memory/tools y reserva minima de
   respuesta, enviar el turno sin historial viejo si hace falta.
3. Si el mensaje no entra ni sin historial, devolver error controlado con copy
   de producto: la entrada es demasiado extensa para responderla bien en chat y
   debe dividirse o moverse a un flujo futuro de documento/intake.
4. Persistir telemetria de rechazo sin guardar contenido sensible adicional:
   user id, modelo, tokens estimados, limite, razon.

El producto no debe comunicar esto como un fallo tecnico. Es una proteccion de
calidad: Astral evita dar una respuesta degradada sobre un input que no puede
leer completo.

## UX

El banner de `astral-e2h.7` sigue siendo awareness, no compactacion.

La UI puede mostrar estado tipo "contexto alto" o "queda poco margen" si:

- `percentUsed >= 70%` para alerta suave;
- `percentUsed >= 85%` para alerta alta;
- history domina materialmente el budget;
- el selector omitio historial por token budget;
- el mensaje actual domina el contexto.

La UI no debe mostrar token internals crudos a usuarias no tecnicas por default.
Para soporte/admin si conviene exponer: modelo, porcentaje, bloque dominante,
historial omitido y ultimo calibration ratio.

Copy aceptable para usuaria:

```text
La conversacion esta muy cargada. Astral va a priorizar lo mas reciente y tu
memoria guardada para cuidar la calidad de la respuesta.
```

Si el mensaje individual es demasiado grande:

```text
Este mensaje es demasiado extenso para responderlo bien en una sola consulta.
Dividilo en partes mas chicas para que Astral pueda leerlo completo.
```

## Observabilidad y auditoria

Para investigar reportes tipo "alucina" o "bajo la calidad", cada `llm_calls`
de chat debe poder responder:

- que modelo y context window se uso;
- cuantos tokens estimados viajan por bloque;
- cuantos mensajes de historial fueron seleccionados y omitidos;
- cuantos tokens ocupaba el mensaje actual;
- si hubo `unknown_model_conservative`;
- si el selector omitio historial por presupuesto;
- si el usuario vio o descarto warning de presion de contexto;
- tokens reales post-call y calibration ratio;
- tool calls ejecutadas y tools usadas.

No registrar contenido adicional del mensaje fuera de las tablas que ya guardan
chat visible. La auditoria debe trabajar con conteos, ids/rangos y hashes.

## Impacto en ADRs previas

Esta ADR supersede solo la parte de `docs/adr/chat-compaction-policy.md` que
decia "mantener `CHAT_HISTORY_TURNS=60` como ventana literal". La decision de
no implementar compactacion destructiva en V1 sigue vigente.

Esta ADR tambien refina `docs/adr/context-budget-tracking.md`: el bloque
`history` deja de significar "mensajes despues de `CHAT_HISTORY_TURNS`" como
politica futura, y pasa a significar "mensajes seleccionados por el selector
model-aware".

## Alternativas consideradas

### A. Mantener `CHAT_HISTORY_TURNS=60`

Rechazada. Es simple y hoy funciona en beta, pero no responde al problema raiz.
Mensaje corto y mensaje gigante no pesan lo mismo, y la politica no se adapta a
modelos nuevos.

### B. Cap fijo de tokens para historial

Parcial. Mejora sobre cantidad de mensajes, pero sigue sin considerar context
window por modelo, reserva de salida, tool loop ni current message.

### C. Token-budgeted history model-aware

Adoptada. Es la politica minima que alinea backend, UI, telemetria y cambios de
modelo sin agregar compaction ni storage nuevo.

### D. Auto-compact inmediato

Rechazada para V1. La ADR de compactacion ya decidio que compactar de forma
segura requiere summary separado y preservacion del historial visible. Esta ADR
reduce contexto enviado, no inventa memoria nueva.

### E. RAG sobre historial

Rechazada para V1. Prematura para el volumen actual y no resuelve el problema
del mensaje actual enorme.

## Guardrails de implementacion

- No agregar dependencias nuevas para OpenAI; reutilizar `js-tiktoken`.
- No tocar system prompt salvo que una prueba demuestre drift entre bloques y
  prompt final.
- No introducir `any`, comentarios obvios ni try/catch defensivos.
- No borrar ni mutar `chat_messages` como efecto de seleccionar contexto.
- No mezclar esta tarea con compactacion, RAG, threads o multi-profile V2.
- Tests primero:
  - historial largo con mensajes chicos conserva mas de 60 si entra en budget;
  - historial corto con mensaje enorme omite historial viejo;
  - mensaje individual demasiado grande se rechaza sin llamada LLM;
  - unknown model no inventa `percentUsed`;
  - endpoint budget y llamada real seleccionan los mismos mensajes;
  - telemetria persiste selected/omitted counts y reason.

## Siguiente bead recomendado

Crear un bead de ejecucion dependiente de `astral-e2h.12`:

```text
Backend: selector model-aware de historial por token budget
```

Scope inicial:

- extraer model registry desde `context-budget.ts`;
- implementar selector compartido para budget endpoint y chat/stream;
- mantener `CHAT_HISTORY_TURNS` solo como hard cap secundario;
- manejar mensaje actual enorme con error controlado;
- persistir metadata de seleccion en `context_breakdown_json`;
- actualizar tests y docs de arquitectura.

No incluir UI nueva salvo ajustar copy si el backend expone una razon nueva.

## Fuentes externas consultadas

- [OpenAI Cookbook: Agents SDK session memory](https://cookbook.openai.com/examples/agents_sdk/session_memory):
  `TrimmingSession` conserva los ultimos N turnos y mantiene almacenamiento
  completo separado del input enviado al modelo.
- [OpenAI Agents SDK: running agents](https://openai.github.io/openai-agents-python/running_agents/):
  sessions recuperan y guardan historial por conversacion; `previous_response_id`
  y `conversation_id` son mecanismos de estado gestionado cuando aplica.
- [OpenAI API docs: managing tokens](https://platform.openai.com/docs/guides/text-generation/managing-tokens):
  cuando una conversacion excede el limite del modelo, hay que truncar, omitir
  o reducir texto hasta que entre.
- [OpenAI Cookbook: how to count tokens with tiktoken](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken):
  `tiktoken` permite estimar tokens OpenAI pre-call y `o200k_base` cubre
  `gpt-4o` / `gpt-4o-mini`.
- [Anthropic docs: token counting](https://docs.anthropic.com/en/docs/build-with-claude/token-counting):
  Count Tokens API estima mensajes, system, tools, imagenes y PDFs antes de
  crear el mensaje.
- [Claude Code SDK docs: slash commands](https://code.claude.com/docs/en/agent-sdk/slash-commands):
  `/compact` reduce historial conversacional mediante resumen; es referencia de
  producto para entornos tecnicos, no contrato para Astral.
- [OpenAI Codex CLI docs](https://developers.openai.com/codex/cli):
  la superficie publica documenta el CLI y su configuracion, pero no un contrato
  estable de algoritmo para "context left"; Codex se toma como referencia de UX,
  no como fuente tecnica a copiar.
- [LangGraph docs: memory](https://docs.langchain.com/oss/javascript/langgraph/add-memory):
  conversaciones largas pueden exceder el context window; trimming y summaries
  son operaciones explicitas sobre estado.
- [Cursor docs: models](https://docs.cursor.com/models) y
  [Cursor docs: summarization](https://docs.cursor.com/en/agent/chat/summarization):
  cada chat mantiene una ventana de contexto y Cursor optimiza/prunea o resume
  contenido para conservar senal.

## Fuentes internas consultadas

- `docs/adr/context-budget-tracking.md`
- `docs/adr/chat-compaction-policy.md`
- `docs/architecture/chat-llm-system.md`
- `docs/architecture/refactor-2026-05-decisions.md`
- `docs/research/2026-05-context-engineering-best-practices.md`
- `docs/research/2026-05-conversational-memory-patterns.md`
- `backend/src/services/guide-service.ts`
- `backend/src/llm/context-budget.ts`
- `backend/src/types/context-budget.ts`
- `backend/src/agent-service-v2.ts`
- `frontend/src/chat-context-pressure.ts`
- `backend/src/__tests__/context-budget.test.ts`
- `backend/src/__tests__/api-chat-context-budget.test.ts`
- `backend/src/__tests__/api-chat.test.ts`
- `backend/src/__tests__/frontend-chat-context-pressure.test.ts`
