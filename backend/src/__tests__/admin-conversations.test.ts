/**
 * Admin conversations data viewer — Integration tests (astral-y3c.3)
 *
 * Covers GET /api/admin/users/:id/conversations: authorization, and the joined
 * payload (user→assistant pairing, eval rows by target, feedback, snapshot).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const { createLinkedTestUser, createTestApp, sessionHeaders } = await import("./helpers.js");
const { saveChatMessage, insertEvalResults, setMessageFeedback } = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

describe("GET /api/admin/users/:id/conversations — auth", () => {
  it("returns 403 when the requester is not an admin", async () => {
    const ownerId = await createLinkedTestUser(app, "conv-non-admin-owner");
    await createLinkedTestUser(app, "conv-non-admin-other");

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${ownerId}/conversations`,
      headers: sessionHeaders("conv-non-admin-other"),
    });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when the target user does not exist", async () => {
    await createLinkedTestUser(app, "conv-admin-404", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/non-existent-uuid/conversations`,
      headers: sessionHeaders("conv-admin-404"),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/admin/users/:id/conversations — payload", () => {
  it("pairs the turn and attaches evals, feedback and snapshot", async () => {
    const targetId = await createLinkedTestUser(app, "conv-payload-target");
    await createLinkedTestUser(app, "conv-payload-admin", "Admin", undefined, { role: "admin" });

    await saveChatMessage(targetId, "user", "Quiero relanzar y vender ya.");
    const assistantMsgId = await saveChatMessage(targetId, "assistant", "Esta semana es propicia, relanzá.");
    await setMessageFeedback(assistantMsgId, targetId, "down", "muy genérica");
    await insertEvalResults([
      {
        userId: targetId,
        surface: "chat",
        targetId: String(assistantMsgId),
        source: "heuristic",
        evalName: "anti-sycophancy",
        pass: false,
        reason: "sin tensión",
        contextSnapshot: { model: "gpt-4o-mini", hdSummary: { type: "Generador" } },
      },
      {
        userId: targetId,
        surface: "chat",
        targetId: String(assistantMsgId),
        source: "heuristic",
        evalName: "spanish",
        pass: true,
        reason: "ok",
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${targetId}/conversations`,
      headers: sessionHeaders("conv-payload-admin"),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      conversations: Array<{
        assistantMsgId: number;
        userInput: string | null;
        output: string;
        feedback: { thumb: string; note: string | null } | null;
        evals: Array<{ name: string; pass: boolean; source: string }>;
        contextSnapshot: { model?: string } | null;
      }>;
    };

    expect(body.conversations).toHaveLength(1);
    const entry = body.conversations[0];
    expect(entry.assistantMsgId).toBe(assistantMsgId);
    expect(entry.userInput).toBe("Quiero relanzar y vender ya.");
    expect(entry.output).toBe("Esta semana es propicia, relanzá.");
    expect(entry.feedback).toEqual({ thumb: "down", note: "muy genérica" });
    expect(entry.evals).toHaveLength(2);
    expect(entry.evals.find((e) => e.name === "anti-sycophancy")?.pass).toBe(false);
    expect(entry.contextSnapshot?.model).toBe("gpt-4o-mini");
  });

  it("returns an empty list for a user with no chat history", async () => {
    const targetId = await createLinkedTestUser(app, "conv-empty-target");
    await createLinkedTestUser(app, "conv-empty-admin", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "GET",
      url: `/api/admin/users/${targetId}/conversations`,
      headers: sessionHeaders("conv-empty-admin"),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ conversations: [] });
  });
});
