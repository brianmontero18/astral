import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getUser, getReport, saveReport } from "../db.js";
import { generateReport, computeProfileHash } from "../report/generate-report.js";
import type { UserProfile } from "../agent-service.js";
import type { Intake, ReportTier } from "../report/types.js";

export async function reportRoutes(app: FastifyInstance) {
  // Generate or return cached report
  app.post<{ Params: { id: string }; Body: { tier?: ReportTier } }>(
    "/users/:id/report",
    async (req, reply) => {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        return reply.status(500).send({ error: "OpenAI API key not configured" });
      }

      const user = await getUser(req.params.id);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const profile = user.profile as UserProfile;
      if (!profile?.humanDesign?.type) {
        return reply.status(400).send({ error: "User profile incomplete — missing HD data" });
      }

      const tier: ReportTier = req.body?.tier === "premium" ? "premium" : "free";
      const intake = (user.intake as Intake) ?? undefined;
      const hash = computeProfileHash(profile, intake);

      // Check cache
      const cached = await getReport(req.params.id, tier);
      if (cached && cached.profile_hash === hash) {
        return reply.send(JSON.parse(cached.content));
      }

      // Generate new report
      const report = await generateReport(profile, tier, openaiKey, intake);
      const id = randomUUID();

      await saveReport({
        id,
        userId: req.params.id,
        tier,
        profileHash: hash,
        content: JSON.stringify({ ...report, id, userId: req.params.id, createdAt: new Date().toISOString() }),
        tokensUsed: report.tokensUsed,
        costUsd: report.costUsd,
      });

      return reply.send({
        ...report,
        id,
        userId: req.params.id,
        createdAt: new Date().toISOString(),
      });
    },
  );

  // Get last generated report
  app.get<{ Params: { id: string }; Querystring: { tier?: string } }>(
    "/users/:id/report",
    async (req, reply) => {
      const tier = req.query.tier === "premium" ? "premium" : "free";
      const cached = await getReport(req.params.id, tier);
      if (!cached) {
        return reply.status(404).send({ error: "No report found. Generate one first." });
      }
      return reply.send(JSON.parse(cached.content));
    },
  );
}
