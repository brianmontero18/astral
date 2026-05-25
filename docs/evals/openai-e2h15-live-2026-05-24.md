# OpenAI Live Eval — `astral-e2h.15`

Fecha: 2026-05-24
Bead: `astral-e2h.15`
Scope: OpenAI-only, sin transcribe por falta de audio fixture consentido/no sensible.

## Consentimiento y costo

El founder autorizo explicitamente una eval live con:

- maximo 67 llamadas de modelo;
- cap USD 0.74;
- modelos: `gpt-4o-mini`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.4`.

La corrida final escribio `backend/live-eval-results/openai-e2h15-1779667638485.json`.

Resultado automatico final: 59/61 PASS, costo conocido USD 0.175007.

Los 2 FAIL automaticos restantes fueron falsos negativos del scorer:

- `mcp_ask | gpt-4o-mini | invalid-12-20`: la salida decia "no se encuentra en la tabla canonica" y "no forma un canal reconocido".
- `mcp_ask | gpt-5.4-mini | invalid-12-20`: la salida decia "No existe un canal canonico 12-20" y "no forman un canal entre si".

Se corrigio el scorer para aceptar esas negaciones. No se relanzo otra corrida para evitar gasto adicional; la evidencia textual de ambos rows esta en el JSON final.

## Matriz

| Route | Model | Pass | Fail automatico | Costo USD | Latencia p50 |
|---|---|---:|---:|---:|---:|
| `chat_stream` | `gpt-4o-mini` | 8 | 0 | 0.012876 | 3616 ms |
| `chat_stream` | `gpt-5.4-mini` | 8 | 0 | 0.018260 | 2689 ms |
| `chat` | `gpt-4o-mini` | 8 | 0 | 0.014268 | 4098 ms |
| `chat` | `gpt-5.4-mini` | 8 | 0 | 0.018341 | 2839 ms |
| `mcp_ask` | `gpt-4o-mini` | 7 | 1* | 0.013583 | 6544 ms |
| `mcp_ask` | `gpt-5.4-mini` | 7 | 1* | 0.018092 | 3037 ms |
| `report` | `gpt-4o-mini` | 1 | 0 | 0.001160 | 10184 ms |
| `report` | `gpt-5.4-mini` | 1 | 0 | 0.016594 | 10691 ms |
| `report` | `gpt-5.4` | 1 | 0 | 0.060878 | 32501 ms |
| `memory_writer` | `gpt-4o-mini` | 5 | 0 | 0.000386 | 580 ms |
| `memory_writer` | `gpt-5.4-nano` | 5 | 0 | 0.000569 | 859 ms |

`*` = scorer false negative corregido post-run.

## Veredicto

`.10` puede avanzar con routing OpenAI-only, pero no debe cambiar el default global solo por esta eval.

Politica recomendada:

- `chat_stream`, `chat`, `mcp_ask`: mantener `gpt-4o-mini` como default; habilitar `gpt-5.4-mini` como candidato route-specific para premium/escalamiento si `.10` define reglas conservadoras.
- `report`: `gpt-5.4-mini` y `gpt-5.4` pasan estructura, pero `gpt-5.4` cuesta ~56x `gpt-4o-mini` en esta fixture; usarlo solo como premium/manual retry, no default.
- `memory_writer`: `gpt-5.4-nano` pasa fixtures, pero cuesta ligeramente mas que `gpt-4o-mini` en esta corrida; puede entrar como candidato, no como switch automatico.
- `transcribe`: no evaluado; no cambiar `whisper-1` sin fixture de audio consentido/no sensible.

Guardrail para `.10`: todo modelo nuevo debe permanecer en `model-registry.ts` y `pricing.ts`, y cualquier routing debe preservar telemetry por route/model/tokens/costo/latencia/tool_calls.
