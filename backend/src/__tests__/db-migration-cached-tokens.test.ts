/**
 * Migration test for `addLlmCallsCachedTokensColumnIfMissing`.
 *
 * Exercises three states of `llm_calls`:
 *   1. Legacy shape (no `cached_tokens` column) → must add the column.
 *   2. Already migrated shape → must be a no-op (idempotent).
 *   3. Table missing → must not throw (fresh install path, schema
 *      creates the table later with the column already present).
 */

import { afterEach, describe, expect, it } from "vitest";
import { createClient, type Client } from "@libsql/client";

import {
  addLlmCallsCachedTokensColumnIfMissing,
  addLlmCallsContextBreakdownColumnIfMissing,
  addLlmCallsToolCallsColumnsIfMissing,
  widenLlmCallsRouteCheckIfNeeded,
} from "../db.js";

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

async function readLlmCallsColumns(client: Client): Promise<string[]> {
  const res = await client.execute({
    sql: "SELECT name FROM pragma_table_info('llm_calls')",
    args: [],
  });
  return res.rows.map((r) => String((r as { name: string }).name));
}

async function createLegacyLlmCallsTable(client: Client) {
  await client.execute(`
    CREATE TABLE llm_calls (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      route       TEXT NOT NULL,
      model       TEXT NOT NULL,
      tokens_in   INTEGER NOT NULL DEFAULT 0,
      tokens_out  INTEGER NOT NULL DEFAULT 0,
      cost_usd    REAL    NOT NULL DEFAULT 0,
      latency_ms  INTEGER NOT NULL DEFAULT 0,
      prompt_hash TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function createMigratedLlmCallsTable(client: Client) {
  await client.execute(`
    CREATE TABLE llm_calls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL,
      route         TEXT NOT NULL,
      model         TEXT NOT NULL,
      tokens_in     INTEGER NOT NULL DEFAULT 0,
      tokens_out    INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd      REAL    NOT NULL DEFAULT 0,
      latency_ms    INTEGER NOT NULL DEFAULT 0,
      prompt_hash   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function createCachedTokensWithOldRouteCheckTable(client: Client) {
  await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
  await client.execute({
    sql: "INSERT INTO users (id) VALUES (?)",
    args: ["u1"],
  });
  await client.execute(`
    CREATE TABLE llm_calls (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       TEXT NOT NULL,
      route         TEXT NOT NULL CHECK(route IN ('chat','chat_stream','report','extraction')),
      model         TEXT NOT NULL,
      tokens_in     INTEGER NOT NULL DEFAULT 0,
      tokens_out    INTEGER NOT NULL DEFAULT 0,
      cached_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd      REAL    NOT NULL DEFAULT 0,
      latency_ms    INTEGER NOT NULL DEFAULT 0,
      prompt_hash   TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function createToolCallsWithOldRouteCheckTable(client: Client) {
  await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
  await client.execute({
    sql: "INSERT INTO users (id) VALUES (?)",
    args: ["u1"],
  });
  await client.execute(`
    CREATE TABLE llm_calls (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id          TEXT NOT NULL,
      route            TEXT NOT NULL CHECK(route IN ('chat','chat_stream','report','extraction')),
      model            TEXT NOT NULL,
      tokens_in        INTEGER NOT NULL DEFAULT 0,
      tokens_out       INTEGER NOT NULL DEFAULT 0,
      cached_tokens    INTEGER NOT NULL DEFAULT 0,
      tool_calls_count INTEGER NOT NULL DEFAULT 0,
      tool_calls_json  TEXT DEFAULT NULL,
      cost_usd         REAL    NOT NULL DEFAULT 0,
      latency_ms       INTEGER NOT NULL DEFAULT 0,
      prompt_hash      TEXT NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

async function createContextBreakdownWithOldRouteCheckTable(client: Client) {
  await client.execute("CREATE TABLE users (id TEXT PRIMARY KEY)");
  await client.execute({
    sql: "INSERT INTO users (id) VALUES (?)",
    args: ["u1"],
  });
  await client.execute(`
    CREATE TABLE llm_calls (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id                TEXT NOT NULL,
      route                  TEXT NOT NULL CHECK(route IN ('chat','chat_stream','report','extraction')),
      model                  TEXT NOT NULL,
      tokens_in              INTEGER NOT NULL DEFAULT 0,
      tokens_out             INTEGER NOT NULL DEFAULT 0,
      cached_tokens          INTEGER NOT NULL DEFAULT 0,
      tool_calls_count       INTEGER NOT NULL DEFAULT 0,
      tool_calls_json        TEXT DEFAULT NULL,
      context_breakdown_json TEXT DEFAULT NULL,
      cost_usd               REAL    NOT NULL DEFAULT 0,
      latency_ms             INTEGER NOT NULL DEFAULT 0,
      prompt_hash            TEXT NOT NULL,
      created_at             TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

describe("addLlmCallsCachedTokensColumnIfMissing", () => {
  it("adds cached_tokens column on legacy schema", async () => {
    const client = makeClient();
    await createLegacyLlmCallsTable(client);

    const before = await readLlmCallsColumns(client);
    expect(before).not.toContain("cached_tokens");

    await addLlmCallsCachedTokensColumnIfMissing(client);

    const after = await readLlmCallsColumns(client);
    expect(after).toContain("cached_tokens");
  });

  it("preserves existing rows when adding the column", async () => {
    const client = makeClient();
    await createLegacyLlmCallsTable(client);
    await client.execute({
      sql: "INSERT INTO llm_calls (user_id, route, model, tokens_in, tokens_out, cost_usd, latency_ms, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: ["u1", "chat_stream", "gpt-4o-mini", 100, 50, 0.001, 1000, "hash"],
    });

    await addLlmCallsCachedTokensColumnIfMissing(client);

    const res = await client.execute(
      "SELECT user_id, tokens_in, tokens_out, cached_tokens FROM llm_calls",
    );
    expect(res.rows).toHaveLength(1);
    const row = res.rows[0] as {
      user_id: string;
      tokens_in: number;
      tokens_out: number;
      cached_tokens: number;
    };
    expect(row.user_id).toBe("u1");
    expect(row.tokens_in).toBe(100);
    expect(row.tokens_out).toBe(50);
    expect(row.cached_tokens).toBe(0);
  });

  it("is a no-op when the column already exists (idempotent)", async () => {
    const client = makeClient();
    await createMigratedLlmCallsTable(client);

    await addLlmCallsCachedTokensColumnIfMissing(client);
    // Calling twice must not throw.
    await addLlmCallsCachedTokensColumnIfMissing(client);

    const columns = await readLlmCallsColumns(client);
    expect(columns.filter((c) => c === "cached_tokens")).toHaveLength(1);
  });

  it("does not throw when llm_calls table is missing (fresh install path)", async () => {
    const client = makeClient();
    await expect(
      addLlmCallsCachedTokensColumnIfMissing(client),
    ).resolves.not.toThrow();
  });
});

describe("addLlmCallsToolCallsColumnsIfMissing", () => {
  it("adds tool call columns on legacy schema and defaults existing rows", async () => {
    const client = makeClient();
    await createMigratedLlmCallsTable(client);
    await client.execute({
      sql: "INSERT INTO llm_calls (user_id, route, model, tokens_in, tokens_out, cost_usd, latency_ms, prompt_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: ["u1", "chat_stream", "gpt-4o-mini", 100, 50, 0.001, 1000, "hash"],
    });

    await addLlmCallsToolCallsColumnsIfMissing(client);

    const columns = await readLlmCallsColumns(client);
    expect(columns).toContain("tool_calls_count");
    expect(columns).toContain("tool_calls_json");

    const res = await client.execute(
      "SELECT tool_calls_count, tool_calls_json FROM llm_calls",
    );
    expect(res.rows[0]).toMatchObject({
      tool_calls_count: 0,
      tool_calls_json: null,
    });
  });

  it("is idempotent when tool call columns already exist", async () => {
    const client = makeClient();
    await createMigratedLlmCallsTable(client);

    await addLlmCallsToolCallsColumnsIfMissing(client);
    await addLlmCallsToolCallsColumnsIfMissing(client);

    const columns = await readLlmCallsColumns(client);
    expect(columns.filter((c) => c === "tool_calls_count")).toHaveLength(1);
    expect(columns.filter((c) => c === "tool_calls_json")).toHaveLength(1);
  });
});

describe("addLlmCallsContextBreakdownColumnIfMissing", () => {
  it("adds context_breakdown_json on migrated telemetry schema", async () => {
    const client = makeClient();
    await createMigratedLlmCallsTable(client);

    await addLlmCallsContextBreakdownColumnIfMissing(client);

    const columns = await readLlmCallsColumns(client);
    expect(columns).toContain("context_breakdown_json");
  });

  it("is idempotent when context_breakdown_json already exists", async () => {
    const client = makeClient();
    await createMigratedLlmCallsTable(client);

    await addLlmCallsContextBreakdownColumnIfMissing(client);
    await addLlmCallsContextBreakdownColumnIfMissing(client);

    const columns = await readLlmCallsColumns(client);
    expect(columns.filter((c) => c === "context_breakdown_json")).toHaveLength(1);
  });
});

describe("widenLlmCallsRouteCheckIfNeeded", () => {
  it("preserves cached_tokens when rebuilding the old route CHECK table", async () => {
    const client = makeClient();
    await createCachedTokensWithOldRouteCheckTable(client);
    await client.execute({
      sql: `INSERT INTO llm_calls
        (user_id, route, model, tokens_in, tokens_out, cached_tokens, cost_usd, latency_ms, prompt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["u1", "chat_stream", "gpt-4o-mini", 1000, 100, 768, 0.001, 1000, "hash"],
    });

    await widenLlmCallsRouteCheckIfNeeded(client);

    const res = await client.execute(
      "SELECT route, tokens_in, tokens_out, cached_tokens FROM llm_calls",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      route: "chat_stream",
      tokens_in: 1000,
      tokens_out: 100,
      cached_tokens: 768,
    });

    await expect(client.execute({
      sql: `INSERT INTO llm_calls
        (user_id, route, model, tokens_in, tokens_out, cached_tokens, cost_usd, latency_ms, prompt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["u1", "memory_writer", "gpt-4o-mini", 10, 5, 3, 0.001, 100, "hash2"],
    })).resolves.not.toThrow();

    await expect(client.execute({
      sql: `INSERT INTO llm_calls
        (user_id, route, model, tokens_in, tokens_out, cached_tokens, cost_usd, latency_ms, prompt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: ["u1", "mcp_ask", "gpt-4o-mini", 10, 5, 3, 0.001, 100, "hash3"],
    })).resolves.not.toThrow();
  });

  it("preserves tool call columns when rebuilding the old route CHECK table", async () => {
    const client = makeClient();
    await createToolCallsWithOldRouteCheckTable(client);
    await client.execute({
      sql: `INSERT INTO llm_calls
        (user_id, route, model, tokens_in, tokens_out, cached_tokens, tool_calls_count, tool_calls_json, cost_usd, latency_ms, prompt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "u1",
        "chat_stream",
        "gpt-4o-mini",
        1000,
        100,
        768,
        2,
        JSON.stringify(["findChannelByGates", "getCenterForGate"]),
        0.001,
        1000,
        "hash",
      ],
    });

    await widenLlmCallsRouteCheckIfNeeded(client);

    const res = await client.execute(
      "SELECT route, tool_calls_count, tool_calls_json FROM llm_calls",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      route: "chat_stream",
      tool_calls_count: 2,
      tool_calls_json: JSON.stringify(["findChannelByGates", "getCenterForGate"]),
    });
  });

  it("preserves context_breakdown_json when rebuilding the old route CHECK table", async () => {
    const client = makeClient();
    await createContextBreakdownWithOldRouteCheckTable(client);
    const contextBreakdown = JSON.stringify({
      estimatedInputTokens: 1000,
      blocks: [{ id: "history", tokens: 40 }],
    });
    await client.execute({
      sql: `INSERT INTO llm_calls
        (user_id, route, model, tokens_in, tokens_out, cached_tokens, tool_calls_count, tool_calls_json, context_breakdown_json, cost_usd, latency_ms, prompt_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "u1",
        "chat_stream",
        "gpt-4o-mini",
        1000,
        100,
        768,
        1,
        JSON.stringify(["findChannelByGates"]),
        contextBreakdown,
        0.001,
        1000,
        "hash",
      ],
    });

    await widenLlmCallsRouteCheckIfNeeded(client);

    const res = await client.execute(
      "SELECT route, context_breakdown_json FROM llm_calls",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      route: "chat_stream",
      context_breakdown_json: contextBreakdown,
    });
  });
});
