# ADR: Politica V1 mono-carta para reemplazo de bodygraph

Estado: Aceptado
Fecha: 2026-05-25
Owner: Founder
Area: Bodygraph, onboarding, chat, memory, reportes
Bead: `astral-pjc.1`

## Contexto

Astral V1 es explicitamente mono-carta: una usuaria tiene un unico profile HD
activo en `users.profile`, asociado opcionalmente a `users.profile_asset_id`.
Chat, memoria, intake, transitos, informes y Mi carta leen ese profile como
verdad canonica.

El caso Daniela mostro el riesgo de tratar V1 como si ya fuera multi-profile.
Daniela converso sobre una carta, reemplazo el bodygraph/profile por otro,
volvio a su carta original y el agente mono-thread termino mezclando contextos.
El problema no era solo un bug puntual de UI: el producto no tenia una
semantica honesta para decir que significa reemplazar la identidad HD activa en
un sistema donde el chat y la memoria son globales por usuario.

V2 (`astral-yaa`) va a modelar perfiles multiples con IDs estables,
ownership/consentimiento, permisos por perfil y posiblemente chats por profile.
Hasta que eso exista, implementar un switcher de cartas o threads separados en
V1 crea una version parcial y enganosa de V2.

## Decision

En V1, reemplazar la carta/bodygraph significa **replace consciente con wipe
atomico de todo contexto dependiente de la carta anterior**.

La politica canonica:

1. Hay una sola carta activa por user.
2. Reemplazar la carta no conserva contexto conversacional ni artefactos
   generados para la carta anterior.
3. La usuaria debe confirmar explicitamente que entiende el wipe antes de
   ejecutar el replace.
4. La operacion de backend debe ser atomica: o queda la carta nueva con su
   contexto limpio, o no cambia nada.
5. No se implementa switcher de cartas ni threads por tema en V1.

Superficies minimas que deben limpiarse o quedar invalidadas por construccion:

| Superficie | Razon |
|---|---|
| `users.profile` / `users.profile_asset_id` | Fuente canonica del bodygraph activo. |
| `users.intake` | El intake describe a la persona/proyecto asociado a esa carta. |
| `users.memory_md` | La memoria es global por usuario en V1 y puede contener facts de la carta anterior. |
| `chat_messages` | El chat es mono-thread; conservarlo mezcla scope viejo con carta nueva. |
| `hd_reports` | Los reportes se generan contra `profile_hash` de profile + intake. |
| `report_shares` | Comparten reportes; deben caer con los reportes borrados. |
| Asset HD activo anterior, si existe | No debe seguir apareciendo como carta vigente. |

`astral-pjc.2` debe auditar el codigo y cerrar la lista exacta de tablas,
archivos, storage keys, caches y endpoints afectados antes de implementar
`astral-pjc.3`. Esta ADR fija la semantica de producto; no reemplaza la
auditoria tecnica.

La politica no exige borrar telemetria operacional sin contenido visible, como
costos o conteos de `llm_calls`. Si `astral-pjc.2` detecta contenido derivado
del bodygraph anterior en alguna tabla de auditoria, debe documentarlo y
resolverlo explicitamente.

## UX obligatoria

El replace debe presentarse como una accion destructiva consciente, no como una
subida de archivo comun.

El modal/copy debe comunicar, en lenguaje de producto:

- la carta actual sera reemplazada;
- se borraran chat, memoria, intake e informes asociados a la carta anterior;
- esto evita que Astral mezcle contextos;
- si la usuaria quiere manejar varias cartas, eso pertenece a una version
  futura multi-profile.

No prometer "cambio de carta" reversible en V1. No esconder el wipe en letra
chica.

## Alternativas consideradas

### A. Mantener replace actual y confiar en invalidacion parcial

Descartada. Invalidar solo reportes o solo `profile_hash` no limpia
`chat_messages`, `memory_md` ni `intake`. Es precisamente el tipo de estado
mixto que confundio al agente en el caso Daniela.

### B. Switcher de cartas en V1

Descartada. Responde al pedido Daniela review #13, pero requiere el modelo V2:
perfiles con IDs estables, ownership, consentimiento, permisos y contexto por
perfil. Agregarlo ahora generaria deuda tecnica y una experiencia falsa.

### C. Threads multi-tema dentro de V1

Descartada. Responde al pedido Daniela review #5, pero separa temas sin separar
identidad de profile. En V1, un unico usuario + una unica carta + una unica
memoria global implica un unico chat canonico.

### D. Wipe manual por soporte/admin

Descartada como flujo principal. Puede servir para data fixes historicos, pero
no como contrato de producto. La usuaria necesita una accion consistente en la
app.

### E. Replace consciente con wipe atomico

Adoptada. Es la solucion mas simple y honesta para V1: evita contaminacion,
respeta la arquitectura actual y deja V2 libre para modelar multi-profile bien.

## Consecuencias tecnicas

- `astral-pjc.2` debe producir un inventario exhaustivo de dependencias del
  bodygraph/intake antes de tocar implementacion.
- `astral-pjc.3` debe exponer un endpoint dedicado de replace atomico, en vez
  de repartir wipes entre frontend y varios endpoints existentes.
- Los tests del backend deben probar rollback transaccional: si falla una parte
  del wipe o la persistencia nueva, no debe quedar estado intermedio.
- Los tests deben cubrir que chat, memoria, intake e informes viejos no quedan
  visibles ni inyectables despues del replace.
- El frontend (`astral-pjc.4`) debe depender del copy cerrado en
  `astral-pjc.5`; no improvisar microcopy tecnico en implementacion.
- No consumir LLM tokens reales para validar esta politica. La validacion de
  esta epic es deterministica y de estado.

## Consecuencias de producto

- Se pierde historial visible de chat al reemplazar carta. Es deliberado.
- Se pierden informes anteriores. Es deliberado porque ya no aplican a la
  carta activa.
- La usuaria puede tener friccion al reemplazar, pero esa friccion protege la
  calidad de la respuesta.
- V2 puede reintroducir multiples perfiles y conversaciones separadas con un
  modelo de datos correcto. Esta ADR no bloquea V2; evita simularlo en V1.

## Guardrails para agentes

- No implementar selector de cartas en V1.
- No implementar threads multi-tema en V1.
- No conservar `memory_md` durante replace "para ayudar continuidad"; eso
  conserva contaminacion.
- No borrar historial silenciosamente fuera del flujo de replace confirmado.
- No agregar fallback legacy ni endpoint paralelo que permita reemplazo sin
  wipe.
- No cerrar esta epic sin una prueba E2E del flow completo.

## Fuentes internas consultadas

- `AGENTS.md`
- `docs/INDEX.md`
- `docs/architecture/project-overview.md`
- `docs/architecture/chat-llm-system.md`
- `docs/architecture/refactor-2026-05-decisions.md`
- `docs/architecture/bug-investigation-daniela-2026-05.md`
- `docs/adr/chat-compaction-policy.md`
- `docs/adr/model-aware-context-policy.md`
- `backend/src/db.ts`
