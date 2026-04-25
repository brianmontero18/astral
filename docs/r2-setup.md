# Cloudflare R2 — Setup para Astral

Astral guarda los bodygraphs y demás assets de usuario en **Cloudflare R2** (object storage S3-compatible). Este documento cubre el setup inicial y la migración del BLOB legado en libsql/Turso.

## Por qué R2

- Free tier de 10 GB + 1M reads/mes, después $0.015/GB.
- API S3-compatible → cliente estándar (`@aws-sdk/client-s3`).
- Cero egress fees (a diferencia de AWS S3).
- CDN-friendly: podés servir directo desde un dominio público de R2 cuando quieras optimizar.

## El código en producción

`backend/src/storage/r2.ts` expone `putObject`, `getObject`, `deleteObject`. La función `isR2Configured()` chequea las 4 env vars al vuelo. Si **no** están seteadas, `createAsset`/`getAsset`/`deleteAsset` en `db.ts` siguen usando la columna BLOB legada — el deploy no se rompe si todavía no configuraste R2.

## Setup paso a paso

### 1. Crear bucket en Cloudflare

1. https://dash.cloudflare.com → R2 Object Storage
2. **Create bucket** → nombre: `astral-assets` (o el que prefieras)
3. Default settings (region "Automatic" está bien)

### 2. Crear API token

1. R2 → **Manage R2 API Tokens** → **Create API token**
2. Name: `astral-backend-prod`
3. Permissions: **Object Read & Write**
4. Specify bucket: **Apply to specific buckets only** → seleccionar `astral-assets`
5. TTL: forever
6. Create → te muestra **Access Key ID** y **Secret Access Key** **una sola vez**. Copiá ambos a tu password manager.
7. Copiá también el **Account ID** (visible en el sidebar de R2 dashboard, formato `1234abcd5678efgh`)

### 3. Configurar Render

En tu service `astral-s1xp` → **Environment** → Add Environment Variable. Agregá las 4:

```
R2_ACCOUNT_ID=<tu account id>
R2_ACCESS_KEY_ID=<el access key id de paso 2.6>
R2_SECRET_ACCESS_KEY=<el secret access key de paso 2.6>
R2_BUCKET_NAME=astral-assets
```

Save → Render redespliega automáticamente.

### 4. Migrar el asset legado (uno-shot)

Para mover el bodygraph que ya tenés en la columna BLOB de Turso hacia R2, corré la migración:

```bash
# Local, con las mismas creds de prod:
cd backend
npm run migrate:assets-to-r2
```

Output esperado:
```
Found 1 asset(s) to migrate.
  ✓ <asset-id> → users/<user-id>/assets/<asset-id>.pdf (xxxxx bytes)

Done. Migrated: 1. Failed: 0.
```

El script es **idempotente**: solo procesa rows con `storage_key IS NULL AND length(data) > 0`. Si lo corrés dos veces, la segunda no hace nada.

### 5. Verificar

Cargá `https://astral.soydanielamedina.com/`, andá al onboarding, y abrí tu bodygraph. Si descarga normal → migración OK.

En logs de Render no debería haber errores. En la DB, ahora:

```sql
SELECT id, filename, length(data) AS blob_size, storage_key FROM assets;
```

Vas a ver:
- `blob_size = 0` (placeholder)
- `storage_key = users/<user-id>/assets/<asset-id>.pdf`

## Observabilidad

- **Cloudflare R2 dashboard** → tu bucket → tab "Metrics" para ver requests + storage usage.
- **Logs del backend en Render**: cualquier error de R2 (timeouts, 4xx) aparece como `console.error("[deleteAsset] R2 delete failed for ...")` o, en upload/download, propagado en el response al cliente.

## Pendientes futuros (no en este PR)

- **Drop column `data`** de `assets` después de validar que todos los assets están en R2 (segundo PR — requiere table rebuild en SQLite).
- **Signed URLs / direct serving**: hoy los downloads pasan por el backend Fastify (proxy). Más adelante se puede generar signed URL y redirigir, o usar el dominio público de R2 con un CNAME → menor latencia + caché de Cloudflare.
- **Lifecycle rules**: borrar uploads orfanados (> 30 días, sin row en DB) automáticamente desde R2.

## Costos esperados

Para el volumen actual de Astral (1 user, ~500KB de bodygraph):
- Storage: prácticamente $0 (queda muy lejos de los 10 GB free)
- Requests: prácticamente $0 (queda muy lejos de los 1M/mes free)

El día que tengas 1000 users con un bodygraph de 1MB cada uno = 1GB → todavía free.
