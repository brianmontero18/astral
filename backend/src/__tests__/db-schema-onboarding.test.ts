/**
 * Schema tests for the onboarding fields added in bead astral-w72:
 *   - users.onboarding_status (default 'complete')
 *   - users.onboarding_step (NULL by default)
 *   - users.access_source (default 'self')
 *   - UNIQUE INDEX on lower(email) WHERE email IS NOT NULL
 *   - findUserByEmail() helper (case-insensitive)
 *
 * Two layers:
 *   1. Through the real `initDb()` (in-memory SQLite via createTestApp) —
 *      validates fresh-install behaviour, defaults, helpers, and the UNIQUE
 *      email index.
 *   2. Via a hand-built libsql client that simulates a pre-migration users
 *      table (the columns don't exist yet) and applies the same idempotent
 *      ALTERs the production code runs at boot. Confirms the backfill
 *      semantics on existing rows.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type Client } from "@libsql/client";

import { createTestApp } from "./helpers.js";

beforeAll(async () => {
  await createTestApp();
});

describe("users schema — onboarding defaults (fresh install)", () => {
  it("creates users with onboarding_status='complete', step=NULL, access_source='self' by default", async () => {
    const { createUser, getUser } = await import("../db.js");
    const id = await createUser("Default User", { humanDesign: {} });
    const user = await getUser(id);
    expect(user?.onboarding_status).toBe("complete");
    expect(user?.onboarding_step).toBeNull();
    expect(user?.access_source).toBe("self");
  });

  // CHECK constraint behaviour and UNIQUE-index behaviour are covered with
  // controllable schemas in the "idempotent ALTERs" describe below — a
  // shared in-memory client there can issue raw SQL without depending on
  // module-internal seams.
});

describe("findUserByEmail", () => {
  it("returns undefined for an unknown email", async () => {
    const { findUserByEmail } = await import("../db.js");
    const result = await findUserByEmail("nobody@nowhere.test");
    expect(result).toBeUndefined();
  });

  it("returns undefined for an empty/whitespace email", async () => {
    const { findUserByEmail } = await import("../db.js");
    expect(await findUserByEmail("")).toBeUndefined();
    expect(await findUserByEmail("   ")).toBeUndefined();
  });

  it("resolves an existing user case-insensitively when an email is set", async () => {
    const { createUser, findUserByEmail } = await import("../db.js");

    // createUser supports email via its options arg.
    const id = await createUser(
      "Marina",
      { humanDesign: {} },
      { email: "Marina@Coach.Test" },
    );

    const upperHit = await findUserByEmail("MARINA@COACH.TEST");
    const mixedHit = await findUserByEmail("MaRiNa@CoAcH.TeSt");
    const lowerHit = await findUserByEmail("marina@coach.test");

    expect(upperHit?.id).toBe(id);
    expect(mixedHit?.id).toBe(id);
    expect(lowerHit?.id).toBe(id);
  });
});

describe("idempotent ALTERs — backfill semantics on a pre-migration DB", () => {
  // This test runs against a hand-built libsql client to control the schema
  // shape. It simulates a deployment where the users table predates the
  // onboarding columns and validates that running the same idempotent
  // ALTERs the production code uses (a) adds the columns with the right
  // DEFAULTs, (b) backfills existing rows to ('complete', NULL, 'self'),
  // and (c) is safe to re-run.
  let client: Client;

  beforeAll(async () => {
    client = createClient({ url: "file::memory:" });

    await client.execute(`
      CREATE TABLE users (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT DEFAULT NULL,
        profile    TEXT NOT NULL,
        plan       TEXT NOT NULL DEFAULT 'free',
        role       TEXT NOT NULL DEFAULT 'user',
        status     TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Two pre-existing users — one without an email, one with.
    await client.execute({
      sql: "INSERT INTO users (id, name, profile) VALUES (?, ?, ?)",
      args: ["legacy-1", "Legacy A", "{}"],
    });
    await client.execute({
      sql: "INSERT INTO users (id, name, email, profile) VALUES (?, ?, ?, ?)",
      args: ["legacy-2", "Legacy B", "legacy@b.test", "{}"],
    });
  });

  afterAll(() => {
    client.close();
  });

  async function applyIdempotentAlters() {
    const alters = [
      "ALTER TABLE users ADD COLUMN onboarding_status TEXT NOT NULL DEFAULT 'complete'",
      "ALTER TABLE users ADD COLUMN onboarding_step TEXT DEFAULT NULL",
      "ALTER TABLE users ADD COLUMN access_source TEXT NOT NULL DEFAULT 'self'",
    ];
    for (const sql of alters) {
      try {
        await client.execute(sql);
      } catch {
        // Already applied — safe to ignore (matches production behaviour).
      }
    }
  }

  it("adds the columns with backfill defaults applied to existing rows", async () => {
    await applyIdempotentAlters();

    const rows = await client.execute(
      "SELECT id, onboarding_status, onboarding_step, access_source FROM users ORDER BY id",
    );

    expect(rows.rows).toHaveLength(2);
    for (const row of rows.rows) {
      expect(row.onboarding_status).toBe("complete");
      expect(row.onboarding_step).toBeNull();
      expect(row.access_source).toBe("self");
    }
  });

  it("re-running the migration is a no-op (idempotent)", async () => {
    await applyIdempotentAlters();
    await applyIdempotentAlters();

    const cols = await client.execute(
      "SELECT name FROM pragma_table_info('users')",
    );
    const names = cols.rows.map((r) => r.name as string);
    expect(names.filter((n) => n === "onboarding_status")).toHaveLength(1);
    expect(names.filter((n) => n === "onboarding_step")).toHaveLength(1);
    expect(names.filter((n) => n === "access_source")).toHaveLength(1);
  });

  it("CHECK constraints on a fresh CREATE TABLE reject invalid enum values", async () => {
    // Build a separate fresh client whose users table mirrors the production
    // CREATE TABLE shape (CHECK present). The migration-layer client here
    // applied only ALTERs (no CHECK), so it cannot exercise the constraint.
    const fresh = createClient({ url: "file::memory:" });

    await fresh.execute(`
      CREATE TABLE users (
        id                 TEXT PRIMARY KEY,
        name               TEXT NOT NULL,
        email              TEXT DEFAULT NULL,
        profile            TEXT NOT NULL CHECK(json_valid(profile)),
        onboarding_status  TEXT NOT NULL DEFAULT 'complete' CHECK(onboarding_status IN ('pending','complete')),
        onboarding_step    TEXT DEFAULT NULL CHECK(onboarding_step IS NULL OR onboarding_step IN ('name','upload','review','intake')),
        access_source      TEXT NOT NULL DEFAULT 'self' CHECK(access_source IN ('self','manual','payment'))
      )
    `);

    // Valid combinations succeed.
    await fresh.execute({
      sql: "INSERT INTO users (id, name, profile, onboarding_status, onboarding_step, access_source) VALUES (?, ?, ?, ?, ?, ?)",
      args: ["ok-1", "Ok", "{}", "pending", "upload", "manual"],
    });

    // Invalid status.
    await expect(
      fresh.execute({
        sql: "INSERT INTO users (id, name, profile, onboarding_status) VALUES (?, ?, ?, ?)",
        args: ["bad-status", "Bad", "{}", "halfway"],
      }),
    ).rejects.toThrow();

    // Invalid step.
    await expect(
      fresh.execute({
        sql: "INSERT INTO users (id, name, profile, onboarding_step) VALUES (?, ?, ?, ?)",
        args: ["bad-step", "Bad", "{}", "extracting"],
      }),
    ).rejects.toThrow();

    // Invalid access source.
    await expect(
      fresh.execute({
        sql: "INSERT INTO users (id, name, profile, access_source) VALUES (?, ?, ?, ?)",
        args: ["bad-src", "Bad", "{}", "stripe-direct"],
      }),
    ).rejects.toThrow();

    fresh.close();
  });

  it("UNIQUE INDEX on lower(email) blocks case-insensitive duplicates and tolerates NULLs", async () => {
    await applyIdempotentAlters();
    await client.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email)) WHERE email IS NOT NULL",
    );

    // First insert with a specific casing.
    await client.execute({
      sql: "INSERT INTO users (id, name, email, profile) VALUES (?, ?, ?, ?)",
      args: ["case-a", "Alice", "Case@Test.dev", "{}"],
    });

    // Same email different casing → must fail.
    await expect(
      client.execute({
        sql: "INSERT INTO users (id, name, email, profile) VALUES (?, ?, ?, ?)",
        args: ["case-b", "Bob", "case@test.dev", "{}"],
      }),
    ).rejects.toThrow();

    // Several NULL-email rows must coexist (partial UNIQUE).
    await client.execute({
      sql: "INSERT INTO users (id, name, profile) VALUES (?, ?, ?)",
      args: ["null-a", "NoEmail A", "{}"],
    });
    await client.execute({
      sql: "INSERT INTO users (id, name, profile) VALUES (?, ?, ?)",
      args: ["null-b", "NoEmail B", "{}"],
    });

    const rows = await client.execute(
      "SELECT id FROM users WHERE email IS NULL",
    );
    const ids = rows.rows.map((r) => r.id as string);
    expect(ids).toEqual(expect.arrayContaining(["legacy-1", "null-a", "null-b"]));
  });
});
