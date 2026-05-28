import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

import { createMcpAuthSchemaIfMissing } from "../db.js";

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

async function listTables(client: Client): Promise<Array<string>> {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    args: [],
  });
  return result.rows.map((row) => String(row.name));
}

async function listColumns(client: Client, tableName: string): Promise<Array<string>> {
  const result = await client.execute({
    sql: `SELECT name FROM pragma_table_info('${tableName}')`,
    args: [],
  });
  return result.rows.map((row) => String(row.name));
}

async function listIndexes(client: Client, tableName: string): Promise<Array<string>> {
  const result = await client.execute({
    sql: `SELECT name FROM pragma_index_list('${tableName}') ORDER BY name`,
    args: [],
  });
  return result.rows.map((row) => String(row.name));
}

describe("createMcpAuthSchemaIfMissing", () => {
  it("creates the MCP auth tables on a fresh database", async () => {
    const client = makeClient();

    await createMcpAuthSchemaIfMissing(client);

    await expect(listTables(client)).resolves.toEqual(
      expect.arrayContaining([
        "mcp_audit_events",
        "mcp_clients",
        "mcp_consents",
        "mcp_tokens",
      ]),
    );
  });

  it("is idempotent on a legacy database that only has users", async () => {
    const client = makeClient();
    await client.execute(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active'
      )
    `);

    await createMcpAuthSchemaIfMissing(client);
    await createMcpAuthSchemaIfMissing(client);

    await expect(listColumns(client, "mcp_tokens")).resolves.toEqual([
      "id",
      "token_hash",
      "user_id",
      "client_id",
      "scopes_json",
      "audience",
      "expires_at",
      "revoked_at",
      "created_at",
    ]);
    await expect(listColumns(client, "mcp_consents")).resolves.toEqual([
      "id",
      "user_id",
      "client_id",
      "scopes_json",
      "status",
      "created_at",
      "revoked_at",
    ]);
  });

  it("enforces hashed token uniqueness and JSON scope validity", async () => {
    const client = makeClient();
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
    await createMcpAuthSchemaIfMissing(client);
    await client.execute({
      sql: "INSERT INTO users (id) VALUES (?)",
      args: ["user-1"],
    });
    await client.execute({
      sql: "INSERT INTO mcp_clients (id, name) VALUES (?, ?)",
      args: ["client-1", "Client 1"],
    });

    await client.execute({
      sql: `INSERT INTO mcp_tokens
            (id, token_hash, user_id, client_id, scopes_json, audience, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "token-1",
        "hashed-token",
        "user-1",
        "client-1",
        JSON.stringify(["mcp:ask"]),
        "astral-mcp",
        "2026-05-17T13:00:00.000Z",
      ],
    });

    await expect(
      client.execute({
        sql: `INSERT INTO mcp_tokens
              (id, token_hash, user_id, client_id, scopes_json, audience, expires_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "token-2",
          "hashed-token",
          "user-1",
          "client-1",
          JSON.stringify(["mcp:ask"]),
          "astral-mcp",
          "2026-05-17T13:00:00.000Z",
        ],
      }),
    ).rejects.toThrow();

    await expect(
      client.execute({
        sql: `INSERT INTO mcp_consents
              (id, user_id, client_id, scopes_json)
              VALUES (?, ?, ?, ?)`,
        args: ["consent-1", "user-1", "client-1", "not-json"],
      }),
    ).rejects.toThrow();
  });

  it("allows write bodygraph audit side-effect mode", async () => {
    const client = makeClient();
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
    await createMcpAuthSchemaIfMissing(client);

    await client.execute({
      sql: `INSERT INTO mcp_audit_events
            (event, tool_name, side_effects_mode, status)
            VALUES (?, ?, ?, ?)`,
      args: [
        "tool_call_completed",
        "create_my_bodygraph_from_birth_v1",
        "mcp_write_bodygraph",
        "success",
      ],
    });
    const inserted = await client.execute({
      sql: "SELECT side_effects_mode FROM mcp_audit_events WHERE tool_name = ?",
      args: ["create_my_bodygraph_from_birth_v1"],
    });
    expect(inserted.rows[0].side_effects_mode).toBe("mcp_write_bodygraph");
    await expect(
      client.execute({
        sql: `INSERT INTO mcp_audit_events
              (event, tool_name, side_effects_mode, status)
              VALUES (?, ?, ?, ?)`,
        args: [
          "tool_call_completed",
          "create_profile_v1",
          "mcp_write_profile",
          "success",
        ],
      }),
    ).rejects.toThrow();
  });

  it("widens legacy mcp_audit_events side-effect CHECK constraints", async () => {
    const client = makeClient();
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
    await client.execute({
      sql: "INSERT INTO users (id) VALUES (?)",
      args: ["user-1"],
    });
    await client.execute(`
      CREATE TABLE mcp_clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await client.execute(`
      CREATE TABLE mcp_tokens (
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL REFERENCES mcp_clients(id) ON DELETE CASCADE,
        scopes_json TEXT NOT NULL CHECK(json_valid(scopes_json)),
        audience TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await client.execute({
      sql: "INSERT INTO mcp_clients (id, name) VALUES (?, ?)",
      args: ["client-1", "Client 1"],
    });
    await client.execute({
      sql: `INSERT INTO mcp_tokens
            (id, token_hash, user_id, client_id, scopes_json, audience, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "token-1",
        "hashed-token",
        "user-1",
        "client-1",
        JSON.stringify(["mcp:read_hd"]),
        "astral-mcp",
        "2026-05-17T13:00:00.000Z",
      ],
    });
    await client.execute(`
      CREATE TABLE mcp_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
        client_id TEXT DEFAULT NULL,
        token_id TEXT DEFAULT NULL,
        event TEXT NOT NULL,
        tool_name TEXT DEFAULT NULL,
        side_effects_mode TEXT DEFAULT NULL CHECK(side_effects_mode IS NULL OR side_effects_mode IN ('mcp_read_only')),
        status TEXT NOT NULL CHECK(status IN ('success','error','denied')),
        metadata_json TEXT DEFAULT NULL CHECK(metadata_json IS NULL OR json_valid(metadata_json)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await client.execute({
      sql: `INSERT INTO mcp_audit_events
            (user_id, client_id, token_id, event, tool_name, side_effects_mode, status, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "user-1",
        "client-1",
        "token-1",
        "tool_call_completed",
        "get_center_for_gate_v1",
        "mcp_read_only",
        "success",
        JSON.stringify({ gate: 1 }),
        "2026-05-17T10:00:00.000Z",
      ],
    });

    await createMcpAuthSchemaIfMissing(client);
    await createMcpAuthSchemaIfMissing(client);

    await client.execute({
      sql: `INSERT INTO mcp_audit_events
            (event, tool_name, side_effects_mode, status)
            VALUES (?, ?, ?, ?)`,
      args: [
        "tool_call_completed",
        "create_my_bodygraph_from_birth_v1",
        "mcp_write_bodygraph",
        "success",
      ],
    });
    const inserted = await client.execute({
      sql: "SELECT side_effects_mode FROM mcp_audit_events WHERE tool_name = ?",
      args: ["create_my_bodygraph_from_birth_v1"],
    });
    expect(inserted.rows[0].side_effects_mode).toBe("mcp_write_bodygraph");
    await expect(
      client.execute({
        sql: `INSERT INTO mcp_audit_events
              (event, tool_name, side_effects_mode, status)
              VALUES (?, ?, ?, ?)`,
        args: [
          "tool_call_completed",
          "create_profile_v1",
          "mcp_write_profile",
          "success",
        ],
      }),
    ).rejects.toThrow();

    const count = await client.execute("SELECT COUNT(*) AS total FROM mcp_audit_events");
    expect(Number(count.rows[0].total)).toBe(2);

    const migrated = await client.execute({
      sql: "SELECT * FROM mcp_audit_events WHERE id = 1",
      args: [],
    });
    expect(migrated.rows[0]).toMatchObject({
      user_id: "user-1",
      client_id: "client-1",
      token_id: "token-1",
      event: "tool_call_completed",
      tool_name: "get_center_for_gate_v1",
      side_effects_mode: "mcp_read_only",
      status: "success",
      metadata_json: JSON.stringify({ gate: 1 }),
      created_at: "2026-05-17T10:00:00.000Z",
    });
    await expect(listIndexes(client, "mcp_audit_events")).resolves.toEqual(
      expect.arrayContaining([
        "idx_mcp_audit_token_created",
        "idx_mcp_audit_user_client_created",
      ]),
    );
  });
});
