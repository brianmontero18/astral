import type { FastifyInstance } from "fastify";
import { createAsset, getUserAssets, getAsset, deleteAsset, getUser } from "../db.js";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function assetRoutes(app: FastifyInstance) {
  // Upload asset
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/assets",
    async (req, reply) => {
      const { userId } = req.params;

      const user = getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      if (!ALLOWED_MIMES.has(data.mimetype)) {
        return reply.status(400).send({
          error: `Invalid file type: ${data.mimetype}. Allowed: pdf, png, jpg, txt`,
        });
      }

      const buffer = await data.toBuffer();

      if (buffer.length > MAX_SIZE) {
        return reply.status(400).send({ error: "File exceeds 10MB limit" });
      }

      const fileType = (data.fields.fileType as { value?: string } | undefined)?.value ?? "natal";

      const id = createAsset(userId, data.filename, data.mimetype, fileType, buffer);

      return reply.status(201).send({
        id,
        filename: data.filename,
        mimeType: data.mimetype,
        fileType,
        sizeBytes: buffer.length,
      });
    },
  );

  // List user assets (metadata only)
  app.get<{ Params: { userId: string } }>(
    "/users/:userId/assets",
    async (req, reply) => {
      const { userId } = req.params;
      const user = getUser(userId);
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }
      const assets = getUserAssets(userId);
      return reply.send({ assets });
    },
  );

  // Download asset
  app.get<{ Params: { id: string } }>("/assets/:id", async (req, reply) => {
    const asset = getAsset(req.params.id);
    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }
    return reply
      .header("Content-Type", asset.mime_type)
      .header("Content-Disposition", `inline; filename="${asset.filename}"`)
      .send(asset.data);
  });

  // Delete asset
  app.delete<{ Params: { id: string } }>("/assets/:id", async (req, reply) => {
    const deleted = deleteAsset(req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Asset not found" });
    }
    return reply.send({ ok: true });
  });
}
