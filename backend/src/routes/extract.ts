import type { FastifyInstance } from "fastify";
import { getAsset } from "../db.js";
import { extractProfileFromAssets, UserFacingError } from "../extraction-service.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

export async function extractRoutes(app: FastifyInstance) {
  app.post<{ Body: { assetIds: string[] } }>("/extract-profile", async (req, reply) => {
    const { assetIds } = req.body;

    if (!assetIds?.length) {
      return reply.status(400).send({ error: "Missing assetIds" });
    }

    const assets = [];
    for (const id of assetIds) {
      const asset = await getAsset(id);
      if (!asset) throw new Error(`Asset not found: ${id}`);
      assets.push({
        mimeType: asset.mime_type,
        data: asset.data,
        filename: asset.filename,
        fileType: asset.file_type, // "natal" | "hd" — now passed to extraction
      });
    }

    try {
      const profile = await extractProfileFromAssets(assets, OPENAI_KEY);
      return reply.send({ profile });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof UserFacingError) {
        app.log.warn(message);
        return reply.status(err.status).send({ error: message });
      }
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }
  });
}
