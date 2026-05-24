# Analisis economico de modelos LLM

Fecha: 2026-05-24
Bead: `astral-e2h.9`
Input principal: `docs/adr/model-selection-2026.md`

## Resumen ejecutivo

Con el uso real actual, el costo LLM no es el problema economico inmediato:
`chat_stream` cuesta en promedio USD 0.002316 por turno con `gpt-4o-mini`, y
la usuaria premium activa p90 uso 9 mensajes en los ultimos 90 dias. El riesgo
aparece al mirar los limites maximos del contrato vigente: `basic=120` y
`premium=300` mensajes/mes.

Con el contrato actual de mensajes fijos, `gpt-4o-mini` soporta los limites con
margen sano incluso si una usuaria usa todo su cupo. `gemini-2.5-flash` tambien
parece economicamente viable como challenger. `gpt-5.4-mini` puede entrar en un
plan premium de USD 39 si mejora calidad de forma medible. `claude-sonnet-4-6`,
`gpt-4o` y `gpt-5.5` no deben ser defaults globales con el pricing/contrato
actual: requieren escalamiento premium, creditos o precio mayor.

La decision de pasar de mensajes a creditos/tokens pertenece a `astral-sg3`.
Esta task no cambia pricing; deja numeros para que `astral-sg3` lo decida con
data real.

## Guardrail de datos

No se ejecutaron smokes ni evals live contra proveedores LLM para este analisis.
No se consumieron tokens reales de OpenAI/Anthropic/Gemini/Groq/Together.

Los datos de produccion usados son agregados read-only de Turso:

- `llm_calls`: route, model, tokens, cached tokens, costo y latencia.
- `chat_messages`: conteo por rol y usuario, sin leer contenido.
- `users`: plan/status/onboarding/access_source.
- `hd_reports`: tier, tokens y costo.

## Contrato de producto vigente

Fuente: `docs/freemium-spec.md` y `frontend/src/chat-limits.ts`.

| Plan | Mensajes/mes | Report access | Estado comercial |
|---|---:|---|---|
| `free` | 20 | base | implementado |
| `basic` | 120 | base | implementado, provision manual/admin |
| `premium` | 300 | base + premium | implementado, provision manual/admin |

No hay payment gateway en V1. `docs/admin-invite-runbook.md` dice
explicitamente que basic/premium se provisionan manualmente mientras no hay
gateway. Por lo tanto, no se puede afirmar margen real cobrado desde el repo.
Para sensibilidades se usan los placeholders de `docs/credits-pricing-intent.md`
solo como escenarios:

- Basic: USD 19/mes.
- Pro/Premium: USD 39/mes.

## Uso real observado

Ventana: ultimos 90 dias.

### Llamadas LLM por route

| Route | Modelo | Calls | Users | tokens_in p50/p90/p99 | tokens_out p50/p90/p99 | costo avg | costo p90 | latencia p50/p90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| `chat_stream` | `gpt-4o-mini` | 47 | 6 | 13,231 / 16,722 / 18,671 | 727 / 1,204 / 1,283 | 0.002316 | 0.002896 | 24.1s / 57.1s |
| `memory_writer` | `gpt-4o-mini` | 20 | 6 | 2,344 / 3,993 / 4,677 | 411 / 684 / 873 | 0.000642 | 0.000942 | 8.1s / 15.2s |
| `chat` | `gpt-4o-mini` | 1 | 1 | 16,886 | 834 | 0.003033 | 0.003033 | 34.1s |
| `mcp_ask` | `gpt-4o-mini` | 1 | 1 | 10,537 | 870 | 0.002103 | 0.002103 | 65.7s |

Lectura: el turno tipico real coincide con la ADR de modelos: ~13K input y
~600-700 output. El cache hit todavia es bajo en produccion reciente
(`chat_stream` cached avg 1,236 tokens, p50 0), asi que los escenarios
economicos usan costo sin cache como base conservadora.

### Usuarios activos y planes

| Segmento | Users |
|---|---:|
| Total users | 13 |
| Activos con chat/costo LLM en 90 dias | 6 |
| Premium activos en 90 dias | 5 |
| Free activos en 90 dias | 1 |

Breakdown total de users:

| Plan/status/onboarding/source | Users |
|---|---:|
| `premium/active/complete/manual` | 4 |
| `premium/active/pending/manual` | 7 |
| `premium/active/complete/self` | 1 |
| `free/active/complete/self` | 1 |

Uso por plan entre activos:

| Plan | Users activos | user messages p50/p90/max | costo LLM 90d p50/p90/max | tokens 90d p50/p90/max |
|---|---:|---:|---:|---:|
| `premium` | 5 | 6 / 9 / 9 | 0.018124 / 0.045249 / 0.045249 | 109,968 / 276,991 / 276,991 |
| `free` | 1 | 7 / 7 / 7 | 0.021465 / 0.021465 / 0.021465 | 116,843 / 116,843 / 116,843 |

Lectura: el uso actual esta muy por debajo del cap. El analisis de margen debe
mirar escenarios de cupo completo porque ahi vive el riesgo, no en el uso beta.

### Reportes

| Tier | Reports 90d | costo total | costo promedio | tokens promedio |
|---|---:|---:|---:|---:|
| `premium` | 3 | 0.004854 | 0.001618 | 4,590 |
| `free` | 2 | 0.000525 | 0.000263 | 787 |

Los reportes actuales son economicamente irrelevantes frente a chat, salvo que
se cambie a modelos frontier/report-premium.

## Modelo de costos

Base conservadora por mensaje:

```text
costo chat_stream por modelo
+overhead memory_writer observado por mensaje
```

El overhead de `memory_writer` observado es:

```text
20 memory_writer calls / 47 chat_stream calls * USD 0.000642 = ~USD 0.000273 por mensaje
```

No se incluye costo fijo de Render/Turso/Auth porque el bead analiza modelo LLM.
`astral-sg3` menciona Render ~USD 7/mes y resto free/simbolico; con precios de
USD 19/39 ese fijo lo cubre un solo usuario pago, pero no cambia la decision de
modelo.

## Costo por cupo completo

Escenario: todos los mensajes del mes usan el modelo indicado para chat; memory
writer queda en `gpt-4o-mini`. No incluye report premium.

| Modelo chat | Costo/mensaje | Basic 120 msg | Premium 300 msg | Precio requerido para 80% gross margin Basic | Precio requerido para 80% gross margin Premium |
|---|---:|---:|---:|---:|---:|
| `gpt-4o-mini` | 0.002589 | 0.31 | 0.78 | 1.55 | 3.88 |
| Groq `openai/gpt-oss-120b` | 0.002589 | 0.31 | 0.78 | 1.55 | 3.88 |
| `gemini-2.5-flash` | 0.005673 | 0.68 | 1.70 | 3.40 | 8.51 |
| `gpt-5.4-mini` | 0.012723 | 1.53 | 3.82 | 7.63 | 19.08 |
| `gpt-4o` | 0.038773 | 4.65 | 11.63 | 23.26 | 58.16 |
| `claude-sonnet-4-6` | 0.048273 | 5.79 | 14.48 | 28.96 | 72.41 |
| `gpt-5.5` | 0.083273 | 9.99 | 24.98 | 49.96 | 124.91 |

## Margen bajo escenarios de precio

Los precios son placeholders de `docs/credits-pricing-intent.md`, no contrato.

### Basic a USD 19

| Modelo chat | Costo al usar 120/120 mensajes | Gross margin |
|---|---:|---:|
| `gpt-4o-mini` | 0.31 | 98.4% |
| Groq `openai/gpt-oss-120b` | 0.31 | 98.4% |
| `gemini-2.5-flash` | 0.68 | 96.4% |
| `gpt-5.4-mini` | 1.53 | 92.0% |
| `gpt-4o` | 4.65 | 75.5% |
| `claude-sonnet-4-6` | 5.79 | 69.5% |
| `gpt-5.5` | 9.99 | 47.4% |

### Premium/Pro a USD 39

| Modelo chat | Costo al usar 300/300 mensajes | Gross margin |
|---|---:|---:|
| `gpt-4o-mini` | 0.78 | 98.0% |
| Groq `openai/gpt-oss-120b` | 0.78 | 98.0% |
| `gemini-2.5-flash` | 1.70 | 95.6% |
| `gpt-5.4-mini` | 3.82 | 90.2% |
| `gpt-4o` | 11.63 | 70.2% |
| `claude-sonnet-4-6` | 14.48 | 62.9% |
| `gpt-5.5` | 24.98 | 36.0% |

## Breakeven por usuario

Como no hay gateway, esto usa los mismos escenarios placeholder de USD 19/39.
La tabla muestra cuantos mensajes podria consumir una usuaria antes de que el
costo LLM iguale todo el ingreso mensual de ese plan. No es el limite
recomendado; es el punto donde el margen bruto LLM llega a 0%.

| Modelo chat | Basic USD 19 breakeven messages | Premium USD 39 breakeven messages |
|---|---:|---:|
| `gpt-4o-mini` | 7,338 | 15,063 |
| Groq `openai/gpt-oss-120b` | 7,338 | 15,063 |
| `gemini-2.5-flash` | 3,349 | 6,875 |
| `gpt-5.4-mini` | 1,493 | 3,065 |
| `gpt-4o` | 490 | 1,006 |
| `claude-sonnet-4-6` | 394 | 808 |
| `gpt-5.5` | 228 | 468 |

Lectura: con `gpt-4o-mini`, `gemini-2.5-flash` o `gpt-5.4-mini`, los caps
vigentes quedan lejos del breakeven teorico. Con `gpt-4o`, Sonnet o `gpt-5.5`,
premium todavia entra en el cap de 300, pero basic pierde margen sano y queda
sin espacio para fixed costs, payment fees, soporte o uso no-chat.

## Report economics

El report premium actual cuesta ~USD 0.001618 con `gpt-4o-mini`.
Usando el split inferido por costo/tokens observados (~2,525 input y ~2,065
output por report premium), el costo estimado por modelo seria:

| Modelo report | Costo/report premium estimado | Uso recomendado |
|---|---:|---|
| `gpt-4o-mini` | 0.0016 | default actual |
| `gpt-5.4-mini` | 0.0112 | viable si mejora calidad |
| `gemini-2.5-pro` | 0.0238+ | premium/escalamiento |
| `claude-sonnet-4-6` | 0.0386 | premium/escalamiento |
| `gpt-5.5` | 0.0746 | solo retry/premium alto |

Report no mueve la aguja economica con el volumen actual. El riesgo de report
es calidad y parsing, no margen, salvo que se generen multiples reportes largos
por mes o se agreguen modelos frontier.

## Decision

1. **Mantener `gpt-4o-mini` como default economico para chat, report y
   memory_writer.** El costo soporta basic/premium aun con cupo completo.
2. **No cambiar a `gpt-4o`, `claude-sonnet-4-6` ni `gpt-5.5` como default
   global.** En basic erosionan margen o directamente fuerzan un precio mayor.
3. **`gpt-5.4-mini` es economicamente viable solo si el plan pago ronda
   USD 39 o si se usa por escalamiento/routing, no como upgrade ciego para todos
   los turns.**
4. **`gemini-2.5-flash` es el mejor challenger economico de los modelos grandes
   baratos**, pero necesita `astral-e2h.14` antes de cualquier routing prod.
5. **El contrato por mensajes es economicamente viable con `gpt-4o-mini`, pero
   conceptualmente injusto.** Un "hola" y un analisis largo consumen el mismo
   cupo. Ese problema no se resuelve en `.9`; se escala a `astral-sg3`.

## Recomendacion para `astral-e2h.10`

No implementar routing dinamico a prod todavia.

Orden correcto:

1. `astral-e2h.14`: eval live multi-provider con consentimiento explicito antes
   de cualquier llamada real a LLM.
2. `astral-sg3`: decidir si el producto migra de mensajes a creditos.
3. `astral-e2h.10`: implementar routing solo para modelos que pasen eval y
   entren en margen segun el contrato comercial vigente.

Si `.10` avanza antes de `astral-sg3`, el unico routing economicamente seguro es
conservador:

- default `gpt-4o-mini`;
- escalamiento manual/experimental a `gpt-5.4-mini` o `gemini-2.5-flash`;
- sin Sonnet/Opus/GPT-5.5 global;
- telemetria obligatoria de `model`, `route`, razon de routing, tokens, costo y
  eval result.

## Implicacion para `astral-sg3`

Este analisis confirma la intuicion del bead de creditos:

- Mensajes/mes funciona para controlar abuso grueso.
- Mensajes/mes no modela costo ni fairness.
- Tokens reales ya existen en `llm_calls`, por lo que `astral-sg3` ya puede
  hacer el levantamiento con datos reales.

Decision de este bead: **no cambiar pricing dentro de `astral-e2h`**. Agregar
esta doc como input a `astral-sg3` y mantener la discusion de creditos ahi.

## Limitaciones

- N chico: 6 users activos y 47 `chat_stream` en 90 dias.
- Los precios USD 19/39 son placeholders, no revenue real.
- Los costos de modelos alternativos vienen de la ADR `model-selection-2026`,
  no de corridas live en Astral.
- El cache hit real reciente fue bajo; si mejora, los costos bajan.
- No se incluyo soporte humano, refunds, impuestos, payment fees ni CAC.
