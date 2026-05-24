# prod-audits

Herramientas de **lectura segura** sobre la DB y los assets de producción de Astral.

Usalo cuando necesites diagnosticar el estado de prod sin tocar dev — por ejemplo:
auditar el data fix de una usuaria puntual, encontrar usuarias con data inconsistente,
o validar que un PDF subido coincide con el `profile.humanDesign` que tiene en DB.

Los scripts son **schema-agnostic**: descubren columnas y tablas via
`pragma_table_info` y `sqlite_master`. Si mañana agregás columnas o tablas, los
ejemplos siguen funcionando sin tocar nada.

## Setup (una sola vez)

1. Crear `backend/.env.production` (gitignored) con este contenido:

```
# Turso — misma DB, dos tokens
TURSO_DATABASE_URL=libsql://<your-db>.turso.io

# Token read-only generado en turso.tech → DB → Tokens (Permissions: Read-Only)
TURSO_AUTH_TOKEN_READ=

# Token full access generado aparte (Permissions: Full Access)
TURSO_AUTH_TOKEN_WRITE=

# Cloudflare R2 — generá un API token de R2 (no es el Cloudflare API token general)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=astral-assets

# Solo si un script ejerce extracción de PDF
OPENAI_API_KEY=
```

2. Generar los dos tokens Turso desde el dashboard: uno con permisos read-only,
   otro con full access. **Que sean tokens distintos** — la separación es lo que
   hace que un script en modo `read` no pueda escribir aunque algo se rompa.

3. Generar el R2 API token en el dashboard de Cloudflare R2 (NO el "Cloudflare
   API Token" general — son sistemas de auth distintos).

## Cómo correr los ejemplos

Desde `backend/`:

```bash
# Overview de todos los users
./node_modules/.bin/tsx scripts/prod-audits/examples/users-overview.ts

# Deep dive de un user específico
./node_modules/.bin/tsx scripts/prod-audits/examples/user-detail.ts foo@bar.com

# Últimos chat_stream con tokens/cache/tools de un user
./node_modules/.bin/tsx scripts/prod-audits/chat-tokens-detail.ts foo@bar.com 12

# Patrones de data inconsistente
./node_modules/.bin/tsx scripts/prod-audits/examples/find-anomalies.ts
```

## Query útil: chat sin tools en las últimas 24h

```sql
SELECT created_at, route, model, tokens_in, tokens_out, cached_tokens,
       tool_calls_count, tool_calls_json, latency_ms, prompt_hash
FROM llm_calls
WHERE user_id = ?
  AND route IN ('chat', 'chat_stream', 'mcp_ask')
  AND created_at > datetime('now', '-24 hours')
  AND tool_calls_count = 0
ORDER BY created_at DESC;
```

Si aparece una respuesta con claims puerta/canal/centro y `tool_calls_count = 0`,
hay que revisar el prompt o el tool-call loop: el modelo contestó sin consultar
la fuente determinística.

## Garantías de seguridad

- **Read-only por default**: `createProdClient()` y `createProdClient("read")`
  devuelven un cliente que usa el token read-only. Como cinturón, el wrapper
  inspecciona cada SQL y rechaza `UPDATE/DELETE/INSERT/DROP/etc`. Las
  transacciones también están bloqueadas (son superficie de escritura).
- **Write requiere opt-in explícito**: `createProdClient("write")` usa el otro
  token e imprime un banner grande en stderr la primera vez que se invoca.
- **R2 reutiliza el adapter del backend**: importa `src/storage/r2.ts` con
  credenciales del .env.production cargado en `prod-env.ts`.
- **`.env.production` es gitignored**: no se commitea por accidente.

## Convenciones

- Todo script debe importar `../lib/prod-env.js` **antes** que cualquier otra
  cosa de la lib. Eso garantiza que las env vars de prod están cargadas antes
  de que `createProdClient` o `getProdObject` se ejecuten.
- Los archivos `_tmp-*.ts` (one-off ad-hoc) viven en `scripts/_tmp-*.ts`
  fuera de esta carpeta y se borran al final de cada sesión.
- Si un script de auditoría es genuinamente reutilizable, va en `examples/`.

## Para agregar un nuevo ejemplo

1. Crear `examples/mi-script.ts`.
2. Primera línea: `import "../lib/prod-env.js";`
3. Después: `import { createProdClient } from "../lib/prod-db.js";`
4. Para R2: `import { getProdObject } from "../lib/prod-r2.js";`
5. Hacé tus queries normales. Cerrá el cliente al final con `await client.close()`.

## Para una operación de write contra prod

NO hagas un script reutilizable de write. Para writes:

1. Creá un script one-off en `backend/scripts/_tmp-fix-<algo>.ts` (no en `prod-audits/`).
2. Importá `../prod-audits/lib/prod-env.js` y `createProdClient("write")`.
3. Envolvé la mutación en `await client.transaction("write")` con pre-state guards
   y verificación post-state.
4. Borrá el archivo al cerrar la sesión.
