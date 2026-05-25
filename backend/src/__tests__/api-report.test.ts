import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { mockSessionModule } from "./session-mock.js";

const generateReportMock = vi.fn();
const computeProfileHashMock = vi.fn();

vi.mock("../auth/session.js", () => mockSessionModule());

vi.mock("../report/pdf-renderer.js", () => ({
  renderReportPDF: async () => Buffer.from("%PDF-test"),
}));

vi.mock("../report/generate-report.js", () => ({
  generateReport: generateReportMock,
  computeProfileHash: computeProfileHashMock,
}));

vi.mock("../llm/model-config.js", async () => {
  const actual = await vi.importActual<typeof import("../llm/model-config.js")>("../llm/model-config.js");
  return {
    ...actual,
    REPORT_MODEL: "gpt-4o-mini",
    REPORT_PREMIUM_MODEL: "gpt-5.4-mini",
  };
});

const {
  getReport,
  getUser,
  createShareToken,
  getRecentLlmCallsForUser,
  saveReport,
  updateUserProfile,
  updateReportContent,
} = await import("../db.js");
const {
  createLinkedTestUser,
  createTestApp,
  sessionHeaders,
} = await import("./helpers.js");

let app: FastifyInstance;

beforeAll(async () => {
  computeProfileHashMock.mockReturnValue("profile-hash-test");
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  generateReportMock.mockReset();
  computeProfileHashMock.mockReset();
  computeProfileHashMock.mockReturnValue("profile-hash-test");
});

async function seedReport(
  userId: string,
  tier: "free" | "premium" = "free",
  profileHash = "profile-hash-test",
) {
  const reportId = await saveReport({
    id: `report-${userId}-${tier}`,
    userId,
    tier,
    profileHash,
    content: "{}",
    tokensUsed: 0,
    costUsd: 0,
  });

  await updateReportContent(
    reportId,
    JSON.stringify({
      id: reportId,
      userId,
      tier,
      createdAt: "2026-04-12T00:00:00.000Z",
      summary: "persisted report",
    }),
  );

  return reportId;
}

describe("Report routes", () => {
  it("GET /api/me/report returns authentication_required without a validated session", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/me/report",
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
  });

  it("POST /api/me/report returns authentication_required and does not start generation without a validated session", async () => {
    const userId = await createLinkedTestUser(app, "st-report-expired-before-generate");
    await seedReport(userId);

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({
      error: "authentication_required",
    });
    expect(generateReportMock).not.toHaveBeenCalled();

    const cachedRes = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-expired-before-generate"),
    });

    expect(cachedRes.statusCode).toBe(200);
    expect(JSON.parse(cachedRes.body)).toMatchObject({
      userId,
      summary: "persisted report",
    });
  });

  it("GET /api/me/report returns the linked user's report", async () => {
    const userId = await createLinkedTestUser(app, "st-report-owner");
    const reportId = await seedReport(userId);

    const res = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-owner"),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      id: reportId,
      userId,
      summary: "persisted report",
    });
  });

  it("GET /api/me/report returns report_stale when the stored hash does not match current profile and intake", async () => {
    const userId = await createLinkedTestUser(app, "st-report-stale-get");
    await seedReport(userId, "free", "old-profile-hash");

    const res = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-stale-get"),
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "report_stale",
      tier: "free",
    });
  });

  it("POST /api/me/report generates and stores the current user's report", async () => {
    const userId = await createLinkedTestUser(app, "st-report-generate");
    generateReportMock.mockResolvedValueOnce({
      tier: "free",
      profileHash: "profile-hash-test",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "chart",
        },
      ],
      tokensUsed: 33,
      costUsd: 0.0005,
      degraded: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-generate"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(generateReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        humanDesign: expect.objectContaining({
          type: "Generador Manifestante",
          profile: "6/2",
        }),
      }),
      "free",
      "test-key-not-real",
      undefined,
    );
    expect(JSON.parse(res.body)).toMatchObject({
      id: expect.any(String),
      userId,
      tier: "free",
      profileHash: "profile-hash-test",
      tokensUsed: 33,
      costUsd: 0.0005,
      sections: [
        expect.objectContaining({
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
        }),
      ],
      createdAt: expect.any(String),
    });
  });

  it("POST /api/me/report routes premium generation to the configured premium model", async () => {
    const userId = await createLinkedTestUser(
      app,
      "st-report-premium-routing",
      "Premium Routing User",
      undefined,
      { plan: "premium" },
    );
    generateReportMock.mockResolvedValueOnce({
      tier: "premium",
      profileHash: "profile-hash-test",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "chart",
        },
      ],
      tokensUsed: 99,
      costUsd: 0.0015,
      degraded: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-premium-routing"),
      payload: { tier: "premium" },
    });

    expect(res.statusCode).toBe(200);
    expect(generateReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        humanDesign: expect.objectContaining({
          type: "Generador Manifestante",
        }),
      }),
      "premium",
      "test-key-not-real",
      undefined,
      { model: "gpt-5.4-mini" },
    );
    expect(JSON.parse(res.body)).toMatchObject({
      id: expect.any(String),
      userId,
      tier: "premium",
      tokensUsed: 99,
      costUsd: 0.0015,
    });
  });

  it("POST /api/me/report reuses the cached report when profile and intake hash are unchanged", async () => {
    const userId = await createLinkedTestUser(app, "st-report-cache-hit");
    const reportId = await saveReport({
      id: `report-${userId}-free-cache`,
      userId,
      tier: "free",
      profileHash: "profile-hash-test",
      content: "",
      tokensUsed: 0,
      costUsd: 0,
    });

    await updateReportContent(
      reportId,
      JSON.stringify({
        id: reportId,
        userId,
        tier: "free",
        profileHash: "profile-hash-test",
        createdAt: "2026-04-12T00:00:00.000Z",
        summary: "cached without regeneration",
      }),
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-cache-hit"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(generateReportMock).not.toHaveBeenCalled();
    expect(JSON.parse(res.body)).toMatchObject({
      id: reportId,
      userId,
      summary: "cached without regeneration",
      profileHash: "profile-hash-test",
    });
  });

  it("POST /api/me/report regenerates in place when the cached report hash is stale", async () => {
    const userId = await createLinkedTestUser(app, "st-report-regenerate");
    const reportId = await seedReport(userId, "free", "stale-profile-hash");
    generateReportMock.mockResolvedValueOnce({
      tier: "free",
      profileHash: "profile-hash-test",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "regenerated chart",
        },
      ],
      tokensUsed: 41,
      costUsd: 0.0007,
      degraded: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-regenerate"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      id: reportId,
      userId,
      tier: "free",
      tokensUsed: 41,
      sections: [
        expect.objectContaining({
          staticContent: "regenerated chart",
        }),
      ],
    });

    const cachedRes = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-regenerate"),
    });

    expect(cachedRes.statusCode).toBe(200);
    expect(JSON.parse(cachedRes.body)).toMatchObject({
      id: reportId,
      sections: [
        expect.objectContaining({
          staticContent: "regenerated chart",
        }),
      ],
    });
  });

  it("POST /api/me/report regenerates in place with the latest persisted intake", async () => {
    const sessionSubject = "st-report-regenerate-intake";
    const userId = await createLinkedTestUser(app, sessionSubject);
    const reportId = await saveReport({
      id: `report-${userId}-free-intake`,
      userId,
      tier: "free",
      profileHash: "old-intake-hash",
      content: "",
      tokensUsed: 0,
      costUsd: 0,
    });

    await updateReportContent(
      reportId,
      JSON.stringify({
        id: reportId,
        userId,
        tier: "free",
        profileHash: "old-intake-hash",
        createdAt: "2026-04-12T00:00:00.000Z",
        summary: "report before intake update",
      }),
    );

    const nextIntake = {
      actividad: "Consultora de marca",
      objetivos: "Afinar la oferta",
      desafios: "Sostener foco y ritmo",
    };
    const userBeforeUpdate = await getUser(userId);
    expect(userBeforeUpdate).not.toBeNull();

    await updateUserProfile(
      userId,
      userBeforeUpdate?.name ?? "Linked Test User",
      userBeforeUpdate?.profile ?? {},
      nextIntake,
    );

    computeProfileHashMock.mockReturnValue("new-intake-hash");
    generateReportMock.mockResolvedValueOnce({
      tier: "free",
      profileHash: "new-intake-hash",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "regenerated with intake",
        },
      ],
      tokensUsed: 45,
      costUsd: 0.0008,
      degraded: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders(sessionSubject),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(generateReportMock).toHaveBeenCalledWith(
      expect.any(Object),
      "free",
      "test-key-not-real",
      nextIntake,
    );
    expect(JSON.parse(res.body)).toMatchObject({
      id: reportId,
      userId,
      profileHash: "new-intake-hash",
      sections: [
        expect.objectContaining({
          staticContent: "regenerated with intake",
        }),
      ],
    });

    const cachedRes = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders(sessionSubject),
    });

    expect(cachedRes.statusCode).toBe(200);
    expect(JSON.parse(cachedRes.body)).toMatchObject({
      id: reportId,
      profileHash: "new-intake-hash",
      sections: [
        expect.objectContaining({
          staticContent: "regenerated with intake",
        }),
      ],
    });
  });

  it("POST /api/me/report persists degraded reports without breaking the contract", async () => {
    const userId = await createLinkedTestUser(app, "st-report-degraded");
    generateReportMock.mockResolvedValueOnce({
      tier: "free",
      profileHash: "profile-hash-test",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "chart",
        },
      ],
      tokensUsed: 21,
      costUsd: 0.0003,
      degraded: true,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-degraded"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({
      userId,
      tier: "free",
      degraded: true,
      sections: [
        expect.objectContaining({
          id: "mechanical-chart",
        }),
      ],
    });

    const cachedRes = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-degraded"),
    });

    expect(cachedRes.statusCode).toBe(200);
    expect(JSON.parse(cachedRes.body)).toMatchObject({
      userId,
      tier: "free",
      degraded: true,
    });
  });

  it("POST /api/me/report rate limits rapid regeneration attempts for the same user", async () => {
    const userId = await createLinkedTestUser(app, "st-report-cooldown");
    generateReportMock.mockResolvedValue({
      tier: "free",
      profileHash: "profile-hash-test",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "chart",
        },
      ],
      tokensUsed: 10,
      costUsd: 0.0001,
      degraded: false,
    });

    const firstRes = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-cooldown"),
      payload: { tier: "free" },
    });

    expect(firstRes.statusCode).toBe(200);

    const secondRes = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-cooldown"),
      payload: { tier: "free" },
    });

    expect(secondRes.statusCode).toBe(429);
    expect(JSON.parse(secondRes.body)).toEqual({
      error: "report_rate_limited",
    });

    const calls = await getRecentLlmCallsForUser(userId, "1970-01-01T00:00:00.000Z");
    expect(calls[0]).toMatchObject({
      route: "report",
      errorCode: "report_rate_limited",
    });
  });

  it("POST /api/me/report returns profile_incomplete when HD data is missing", async () => {
    const userId = await createLinkedTestUser(
      app,
      "st-report-profile-incomplete",
      "Incomplete Report User",
      {
        humanDesign: {
          type: "Generador",
        },
      },
    );

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-profile-incomplete"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body)).toEqual({
      error: "profile_incomplete",
    });
    expect(generateReportMock).not.toHaveBeenCalled();

    const calls = await getRecentLlmCallsForUser(userId, "1970-01-01T00:00:00.000Z");
    expect(calls[0]).toMatchObject({
      route: "report",
      errorCode: "profile_incomplete",
    });
  });

  it("POST /api/me/report returns a sanitized 502 and does not persist a report when generation fails", async () => {
    const userId = await createLinkedTestUser(app, "st-report-failure");
    generateReportMock.mockRejectedValueOnce(new Error("OpenAI timeout from upstream"));

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-failure"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body)).toEqual({
      error: "model_failed",
    });

    const cachedRes = await app.inject({
      method: "GET",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-failure"),
    });

    expect(cachedRes.statusCode).toBe(404);
    expect(cachedRes.body).not.toContain("OpenAI timeout from upstream");

    const calls = await getRecentLlmCallsForUser(userId, "1970-01-01T00:00:00.000Z");
    expect(calls[0]).toMatchObject({
      route: "report",
      errorCode: "model_failed",
    });
  });

  it("POST /api/me/report keeps the cooldown active even when the previous generation attempt failed", async () => {
    await createLinkedTestUser(app, "st-report-failure-cooldown");
    generateReportMock.mockRejectedValueOnce(new Error("OpenAI timeout from upstream"));

    const firstRes = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-failure-cooldown"),
      payload: { tier: "free" },
    });

    expect(firstRes.statusCode).toBe(502);
    expect(JSON.parse(firstRes.body)).toEqual({
      error: "model_failed",
    });

    const secondRes = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders("st-report-failure-cooldown"),
      payload: { tier: "free" },
    });

    expect(secondRes.statusCode).toBe(429);
    expect(JSON.parse(secondRes.body)).toEqual({
      error: "report_rate_limited",
    });
  });

  it("GET legacy /api/users/:id/report returns client_identity_mismatch for cross-user access", async () => {
    const ownerId = await createLinkedTestUser(app, "st-report-legacy-owner");
    await seedReport(ownerId);
    const otherId = await createLinkedTestUser(app, "st-report-legacy-other");

    const res = await app.inject({
      method: "GET",
      url: `/api/users/${otherId}/report`,
      headers: sessionHeaders("st-report-legacy-owner"),
    });

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body)).toEqual({
      error: "client_identity_mismatch",
      userId: ownerId,
      requestedUserId: otherId,
      provider: "supertokens",
      subject: "st-report-legacy-owner",
    });
  });

  it("POST /api/me/report/share creates a share token for the current user's report", async () => {
    const userId = await createLinkedTestUser(app, "st-report-share", "Premium Share User", undefined, {
      plan: "premium",
    });
    await seedReport(userId, "premium");

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report/share",
      headers: sessionHeaders("st-report-share"),
      payload: { tier: "premium" },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      token: expect.any(String),
      url: expect.stringContaining("/api/report/shared/"),
    });
  });

  it("POST /api/me/report/share rejects stale reports", async () => {
    const userId = await createLinkedTestUser(app, "st-report-share-stale");
    await seedReport(userId, "free", "stale-share-hash");

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report/share",
      headers: sessionHeaders("st-report-share-stale"),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "report_stale",
      tier: "free",
    });
  });

  it("GET /api/me/report/pdf returns the current user's PDF", async () => {
    const userId = await createLinkedTestUser(app, "st-report-pdf", "Premium PDF User", undefined, {
      plan: "premium",
    });
    await seedReport(userId, "premium");

    const res = await app.inject({
      method: "GET",
      url: "/api/me/report/pdf?tier=premium",
      headers: sessionHeaders("st-report-pdf"),
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain("informe-hd-premium.pdf");
  });

  it("GET /api/me/report/pdf rejects stale reports", async () => {
    const userId = await createLinkedTestUser(app, "st-report-pdf-stale");
    await seedReport(userId, "free", "stale-pdf-hash");

    const res = await app.inject({
      method: "GET",
      url: "/api/me/report/pdf",
      headers: sessionHeaders("st-report-pdf-stale"),
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "report_stale",
      tier: "free",
    });
  });

  it("GET /api/report/shared/:token rejects stale reports", async () => {
    const userId = await createLinkedTestUser(app, "st-report-shared-pdf-stale");
    const reportId = await seedReport(userId, "free", "stale-shared-pdf-hash");
    const token = await createShareToken(userId, reportId);

    const res = await app.inject({
      method: "GET",
      url: `/api/report/shared/${token}`,
    });

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "report_stale",
      tier: "free",
    });
  });

  it.each(["free", "basic"] as const)(
    "rejects legacy premium PDF access for %s plan users",
    async (plan) => {
      const subject = `st-report-legacy-pdf-${plan}`;
      const userId = await createLinkedTestUser(app, subject, `Legacy PDF ${plan}`, undefined, {
        plan,
      });
      await seedReport(userId, "premium");

      const res = await app.inject({
        method: "GET",
        url: `/api/users/${userId}/report/pdf?tier=premium`,
        headers: sessionHeaders(subject),
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({
        error: "report_tier_not_allowed",
        plan,
        tier: "premium",
      });
    },
  );

  it.each(["free", "basic"] as const)(
    "rejects premium report access for %s plan users",
    async (plan) => {
      const subject = `st-report-${plan}-blocked`;
      const userId = await createLinkedTestUser(app, subject, `Blocked ${plan}`, undefined, {
        plan,
      });
      await seedReport(userId, "premium");

      const reportRes = await app.inject({
        method: "GET",
        url: "/api/me/report?tier=premium",
        headers: sessionHeaders(subject),
      });

      expect(reportRes.statusCode).toBe(403);
      expect(JSON.parse(reportRes.body)).toEqual({
        error: "report_tier_not_allowed",
        plan,
        tier: "premium",
      });

      const shareRes = await app.inject({
        method: "POST",
        url: "/api/me/report/share",
        headers: sessionHeaders(subject),
        payload: { tier: "premium" },
      });

      expect(shareRes.statusCode).toBe(403);
      expect(JSON.parse(shareRes.body)).toEqual({
        error: "report_tier_not_allowed",
        plan,
        tier: "premium",
      });

      const pdfRes = await app.inject({
        method: "GET",
        url: "/api/me/report/pdf?tier=premium",
        headers: sessionHeaders(subject),
      });

      expect(pdfRes.statusCode).toBe(403);
      expect(JSON.parse(pdfRes.body)).toEqual({
        error: "report_tier_not_allowed",
        plan,
        tier: "premium",
      });
    },
  );

  it.each(["free", "basic"] as const)(
    "rejects POST /api/me/report premium generation for %s plan users",
    async (plan) => {
      const subject = `st-report-generate-blocked-${plan}`;
      await createLinkedTestUser(app, subject, `Blocked generate ${plan}`, undefined, {
        plan,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/me/report",
        headers: sessionHeaders(subject),
        payload: { tier: "premium" },
      });

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body)).toEqual({
        error: "report_tier_not_allowed",
        plan,
        tier: "premium",
      });
      expect(generateReportMock).not.toHaveBeenCalled();
    },
  );

  // Regression tests for the saveReport / updateReportContent timestamp
  // contract. SQLite datetime('now') has second-level precision, so the
  // tests sleep ~1.1s between seed and re-write to make the assertion
  // unambiguous: with the previous bug (created_at being overwritten on
  // regen) these assertions would fail because the bumped timestamp
  // would land in a different second than the original seed.
  it("POST /api/me/report regeneration preserves created_at and bumps updated_at", async () => {
    const subject = "st-report-regen-timestamps";
    const userId = await createLinkedTestUser(app, subject);

    await saveReport({
      id: `report-${userId}-free`,
      userId,
      tier: "free",
      profileHash: "stale-hash",
      content: "{}",
      tokensUsed: 0,
      costUsd: 0,
    });

    const initial = await getReport(userId, "free");
    expect(initial).toBeDefined();
    const originalCreatedAt = initial!.created_at;
    expect(initial!.updated_at).toBe(originalCreatedAt);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    generateReportMock.mockResolvedValueOnce({
      tier: "free",
      profileHash: "fresh-hash",
      sections: [
        {
          id: "mechanical-chart",
          title: "Tu Carta Mecánica",
          icon: "⚙️",
          tier: "free",
          staticContent: "regenerated chart",
        },
      ],
      tokensUsed: 7,
      costUsd: 0.0001,
      degraded: false,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/me/report",
      headers: sessionHeaders(subject),
      payload: { tier: "free" },
    });

    expect(res.statusCode).toBe(200);

    const after = await getReport(userId, "free");
    expect(after).toBeDefined();
    expect(after!.created_at).toBe(originalCreatedAt);
    expect(after!.updated_at > originalCreatedAt).toBe(true);
  });

  it("updateReportContent bumps updated_at without touching created_at", async () => {
    const subject = "st-report-content-update-timestamps";
    const userId = await createLinkedTestUser(app, subject);

    const reportId = await saveReport({
      id: `report-${userId}-free`,
      userId,
      tier: "free",
      profileHash: "any-hash",
      content: "{}",
      tokensUsed: 0,
      costUsd: 0,
    });

    const initial = await getReport(userId, "free");
    expect(initial).toBeDefined();
    const originalCreatedAt = initial!.created_at;

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await updateReportContent(reportId, JSON.stringify({ summary: "patched" }));

    const after = await getReport(userId, "free");
    expect(after).toBeDefined();
    expect(after!.created_at).toBe(originalCreatedAt);
    expect(after!.updated_at > originalCreatedAt).toBe(true);
  });
});
