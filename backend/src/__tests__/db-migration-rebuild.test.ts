/**
 * Schema rebuild migration tests.
 *
 * Exercises rebuildLegacyAssetsTableIfNeeded against three real states of the
 * `assets` table in an in-memory libsql DB:
 *  1. Legacy shape (data BLOB + nullable storage_key) with a row whose
 *     storage_key is set → must rebuild and preserve data.
 *  2. Legacy shape with a row that still has NULL storage_key → must throw
 *     loudly without modifying the table (no partial state).
 *  3. New shape already in place → must be a no-op.
 *
 * The bug that motivated this suite: the previous detection query used
 * `SELECT name, [notnull] AS notnull FROM pragma_table_info('assets')` which
 * libsql parsed as the NOTNULL operator instead of an identifier and threw
 * SQL_PARSE_ERROR at boot. Render kept the previous deploy live, but no test
 * caught it ahead of time. These tests close that gap.
 */

import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

import { rebuildLegacyAssetsTableIfNeeded } from "../db.js";

const clients: Array<Client> = [];

afterEach(() => {
  while (clients.length > 0) {
    clients.pop()?.close();
  }
});

function makeClient(): Client {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  return client;
}

async function setupUsersTable(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute(`
    CREATE TABLE users (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      profile TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await client.execute({
    sql: "INSERT INTO users (id, name) VALUES (?, ?)",
    args: ["user-1", "Test User"],
  });
}

async function createLegacyAssetsTable(client: Client) {
  await client.execute(`
    CREATE TABLE assets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      data        BLOB NOT NULL,
      size_bytes  INTEGER NOT NULL,
      storage_key TEXT DEFAULT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function createNewAssetsTable(client: Client) {
  await client.execute(`
    CREATE TABLE assets (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      file_type   TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function readAssetsColumns(
  client: Client,
): Promise<Array<{ name: string; notnull: number }>> {
  const info = await client.execute({
    sql: 'SELECT name, "notnull" FROM pragma_table_info(\'assets\')',
    args: [],
  });
  return info.rows.map((row) => ({
    name: row.name as string,
    notnull: Number(row["notnull"]),
  }));
}

describe("rebuildLegacyAssetsTableIfNeeded", () => {
  it("rebuilds the legacy assets table preserving the row and applying NOT NULL on storage_key", async () => {
    const client = makeClient();
    await setupUsersTable(client);
    await createLegacyAssetsTable(client);

    const storageKey = "users/user-1/assets/asset-1.pdf";
    await client.execute({
      sql: "INSERT INTO assets (id, user_id, filename, mime_type, file_type, data, size_bytes, storage_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        "asset-1",
        "user-1",
        "test.pdf",
        "application/pdf",
        "hd",
        Buffer.alloc(0),
        12345,
        storageKey,
        "2026-04-20 12:00:00",
        "2026-04-21 09:00:00",
      ],
    });

    await rebuildLegacyAssetsTableIfNeeded(client);

    const columns = await readAssetsColumns(client);
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).not.toContain("data");
    expect(columnNames).toContain("storage_key");

    const storageKeyColumn = columns.find((c) => c.name === "storage_key");
    expect(storageKeyColumn?.notnull).toBe(1);

    const rows = await client.execute("SELECT id, user_id, filename, size_bytes, storage_key, created_at, updated_at FROM assets");
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0]).toMatchObject({
      id: "asset-1",
      user_id: "user-1",
      filename: "test.pdf",
      size_bytes: 12345,
      storage_key: storageKey,
      created_at: "2026-04-20 12:00:00",
      updated_at: "2026-04-21 09:00:00",
    });
  });

  it("refuses to rebuild when any row has NULL storage_key and leaves the legacy table intact", async () => {
    const client = makeClient();
    await setupUsersTable(client);
    await createLegacyAssetsTable(client);

    await client.execute({
      sql: "INSERT INTO assets (id, user_id, filename, mime_type, file_type, data, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: ["asset-orphan", "user-1", "legacy.pdf", "application/pdf", "hd", Buffer.from("PDF"), 3],
    });

    await expect(rebuildLegacyAssetsTableIfNeeded(client)).rejects.toThrow(/NULL storage_key/);

    const columns = await readAssetsColumns(client);
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("data");

    const rows = await client.execute("SELECT id FROM assets");
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].id).toBe("asset-orphan");
  });

  it("is a no-op on a DB that already matches the new schema", async () => {
    const client = makeClient();
    await setupUsersTable(client);
    await createNewAssetsTable(client);

    await client.execute({
      sql: "INSERT INTO assets (id, user_id, filename, mime_type, file_type, size_bytes, storage_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: ["asset-1", "user-1", "test.pdf", "application/pdf", "hd", 100, "users/user-1/assets/asset-1.pdf"],
    });

    const beforeColumns = await readAssetsColumns(client);
    const beforeRows = await client.execute("SELECT * FROM assets");

    await rebuildLegacyAssetsTableIfNeeded(client);

    const afterColumns = await readAssetsColumns(client);
    const afterRows = await client.execute("SELECT * FROM assets");

    expect(afterColumns).toEqual(beforeColumns);
    expect(afterRows.rows.length).toBe(beforeRows.rows.length);
    expect(afterRows.rows[0]).toMatchObject(beforeRows.rows[0] as Record<string, unknown>);
  });
});
