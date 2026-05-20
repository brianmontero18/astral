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
});
