import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getUser, getReport, getReportById, saveReport, updateReportContent, createShareToken, getShareByToken, cleanupExpiredShares } from "../db.js";
import { generateReport, computeProfileHash } from "../report/generate-report.js";
import { renderReportPDF } from "../report/pdf-renderer.js";
import type { UserProfile } from "../agent-service.js";
import type { Intake, ReportTier, DesignReport } from "../report/types.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";

function safeParseReport(content: string): DesignReport | null {
  try {
    return JSON.parse(content) as DesignReport;
  } catch {
    return null;
  }
}

function getBaseUrl(req: { protocol: string; headers: { host?: string }; hostname: string }): string {
  return process.env.BASE_URL ?? `${req.protocol}://${req.headers.host ?? req.hostname}`;
}

const lastGenerationByUser = new Map<string, number>();
const GENERATION_COOLDOWN_MS = 30_000;
const REPORT_GENERATION_FAILED_ERROR = "Report generation failed";

function resolveReportTier(input: string | undefined): ReportTier {
  return input === "premium" ? "premium" : "free";
}

function isReportTierAllowed(plan: "free" | "basic" | "premium", tier: ReportTier): boolean {
  if (tier === "free") {
    return true;
  }

  return plan === "premium";
}

async function sendReportTierNotAllowed(
  reply: import("fastify").FastifyReply,
  plan: "free" | "basic" | "premium",
  tier: ReportTier,
) {
  return reply.status(403).send({
    error: "report_tier_not_allowed",
    plan,
    tier,
  });
}

export async function reportRoutes(app: FastifyInstance) {
  async function resolveOwnedReportUser(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    requestedUserId?: string,
    options: { requireCompleteOnboarding?: boolean } = {},
  ) {
    const currentUser = await resolveRequestCurrentUser(
      request,
      reply,
      requestedUserId,
    );

    if (reply.sent) {
      return null;
    }

    if (currentUser.kind !== "linked") {
      sendCurrentUserError(reply, currentUser);
      return null;
    }

    if (
      options.requireCompleteOnboarding &&
      currentUser.user.onboarding_status === "pending"
    ) {
      reply.status(403).send({ error: "onboarding_required" });
      return null;
    }

    return currentUser.user.id;
  }

  async function loadOwnedReport(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    tierInput: string | undefined,
    requestedUserId?: string,
  ) {
    const userId = await resolveOwnedReportUser(
      request,
      reply,
      requestedUserId,
    );

    if (!userId) {
      return null;
    }

    const tier = resolveReportTier(tierInput);
    const user = await getUser(userId);

    if (!user) {
      reply.status(404).send({ error: "User not found" });
      return null;
    }

    if (!isReportTierAllowed(user.plan, tier)) {
      await sendReportTierNotAllowed(reply, user.plan, tier);
      return null;
    }

    const cached = await getReport(userId, tier);

    if (!cached) {
      reply.status(404).send({ error: "No report found. Generate one first." });
      return null;
    }

    return {
      userId,
      tier,
      cached,
    };
  }

  async function generateOwnedReport(
    userId: string,
    tierInput: ReportTier | undefined,
    reply: import("fastify").FastifyReply,
  ) {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return reply.status(500).send({ error: "OpenAI API key not configured" });
    }

    const now = Date.now();
    const last = lastGenerationByUser.get(userId) ?? 0;
    if (now - last < GENERATION_COOLDOWN_MS) {
      return reply.status(429).send({ error: "Esperá unos segundos antes de generar otro informe." });
    }

    const user = await getUser(userId);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }

    const profile = user.profile as UserProfile;
    const hd = profile?.humanDesign;
    if (!hd?.type || !Array.isArray(hd.channels) || !Array.isArray(hd.undefinedCenters) || !Array.isArray(hd.definedCenters)) {
      return reply.status(400).send({ error: "User profile incomplete — missing HD data" });
    }

    const tier = resolveReportTier(tierInput);
    if (!isReportTierAllowed(user.plan, tier)) {
      return sendReportTierNotAllowed(reply, user.plan, tier);
    }
    const intake = (user.intake as Intake) ?? undefined;
    const hash = computeProfileHash(profile, intake);

    const cached = await getReport(userId, tier);
    if (cached && cached.profile_hash === hash) {
      const parsed = safeParseReport(cached.content);
      if (parsed) return reply.send(parsed);
    }

    lastGenerationByUser.set(userId, now);

    try {
      const report = await generateReport(profile, tier, openaiKey, intake);
      const newId = randomUUID();
      const createdAt = new Date().toISOString();

      const savedId = await saveReport({
        id: newId,
        userId,
        tier,
        profileHash: hash,
        content: "",
        tokensUsed: report.tokensUsed,
        costUsd: report.costUsd,
      });

      const content = JSON.stringify({ ...report, id: savedId, userId, createdAt });
      await updateReportContent(savedId, content);

      return reply.send({ ...report, id: savedId, userId, createdAt });
    } catch (err) {
      app.log.error(err, "[report] generation pipeline failed");
      return reply.status(502).send({ error: REPORT_GENERATION_FAILED_ERROR });
    }
  }

  app.post<{ Params: { id: string }; Body: { tier?: ReportTier } }>(
    "/users/:id/report",
    async (req, reply) => {
      const userId = await resolveOwnedReportUser(
        req as AuthenticatedRequest,
        reply,
        req.params.id,
        { requireCompleteOnboarding: true },
      );

      if (!userId) {
        return;
      }

      return generateOwnedReport(userId, req.body?.tier, reply);
    },
  );

  app.post<{ Body: { tier?: ReportTier } }>(
    "/me/report",
    async (req, reply) => {
      const userId = await resolveOwnedReportUser(
        req as AuthenticatedRequest,
        reply,
        undefined,
        { requireCompleteOnboarding: true },
      );

      if (!userId) {
        return;
      }

      return generateOwnedReport(userId, req.body?.tier, reply);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { tier?: string } }>(
    "/users/:id/report",
    async (req, reply) => {
      const owned = await loadOwnedReport(
        req as AuthenticatedRequest,
        reply,
        req.query.tier,
        req.params.id,
      );

      if (!owned) {
        return;
      }

      const parsed = safeParseReport(owned.cached.content);
      if (!parsed) return reply.status(500).send({ error: "Stored report is corrupted" });
      return reply.send(parsed);
    },
  );

  app.get<{ Querystring: { tier?: string } }>(
    "/me/report",
    async (req, reply) => {
      const owned = await loadOwnedReport(
        req as AuthenticatedRequest,
        reply,
        req.query.tier,
      );

      if (!owned) {
        return;
      }

      const parsed = safeParseReport(owned.cached.content);
      if (!parsed) return reply.status(500).send({ error: "Stored report is corrupted" });
      return reply.send(parsed);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { tier?: string } }>(
    "/users/:id/report/pdf",
    async (req, reply) => {
      const owned = await loadOwnedReport(
        req as AuthenticatedRequest,
        reply,
        req.query.tier,
        req.params.id,
      );

      if (!owned) {
        return;
      }

      const user = await getUser(owned.userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const reportData = safeParseReport(owned.cached.content);
      if (!reportData) return reply.status(500).send({ error: "Stored report is corrupted" });

      const pdfBuffer = await renderReportPDF(reportData, user.name);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="informe-hd-${owned.tier}.pdf"`)
        .send(pdfBuffer);
    },
  );

  app.get<{ Querystring: { tier?: string } }>(
    "/me/report/pdf",
    async (req, reply) => {
      const owned = await loadOwnedReport(
        req as AuthenticatedRequest,
        reply,
        req.query.tier,
      );

      if (!owned) {
        return;
      }

      const user = await getUser(owned.userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const reportData = safeParseReport(owned.cached.content);
      if (!reportData) return reply.status(500).send({ error: "Stored report is corrupted" });

      const pdfBuffer = await renderReportPDF(reportData, user.name);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="informe-hd-${owned.tier}.pdf"`)
        .send(pdfBuffer);
    },
  );

  // H3: accept tier from body, default to free
  app.post<{ Params: { id: string }; Body: { tier?: ReportTier } }>(
    "/users/:id/report/share",
    async (req, reply) => {
      const userId = await resolveOwnedReportUser(
        req as AuthenticatedRequest,
        reply,
        req.params.id,
      );

      if (!userId) {
        return;
      }

      const user = await getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const tier = resolveReportTier(req.body?.tier);
      if (!isReportTierAllowed(user.plan, tier)) {
        return sendReportTierNotAllowed(reply, user.plan, tier);
      }
      const cached = await getReport(userId, tier);
      if (!cached) {
        return reply.status(404).send({
          error: `No se encontró un informe ${tier}. Generá uno primero.`,
        });
      }

      await cleanupExpiredShares();
      const token = await createShareToken(userId, cached.id);
      const baseUrl = getBaseUrl(req);
      const url = `${baseUrl}/api/report/shared/${token}`;

      return reply.send({ token, url });
    },
  );

  app.post<{ Body: { tier?: ReportTier } }>(
    "/me/report/share",
    async (req, reply) => {
      const userId = await resolveOwnedReportUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!userId) {
        return;
      }

      const user = await getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const tier = resolveReportTier(req.body?.tier);
      if (!isReportTierAllowed(user.plan, tier)) {
        return sendReportTierNotAllowed(reply, user.plan, tier);
      }
      const cached = await getReport(userId, tier);
      if (!cached) {
        return reply.status(404).send({
          error: `No se encontró un informe ${tier}. Generá uno primero.`,
        });
      }

      await cleanupExpiredShares();
      const token = await createShareToken(userId, cached.id);
      const baseUrl = getBaseUrl(req);
      const url = `${baseUrl}/api/report/shared/${token}`;

      return reply.send({ token, url });
    },
  );

  app.get<{ Params: { token: string } }>(
    "/report/shared/:token",
    async (req, reply) => {
      const share = await getShareByToken(req.params.token);
      if (!share) {
        return reply.status(404).send({ error: "Enlace no encontrado." });
      }

      if (new Date(share.expires_at) < new Date()) {
        return reply.status(410).send({ error: "Este enlace ha expirado." });
      }

      const report = await getReportById(share.report_id);
      if (!report) {
        return reply.status(404).send({ error: "Reporte no encontrado." });
      }

      const user = await getUser(share.user_id);
      const reportData = safeParseReport(report.content);
      if (!reportData) return reply.status(500).send({ error: "Stored report is corrupted" });

      const pdfBuffer = await renderReportPDF(reportData, user?.name);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `inline; filename="informe-hd.pdf"`)
        .send(pdfBuffer);
    },
  );
}
