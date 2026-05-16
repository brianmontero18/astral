# Chat v2 — plan de roll-out (Vercel AI SDK + HD tools)

Documenta cómo activar el path nuevo del chat en producción, con qué
métricas medir, y cómo hacer rollback si algo se rompe.

Bead: `astral-owv`. Branch: `feature/refactor-design-ai-model`.

## Qué es chat v2

Un path paralelo al chat actual que reemplaza la llamada `fetch` directa
a OpenAI por el Vercel AI SDK con herramientas HD registradas
(`findChannelByGates`, `findChannelsByGate`, `findChannelById`,
`getCenterForGate`, `listAllChannels`).

El LLM consulta la tabla canónica de los 36 canales como tool en lugar
de leerla inline en el prompt. Resultado medido localmente: 5/5 PASS
en el caso Daniela 2026-05-15 con `gpt-4o-mini` (antes: 2/5 con el
mismo modelo y la tabla inline; 4/4 con `gpt-4o` a 17x el costo).

## Estado de los flags

| Variable | Default | Efecto |
|---|---|---|
| `FEATURE_CHAT_USE_TOOLS` | `false` | OFF: usa el path legacy (`agent-service.ts`). ON: usa el path v2 (`agent-service-v2.ts`) con tools |
| `CHAT_MODEL` | `gpt-4o-mini` | Modelo del chat. Cualquier modelo de OpenAI compatible con tool use anda. No tocar salvo que haya razón |

## Etapas del roll-out

### Etapa 0 — merge con flag OFF (día 0)

Merge a `main` con `FEATURE_CHAT_USE_TOOLS=false` (o sin setear la var,
que es lo mismo). Producción se mantiene 1:1 como hoy.

Validación previa al merge:
- `npm run test` (backend) — 449/449 verde.
- `npm run check` — `tsc --noEmit` sin errores.
- `npm run smoke:chat-v2 -- 5` — 5/5 PASS contra OpenAI real.

### Etapa 1 — habilitar para admin (día 1)

Cambio en Render: `FEATURE_CHAT_USE_TOOLS=true`. Redeploy.

Como el resto del producto no cambia y solo afecta el chat, el blast
radius es chico. Como la cuenta admin usa el mismo chat que los users
finales, esto sirve a la vez de canary y de validación operativa.

Observar durante 24-48hs:
- `chat_messages` recientes del admin: ¿menciones de canales son
  correctas? Pasar 2-3 prompts del corpus problemático para confirmar.
- `llm_calls` con route `chat_stream`: ¿latencia P95 sigue aceptable
  (<20s)? ¿`cached_tokens` se prende a partir del 2do turn?

Decisión: si todo OK, pasar a Etapa 2.

### Etapa 2 — 100% de los users (día 3-5)

Astral está en beta con ~10 users. No tiene sentido un canary parcial
con `userId.slice(-1) === '0'` — la cohorte es muy chica. Pasar
directo a 100% una vez que la admin testing confirmó.

Observar durante 1 semana:
- `chat_messages` con feedback negativo (`feedback_thumb='down'`):
  cualquier mención de bug HD debería ahora estar ausente.
- Costo agregado por día (query a `llm_calls` por `route='chat_stream'`):
  esperá -50% a -70% input cost por turn una vez que el cache se calienta.

### Etapa 3 — cerrar el bead

Cuando los criterios de cierre se cumplen (ver abajo), cerrar
`astral-owv`. Considerar:

- Si v2 anda bien por 2+ semanas: eventualmente borrar el path v1
  (legacy `runAstralAgent` / `runAstralAgentStream` en
  `agent-service.ts`). No hay urgencia — el código v1 vive ~250 líneas y
  no molesta.

## Criterios de cierre

| Métrica | Threshold |
|---|---|
| Smoke `npm run smoke:chat-v2 -- 5` | PASS rate ≥ 5/5 sostenido en 3 corridas distribuidas (mañana, tarde, noche) |
| Tasa de feedback negativo sobre HD | 0 reportes de canales/centros mal asociados en 7 días |
| Latencia P95 `chat_stream` (`llm_calls`) | < 20 s |
| `cached_tokens / tokens_in` promedio (turn N≥2, ventana 5-10 min) | > 0.5 |
| Costo agregado diario `chat_stream` vs el mismo período de la semana anterior | -40% a -70% input cost por turn |

## Cómo medir

### Smoke local (recomendado antes de cada cambio sustantivo del prompt)

```bash
cd backend
npm run smoke:chat-v2          # 5 runs default
npm run smoke:chat-v2 -- 10    # custom N
```

Cada run cuesta ~$0.002. Exit code 0 si todos PASS, 1 si alguno FAIL,
2 si hay error de setup.

### Telemetría de producción

```sql
-- Cache hit rate por route, últimos 7 días.
SELECT
  route,
  COUNT(*)                                  AS calls,
  AVG(tokens_in)                            AS avg_tokens_in,
  AVG(cached_tokens)                        AS avg_cached,
  AVG(CAST(cached_tokens AS REAL) / NULLIF(tokens_in, 0)) AS cache_hit_rate,
  AVG(latency_ms)                           AS avg_latency_ms,
  SUM(cost_usd)                             AS total_cost_usd
FROM llm_calls
WHERE created_at > datetime('now', '-7 day')
GROUP BY route
ORDER BY route;
```

```sql
-- Feedback negativo sobre mensajes recientes del chat.
SELECT created_at, substr(content, 1, 200) AS preview, feedback_note
FROM chat_messages
WHERE feedback_thumb = 'down'
  AND role = 'assistant'
  AND created_at > datetime('now', '-7 day')
ORDER BY created_at DESC;
```

## Rollback

Una sola línea: cambiar `FEATURE_CHAT_USE_TOOLS` a `false` en Render y
redeploy. Producción vuelve al path legacy intacto.

El path v1 sigue en el código (`agent-service.ts`) — el flag es el
selector. No hay migración de datos involucrada; `chat_messages`,
`llm_calls` y `users.memory_md` son compatibles con ambos paths.

## Costos esperables (gpt-4o-mini)

Asumiendo system prompt v2 de ~33K chars (≈ 10K tokens):

| Escenario | Costo por turn (sin cache) | Costo por turn (con cache hit 60%) |
|---|---|---|
| Chat sin tool calls | $0.0018 | $0.0011 |
| Chat con 1-2 tool calls | $0.0022 | $0.0014 |
| Chat con 3 tool calls (extremo) | $0.0030 | $0.0019 |

Con 100 users a 10 msg/día (target de beta) ≈ $90-200/mes. Tier 1 de
OpenAI alcanza para ese volumen (TPM 200K en gpt-4o-mini, ~20x más que
gpt-4o).

## Próximos beads dependientes

- `astral-aqh` — auto-scroll del chat durante streaming. Independiente
  de v2, pero la UX mejora si va junto al deploy.
- `astral-0b7` — bug carta HD por endpoint /me/assets. Independiente.
- `astral-m25` — data fix para Daniela, Lucia, Agos, Jez, Mayra.
  Habilitado por v2 indirectamente (el chat va a responder bien una vez
  que el profile esté correcto).
