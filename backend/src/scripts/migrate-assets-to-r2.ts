/**
 * One-shot migration: upload every asset row that still lives in the BLOB
 * column to R2 and update its storage_key.
 *
 * Idempotent — only touches rows where storage_key IS NULL AND length(data) > 0.
 * Safe to re-run after a partial failure.
 *
 * Usage:
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... \
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *     node --import tsx/esm src/scripts/migrate-assets-to-r2.ts
 */

import { initDb, listUnmigratedAssets, markAssetMigratedToR2 } from "../db.js";
import {
  buildAssetKey,
  inferExtensionFromFile,
  isR2Configured,
  putObject,
} from "../storage/r2.js";

async function main() {
  if (!isR2Configured()) {
    console.error(
      "R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and re-run.",
    );
    process.exit(1);
  }

  await initDb();

  const pending = await listUnmigratedAssets();
  console.log(`Found ${pending.length} asset(s) to migrate.`);

  let migrated = 0;
  let failed = 0;

  for (const asset of pending) {
    const ext = inferExtensionFromFile(asset.filename, asset.mime_type);
    const storageKey = buildAssetKey(asset.user_id, asset.id, ext);

    try {
      await putObject({
        key: storageKey,
        body: asset.data,
        contentType: asset.mime_type,
      });
      await markAssetMigratedToR2(asset.id, storageKey);
      migrated += 1;
      console.log(`  ✓ ${asset.id} → ${storageKey} (${asset.size_bytes} bytes)`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${asset.id} failed:`, error);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}. Failed: ${failed}.`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
