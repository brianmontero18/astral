import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getUser, getReport, getReportById, saveReport, updateReportContent, createShareToken, getShareByToken, cleanupExpiredShares } from "../db.js";
import { generateReport, computeProfileHash } from "../report/generate-report.js";
import { renderReportPDF } from "../report/pdf-renderer.js";
import type { UserProfile } from "../agent-service.js";
import type { Intake, ReportTier, DesignReport } from "../report/types.js";

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

export async function reportRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { tier?: ReportTier } }>(
    "/users/:id/report",
    async (req, reply) => {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return reply.status(500).send({ error: "OpenAI API key not configured" });
      }

      // M1: rate limit per user
      const now = Date.now();
      const last = lastGenerationByUser.get(req.params.id) ?? 0;
      if (now - last < GENERATION_COOLDOWN_MS) {
        return reply.status(429).send({ error: "Esperá unos segundos antes de generar otro informe." });
      }

      const user = await getUser(req.params.id);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const profile = user.profile as UserProfile;
      const hd = profile?.humanDesign;
      if (!hd?.type || !Array.isArray(hd.channels) || !Array.isArray(hd.undefinedCenters) || !Array.isArray(hd.definedCenters)) {
        return reply.status(400).send({ error: "User profile incomplete — missing HD data" });
      }

      const tier: ReportTier = req.body?.tier === "premium" ? "premium" : "free";
      const intake = (user.intake as Intake) ?? undefined;
      const hash = computeProfileHash(profile, intake);

      const cached = await getReport(req.params.id, tier);
      if (cached && cached.profile_hash === hash) {
        const parsed = safeParseReport(cached.content);
        if (parsed) return reply.send(parsed);
      }

      lastGenerationByUser.set(req.params.id, now);
      const report = await generateReport(profile, tier, openaiKey, intake);
      const newId = randomUUID();
      const createdAt = new Date().toISOString();

      // Resolve the persisted id (reuses existing row to preserve share links)
      const savedId = await saveReport({
        id: newId,
        userId: req.params.id,
        tier,
        profileHash: hash,
        content: "", // placeholder, updated below
        tokensUsed: report.tokensUsed,
        costUsd: report.costUsd,
      });

      // Store content JSON with the actual persisted id
      const content = JSON.stringify({ ...report, id: savedId, userId: req.params.id, createdAt });
      await updateReportContent(savedId, content);

      return reply.send({ ...report, id: savedId, userId: req.params.id, createdAt });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { tier?: string } }>(
    "/users/:id/report",
    async (req, reply) => {
      const tier = req.query.tier === "premium" ? "premium" : "free";
      const cached = await getReport(req.params.id, tier);
      if (!cached) {
        return reply.status(404).send({ error: "No report found. Generate one first." });
      }
      const parsed = safeParseReport(cached.content);
      if (!parsed) return reply.status(500).send({ error: "Stored report is corrupted" });
      return reply.send(parsed);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { tier?: string } }>(
    "/users/:id/report/pdf",
    async (req, reply) => {
      const user = await getUser(req.params.id);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const tier: ReportTier = req.query.tier === "premium" ? "premium" : "free";
      const cached = await getReport(req.params.id, tier);
      if (!cached) {
        return reply.status(404).send({ error: "No report found. Generate one first." });
      }

      const reportData = safeParseReport(cached.content);
      if (!reportData) return reply.status(500).send({ error: "Stored report is corrupted" });

      const pdfBuffer = await renderReportPDF(reportData, user.name);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="informe-hd-${tier}.pdf"`)
        .send(pdfBuffer);
    },
  );

  // H3: accept tier from body, default to free
  app.post<{ Params: { id: string }; Body: { tier?: ReportTier } }>(
    "/users/:id/report/share",
    async (req, reply) => {
      const tier: ReportTier = req.body?.tier === "premium" ? "premium" : "free";
      const cached = await getReport(req.params.id, tier);
      if (!cached) {
        return reply.status(404).send({
          error: `No se encontró un informe ${tier}. Generá uno primero.`,
        });
      }

      await cleanupExpiredShares();
      const token = await createShareToken(req.params.id, cached.id);
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
