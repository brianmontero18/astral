# ADR: Context budget tracking en chat

Estado: Aceptado
Fecha: 2026-05-24
Area: Chat, telemetria LLM, context awareness
Bead: `astral-e2h.5`

Nota 2026-05-24: `docs/adr/model-aware-context-policy.md` refino la politica de
historial posterior a esta ADR. La medicion por bloques sigue vigente y
`history` ahora significa "mensajes seleccionados por el selector model-aware".

## Contexto

Astral ya persiste telemetria post-call en `llm_calls`: `tokens_in`,
`tokens_out`, `cached_tokens`, `tool_calls_count/json`, costo, latencia y hash
del prompt. Eso sirve para costo real y auditoria historica, pero no alcanza
para una UX de context awareness: el frontend necesita saber antes de la proxima
respuesta si el contexto esta creciendo mal, que bloque lo esta causando y que
accion conviene tomar.

El chat canonico usa Vercel AI SDK con OpenAI (`gpt-4o-mini` por default),
system prompt grande, tools HD deterministicas, memory markdown e historial
seleccionado por token budget. La siguiente implementacion (`astral-e2h.6`) debe medir presupuesto de
contexto sin reintroducir prompts duplicados, sin depender de heuristicas
invisibles y sin preparar un multi-provider completo antes de necesitarlo.

## Decision

Usar estrategia hibrida:

1. **Pre-call estimado por bloques** para UX y thresholds preventivos.
2. **Post-call autoritativo del provider/SDK** para facturacion, auditoria y
   calibracion del estimador.

La app no debe tratar el conteo pre-call como verdad de billing. La verdad de
tokens consumidos viene despues de la llamada. El conteo previo existe para
responder: "cuanto contexto estoy a punto de mandar, que bloque pesa mas y si
conviene reducir el contexto enviado al modelo antes de seguir".

## OpenAI

### Pre-call

Para modelos OpenAI, agregar `js-tiktoken` como tokenizer local
tiktoken-compatible. Es pure JS, evita binarios/WASM en Render y alcanza para el
objetivo de UX preventiva. Para `gpt-4o` y `gpt-4o-mini`, usar encoding
`o200k_base`.

El pre-call debe medir:

- texto del system prompt por bloque;
- mensajes de historial incluidos;
- query actual;
- estimacion del schema de tools registrado.

La estimacion local no puede prometer exactitud perfecta porque el overhead final
de mensajes, tool schemas y serializacion interna puede cambiar por modelo o SDK.
Por eso cada request debe guardar tambien una razon de calibracion:

```text
calibration_ratio = post_call_input_tokens / pre_call_estimated_input_tokens
```

`astral-e2h.6` debe usar esa razon como metrica de calidad del estimador, no como
un parche oculto que maquille el breakdown. Si el ratio se sale de rango de forma
sostenida, se corrige el algoritmo.

### Post-call

Post-call manda la verdad a `llm_calls`. Con Vercel AI SDK, usar el agregado del
loop completo:

- `totalUsage.inputTokens`
- `totalUsage.outputTokens`
- `totalUsage.inputTokenDetails.cacheReadTokens` cuando exista
- fallback provider-specific existente (`cachedInputTokens`) solo si el SDK no
  expone el detalle normalizado

No usar `usage` del ultimo step para presupuesto/costo cuando hay tool loop. En
un agente multi-step, `usage` puede representar solo el paso final; `totalUsage`
es el agregado correcto.

## Anthropic

No usar `@anthropic-ai/tokenizer` como base canonica. Para Claude moderno, la
opcion correcta es la API oficial de token counting cuando necesitemos precision
pre-call con messages, system y tools.

Decision para Astral V1:

- Mientras el chat productivo siga en OpenAI, no agregar dependencia ni llamada
  Anthropic.
- Si `CHAT_MODEL` o routing futuro activa Anthropic, implementar un adapter que
  use Messages Count Tokens API para pre-call exacto y `usage` de Messages API
  para post-call.
- Persistir por separado tokens normales, cache reads y cache writes cuando
  Anthropic entre en produccion, porque prompt caching explicito tiene semantica
  de costo distinta a OpenAI.

## Vercel AI SDK

Vercel AI SDK queda como capa de ejecucion del agente. Para context budget,
tratarlo como fuente post-call normalizada, no como tokenizer pre-call.

Reglas:

- Usar `totalUsage` para totales agregados de un request con steps.
- Usar `steps` solo para diagnostico o debugging por step, no para el endpoint
  de UX salvo que haga falta explicar un pico.
- Mantener el adapter de budget propio en Astral para que la UI no dependa de la
  forma exacta del SDK.

## Claude Code y Codex

Claude Code y Codex son referencias de producto, no contratos tecnicos para
copiar. Ambos exponen patrones utiles: mostrar presion de contexto antes del
fallo duro y mantener al usuario dentro del flujo. No hay un contrato publico
estable que debamos importar como algoritmo.

Decision para Astral:

- No implementar "auto-compact" silencioso en V1.
- No esconder el problema hasta el limite duro.
- Mostrar context pressure con causas concretas y accion explicita.
- La accion explicita en V1 no debe ser compactacion destructiva; ver
  `docs/adr/chat-compaction-policy.md`.
- Reabrir compactacion automatica solo si la telemetria real muestra que el
  warning manual no alcanza y existe una politica reversible.

## Breakdown canonico

`astral-e2h.6` debe producir un snapshot con estos bloques:

| Bloque | Que incluye | Medicion pre-call | Medicion post-call |
|---|---|---:|---:|
| `system_static` | rol, reglas, knowledge HD, business pack, formato | exacta por tokenizer local | incluida en input total |
| `profile` | `users.profile` HD activo | exacta por tokenizer local | incluida en input total |
| `intake` | contexto de negocio | exacta por tokenizer local | incluida en input total |
| `memory` | `users.memory_md` | exacta por tokenizer local | incluida en input total |
| `transits` | snapshot de transitos usado por chat | exacta por tokenizer local | incluida en input total |
| `impact` | `analyzeTransitImpact()` serializado en prompt | exacta por tokenizer local | incluida en input total |
| `tools_schema` | schemas/descripciones de `hdTools` | estimada por serializacion estable | incluida en input total |
| `history` | mensajes seleccionados por `docs/adr/model-aware-context-policy.md` | exacta por tokenizer local | incluida en input total |
| `current_message` | ultimo mensaje de la usuaria | exacta por tokenizer local | incluida en input total |
| `response` | salida del modelo | no existe antes; usar reserva/P95 para warning | exacta via `tokens_out` |

Los porcentajes de UI deben calcularse contra el context window del modelo, no
contra tokens facturados. `cached_tokens` baja costo y latencia, pero no libera
context window.

## Contrato para `astral-e2h.6`

La implementacion debe evitar parsear strings ya armados. El prompt builder debe
exponer bloques etiquetados y el system prompt final debe seguir saliendo de esos
mismos bloques. Una unica fuente evita drift entre "lo que medimos" y "lo que se
envia al modelo".

Shape conceptual:

```ts
interface ContextBudgetBlock {
  id:
    | "system_static"
    | "profile"
    | "intake"
    | "memory"
    | "transits"
    | "impact"
    | "tools_schema"
    | "history"
    | "current_message"
    | "response";
  tokens: number;
  percentOfWindow: number;
}

interface ContextBudgetSnapshot {
  model: string;
  provider: "openai" | "anthropic" | "unknown";
  contextWindowTokens: number | null;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
  estimatedTotalTokens: number;
  percentUsed: number | null;
  blocks: ContextBudgetBlock[];
  postCall?: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    calibrationRatio: number | null;
  };
}
```

Unknown model no debe inventar un context window. Si `CHAT_MODEL` no esta en el
registry local, el endpoint debe devolver `contextWindowTokens: null` y la UI no
debe mostrar warning porcentual.

## Thresholds de producto

Para `.7`, los thresholds deben ser multi-factor:

- porcentaje estimado del context window;
- crecimiento del historial;
- si el selector omitio historial (`context_breakdown_json.selection.omittedMessageCount`)
  y por que (`selection.reason`);
- si `memory` o `history` dominan el budget;
- si el ultimo post-call mostro calibration drift fuerte.

No disparar banner solo por caracteres ni por numero de mensajes. Eso recrearia
la heuristica arbitraria que esta epic quiere evitar.

## Implicancias de costo

Pre-call local con `js-tiktoken` tiene costo de CPU bajo frente a una llamada
LLM. El overhead aceptable para `.6` es tokenizar solo cuando se arma el turn de
chat o cuando el endpoint de budget se consulta explicitamente; no tokenizar en
loops de render ni en cada keystroke.

Anthropic Count Tokens agrega una llamada de red. Por eso solo se usa si el
provider activo es Anthropic y el valor de precision pre-call justifica la
latencia. Para OpenAI V1, local estimate + post-call authoritative es suficiente.

## Alternativas descartadas

### Solo post-call

Simple, pero llega tarde: sirve para analytics y costo, no para avisar antes de
que el usuario choque contra contexto.

### Solo pre-call local

Barato y rapido, pero falso como fuente de billing. Con tools, multi-step y
providers distintos, el riesgo de subestimar es real.

### Count Tokens remoto en cada turn para todos los providers

Mas preciso, pero mete latencia y falla adicional en el path critico. No se
justifica para OpenAI V1 mientras post-call ya calibra.

### Auto-compact inmediato

Prematuro. Astral ya tiene `memory_md`, seleccion bounded de historial y poca
data real de conversaciones que toquen el limite. Primero medir, despues automatizar. El ADR
de politica de compactacion descarta ademas cualquier compactacion destructiva
en V1.

## Fuentes primarias consultadas

- [OpenAI Cookbook: How to count tokens with tiktoken](https://cookbook.openai.com/examples/how_to_count_tokens_with_tiktoken)
- [OpenAI docs: Prompt caching](https://platform.openai.com/docs/guides/prompt-caching)
- [Anthropic docs: Token counting](https://docs.anthropic.com/en/docs/build-with-claude/token-counting)
- [Anthropic docs: Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Vercel AI SDK docs: generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text)
- [Vercel AI SDK docs: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text)
- [Anthropic docs: Claude Code slash commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
- [OpenAI Codex CLI docs](https://developers.openai.com/codex/cli)
