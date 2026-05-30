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
const { saveChatMessage, insertEvalResults, setMessageFeedback, getEvalResultsByTarget } =
  await import("../db.js");

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

describe("POST /api/admin/users/:id/messages/:messageId/label", () => {
  it("returns 403 for non-admins", async () => {
    const ownerId = await createLinkedTestUser(app, "label-non-admin-owner");
    await createLinkedTestUser(app, "label-non-admin-other");

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${ownerId}/messages/1/label`,
      headers: sessionHeaders("label-non-admin-other"),
      payload: { label: "good" },
    });

    expect(res.statusCode).toBe(403);
  });

  it("rejects an invalid label with 400", async () => {
    const targetId = await createLinkedTestUser(app, "label-invalid-target");
    await createLinkedTestUser(app, "label-invalid-admin", "Admin", undefined, { role: "admin" });

    const res = await app.inject({
      method: "POST",
      url: `/api/admin/users/${targetId}/messages/1/label`,
      headers: sessionHeaders("label-invalid-admin"),
      payload: { label: "meh" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("writes a human label and replaces it on re-label (idempotent)", async () => {
    const targetId = await createLinkedTestUser(app, "label-write-target");
    await createLinkedTestUser(app, "label-write-admin", "Admin", undefined, { role: "admin" });
    const assistantMsgId = await saveChatMessage(targetId, "assistant", "respuesta");

    const first = await app.inject({
      method: "POST",
      url: `/api/admin/users/${targetId}/messages/${assistantMsgId}/label`,
      headers: sessionHeaders("label-write-admin"),
      payload: { label: "bad", critique: "muy genérica" },
    });
    expect(first.statusCode).toBe(200);

    let rows = await getEvalResultsByTarget(String(assistantMsgId));
    let human = rows.filter((r) => r.source === "human");
    expect(human).toHaveLength(1);
    expect(human[0].pass).toBe(false);
    expect(human[0].reason).toBe("muy genérica");

    // Re-label flips the verdict without stacking a second human row.
    const second = await app.inject({
      method: "POST",
      url: `/api/admin/users/${targetId}/messages/${assistantMsgId}/label`,
      headers: sessionHeaders("label-write-admin"),
      payload: { label: "good", critique: "en realidad sí pone tensión" },
    });
    expect(second.statusCode).toBe(200);

    rows = await getEvalResultsByTarget(String(assistantMsgId));
    human = rows.filter((r) => r.source === "human");
    expect(human).toHaveLength(1);
    expect(human[0].pass).toBe(true);
    expect(human[0].reason).toBe("en realidad sí pone tensión");
  });
});
