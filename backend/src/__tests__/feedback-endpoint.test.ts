/**
 * Message Feedback — Integration tests
 *
 * Covers POST /api/messages/:id/feedback validation, auth, ownership,
 * and the underlying setMessageFeedback persistence helper.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

vi.mock("../auth/session.js", () => mockSessionModule());

const {
  createLinkedTestUser,
  createTestApp,
  sessionHeaders,
} = await import("./helpers.js");
const { saveChatMessage, setMessageFeedback } = await import("../db.js");

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app?.close();
});

describe("setMessageFeedback (helper)", () => {
  it("returns true and persists feedback for assistant messages owned by the user", async () => {
    const userId = await createLinkedTestUser(app, "fb-helper-happy");
    const msgId = await saveChatMessage(userId, "assistant", "respuesta");

    const updated = await setMessageFeedback(msgId, userId, "up", "muy clara");
    expect(updated).toBe(true);
  });

  it("can change the thumb on an already-rated message", async () => {
    const userId = await createLinkedTestUser(app, "fb-helper-update");
    const msgId = await saveChatMessage(userId, "assistant", "respuesta");

    expect(await setMessageFeedback(msgId, userId, "up")).toBe(true);
    expect(await setMessageFeedback(msgId, userId, "down", "me equivoqué")).toBe(true);
  });

  it("returns false for a non-existent message id", async () => {
    const userId = await createLinkedTestUser(app, "fb-helper-missing");
    const updated = await setMessageFeedback(999_999, userId, "up");
    expect(updated).toBe(false);
  });

  it("returns false when the message belongs to a different user", async () => {
    const ownerId = await createLinkedTestUser(app, "fb-helper-owner");
    const otherId = await createLinkedTestUser(app, "fb-helper-other");
    const msgId = await saveChatMessage(ownerId, "assistant", "ajena");

    const updated = await setMessageFeedback(msgId, otherId, "up");
    expect(updated).toBe(false);
  });

  it("returns false when the message role is 'user' (not assistant)", async () => {
    const userId = await createLinkedTestUser(app, "fb-helper-userrole");
    const msgId = await saveChatMessage(userId, "user", "pregunta del user");

    const updated = await setMessageFeedback(msgId, userId, "up");
    expect(updated).toBe(false);
  });
});

describe("POST /api/messages/:id/feedback", () => {
  it("returns 200 and accepts a thumb up with note", async () => {
    const userId = await createLinkedTestUser(app, "fb-route-up");
    const msgId = await saveChatMessage(userId, "assistant", "respuesta clara");

    const res = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      headers: sessionHeaders("fb-route-up"),
      payload: { thumb: "up", note: "esto me sirvió" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("returns 400 when thumb is missing or invalid", async () => {
    const userId = await createLinkedTestUser(app, "fb-route-bad-thumb");
    const msgId = await saveChatMessage(userId, "assistant", "respuesta");

    const resMissing = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      headers: sessionHeaders("fb-route-bad-thumb"),
      payload: {},
    });
    expect(resMissing.statusCode).toBe(400);

    const resInvalid = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      headers: sessionHeaders("fb-route-bad-thumb"),
      payload: { thumb: "neutral" },
    });
    expect(resInvalid.statusCode).toBe(400);
  });

  it("returns 400 when the message id is non-numeric", async () => {
    await createLinkedTestUser(app, "fb-route-bad-id");
    const res = await app.inject({
      method: "POST",
      url: `/api/messages/abc/feedback`,
      headers: sessionHeaders("fb-route-bad-id"),
      payload: { thumb: "up" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 when the request has no validated session", async () => {
    const ownerId = await createLinkedTestUser(app, "fb-route-noauth-owner");
    const msgId = await saveChatMessage(ownerId, "assistant", "respuesta");

    const res = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      payload: { thumb: "up" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when the message belongs to another user", async () => {
    const ownerId = await createLinkedTestUser(app, "fb-route-cross-owner");
    await createLinkedTestUser(app, "fb-route-cross-other");
    const msgId = await saveChatMessage(ownerId, "assistant", "ajena");

    const res = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      headers: sessionHeaders("fb-route-cross-other"),
      payload: { thumb: "up" },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when targeting a user (not assistant) message", async () => {
    const userId = await createLinkedTestUser(app, "fb-route-userrole");
    const msgId = await saveChatMessage(userId, "user", "pregunta");

    const res = await app.inject({
      method: "POST",
      url: `/api/messages/${msgId}/feedback`,
      headers: sessionHeaders("fb-route-userrole"),
      payload: { thumb: "up" },
    });

    expect(res.statusCode).toBe(404);
  });
});
