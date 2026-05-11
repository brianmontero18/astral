# Tránsitos v2 — Plan técnico

Estado: Propuesto
Fecha: 2026-05-09
Documento padre: `docs/transits-time-selector-adr.md`

## Objetivo

Implementar la nueva experiencia de tránsitos sin romper la vista ni los tests
actuales. La app debe poder consumir un contrato desacoplado de UI, con soporte
para:

- `Hoy/Ahora` como default.
- Slider horario del día.
- `Próximos 7 días` como vista secundaria.
- Centros activados, condicionados y temporalmente definidos como hechos
  semánticos.
- Chat usando "ahora" o la hora seleccionada desde el slider.

## Decisión de endpoints

### Mantener endpoint legacy

`GET /api/transits` queda vivo y compatible mientras exista UI/tests que dependan
del shape actual:

```text
{ fetchedAt, weekRange, planets, activatedChannels, impact? }
```

No usarlo para construir la nueva UI. Solo mantenerlo como compatibilidad
temporal y fallback durante la migración.

### Crear endpoint nuevo

Crear `GET /api/transits/experience`.

Motivo: evita romper consumidores actuales y permite introducir un contrato v2
semántico sin forzar el shape semanal legacy.

Query params:

| Param | Requerido | Valores | Uso |
|---|---:|---|---|
| `mode` | sí | `today` / `next7Days` | Selecciona experiencia. |
| `timeZone` | sí | IANA TZ | Día local y labels correctos. |
| `clientNow` | sí | epoch ms | Foto "Ahora" desde la hora real del usuario. |
| `selectedAt` | no | epoch ms | Hora elegida desde slider o deep-link. |
| `includeTimeline` | no | `true` / `false` | Para `today`, incluye 24 muestras horarias. |

Reglas:

- `mode=today&includeTimeline=false`: devuelve una foto exacta de `selectedAt`
  si existe; si no, de `clientNow`.
- `mode=today&includeTimeline=true`: devuelve la foto seleccionada + 24 muestras
  horarias del día local.
- `mode=next7Days`: devuelve un único panorama rolling del rango visible. Debe
  marcar `range.step = "panorama"` y no incluir snapshots `day:*` ni
  `dayKeyFacts`.
- Si `timeZone` es inválido, responder `400 invalid_time_zone`.
- Si `clientNow/selectedAt` no son timestamps válidos, responder
  `400 invalid_time`.

## Contrato API

Respuesta conceptual:

```ts
interface TransitExperienceResponse {
  version: "transits.v2";
  mode: "today" | "next7Days";
  timeZone: string;
  generatedAt: string;
  selectedAt: string;
  range: {
    kind: "today" | "next7Days";
    label: string;
    startsAt: string;
    endsAt: string;
    step: "now" | "hour" | "day" | "panorama";
  };
  selectedSnapshotId: string;
  snapshots: TransitSnapshot[];
}
```

Cada `TransitSnapshot` contiene:

- `collective`: hechos del tránsito colectivo.
- `personal?`: hechos personalizados si la sesión está linked + onboarding
  complete.

Hechos mínimos requeridos:

- planetas con puerta/línea para detalle técnico;
- puertas activadas;
- canales activados con `id`, `name`, gates y centros;
- centros activados;
- centros condicionados;
- centros temporalmente definidos;
- puertas reforzadas;
- canales personales;
- canales educacionales.

Importante: `activatedCenters` y `temporarilyDefinedCenters` son campos
distintos. Un centro no queda "definido" por una puerta aislada.

## Chat

Extender `POST /api/chat` y `POST /api/chat/stream` con body opcional:

```ts
interface TransitChatContext {
  source: "transitScreen";
  mode: "today" | "next7Days";
  snapshotId: string;
  targetAt: string;
  timeZone: string;
}
```

Reglas:

- Si `transitContext` no llega, chat usa `clientNow/serverNow` como "Ahora".
- Si llega `transitContext`, chat calcula el tránsito para `targetAt` y esa
  `timeZone`.
- `mode=today` acepta snapshots `instant:*` u `hour:*`; `mode=next7Days` acepta
  solo `panorama:*`.
- No confiar en texto prefill para determinar hora de tránsito.
- Guardar `transits_used` como el `targetAt/calculatedAt` efectivo que recibió
  el LLM.

## Modelo de datos

### No cambiar

No modificar:

- `users.profile`
- `users.profile_asset_id`
- `assets`
- `hd_reports`
- `chat_messages`
- `memory_md`

El impacto personalizado sigue siendo derivado por request desde
`users.profile`. No se persiste impacto por usuario.

### Agregar cache v2

Agregar tabla nueva para cache colectivo v2:

```sql
CREATE TABLE IF NOT EXISTS transit_snapshots_cache (
  cache_key   TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK(kind IN ('instant','hour','day','panorama')),
  time_zone   TEXT NOT NULL,
  target_at   TEXT NOT NULL,
  data        TEXT NOT NULL CHECK(json_valid(data)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Motivo:

- `transit_cache.week_key` está atado semánticamente al endpoint semanal legacy.
- Reusar esa columna para horas/días sería barato pero confuso.
- La tabla nueva permite versionar cache keys sin tocar consumidores actuales.

Cache key recomendado:

```text
transits.v2|{timeZone}|{kind}|{bucketIso}
```

Reglas de cache:

- Cachear solo tránsito colectivo.
- Nunca cachear `personal`.
- `instant` para "Ahora" puede omitirse o cachearse por minuto; recomendación MVP:
  no cachear "Ahora" exacto, sí cachear muestras horarias.
- `hour` usa bucket local por hora.
- `panorama` usa bucket por inicio del día local del rango visible.

## Refactor backend esperado

Crear helpers sin borrar los actuales:

- `calculateTransitSnapshot(targetAt, timeZone)`.
- `getTransitSnapshotCached(kind, targetAt, timeZone)`.
- `buildTransitExperience(input, user?)`.
- `analyzeTransitExperienceImpact(snapshot, profile)`.

Mantener `fetchWeeklyTransits` y `getTransitsCached` hasta que `/api/transits`
se retire.

## Refactor frontend esperado

Crear una capa nueva entre API y UI:

```text
api/transits client
  → TransitExperienceAdapter
  → TransitScreenModel
  → TransitViewer presentational components
```

Reglas:

- `TransitViewer` no importa `fetchTransits`.
- `TransitViewer` no recibe `UserProfile`.
- `TransitViewer` no calcula impacto ni centros.
- Los componentes renderizan `TransitScreenModel` y emiten eventos.
- El contenedor decide fetch, selected time, refresh y navegación a chat.

## Migración segura

1. Agregar endpoint v2 + tests backend sin tocar UI.
2. Agregar adapter + unit tests frontend.
3. Reemplazar `TransitViewer` por contenedor + componentes presentacionales.
4. Extender chat con `TransitChatContext`.
5. Actualizar E2E.
6. Mantener `/api/transits` hasta que no existan consumidores.

## Acceptance criteria técnicos

- `GET /api/transits` sigue pasando tests existentes.
- `GET /api/transits/experience?mode=today` devuelve una foto exacta de
  `clientNow`.
- `includeTimeline=true` devuelve 24 muestras horarias además de la foto
  seleccionada.
- `mode=next7Days` devuelve `range.step = "panorama"` en MVP.
- No se persiste impacto personalizado en DB.
- Chat directo usa "Ahora"; chat desde slider usa `TransitChatContext.targetAt`.
- Los componentes visuales no importan API client ni tipos domain/API crudos.

## Fuera de alcance

- Bodygraph visual coloreado.
- Auto-refresh silencioso.
- Cache personalizado por usuario.
- Nueva dependencia de state management.
- Retirar `/api/transits` legacy en este slice.
