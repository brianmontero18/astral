import type { FastifyInstance } from "fastify";
import { createAsset, getUserAssets, getAsset, deleteAsset } from "../db.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "text/plain",
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function assetRoutes(app: FastifyInstance) {
  function serializeAssets(
    raw: Array<{
      id: string;
      filename: string;
      mime_type: string;
      file_type: string;
      size_bytes: number;
      created_at: string;
    }>,
  ) {
    return raw.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mime_type,
      fileType: a.file_type,
      sizeBytes: a.size_bytes,
      createdAt: a.created_at,
    }));
  }

  async function resolveOwnedUser(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    requestedUserId?: string,
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

    return currentUser.user.id;
  }

  async function handleAssetUpload(
    request: AuthenticatedRequest,
    reply: import("fastify").FastifyReply,
    requestedUserId?: string,
  ) {
    const userId = await resolveOwnedUser(
      request,
      reply,
      requestedUserId,
    );

    if (!userId) {
      return;
    }

    const data = await request.file();
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

    if (fileType === "hd" && data.mimetype !== "application/pdf") {
      return reply.status(400).send({
        error: "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.",
      });
    }

    const id = await createAsset(userId, data.filename, data.mimetype, fileType, buffer);

    return reply.status(201).send({
      id,
      filename: data.filename,
      mimeType: data.mimetype,
      fileType,
      sizeBytes: buffer.length,
    });
  }

  // Upload asset
  app.post<{ Params: { userId: string } }>(
    "/users/:userId/assets",
    async (req, reply) => {
      return handleAssetUpload(
        req as AuthenticatedRequest,
        reply,
        req.params.userId,
      );
    },
  );

  app.post("/me/assets", async (req, reply) => {
    return handleAssetUpload(req as AuthenticatedRequest, reply);
  });

  // List user assets (metadata only)
  app.get<{ Params: { userId: string } }>(
    "/users/:userId/assets",
    async (req, reply) => {
      const userId = await resolveOwnedUser(
        req as AuthenticatedRequest,
        reply,
        req.params.userId,
      );

      if (!userId) {
        return;
      }
      const raw = await getUserAssets(userId);
      return reply.send({ assets: serializeAssets(raw) });
    },
  );

  app.get("/me/assets", async (req, reply) => {
    const userId = await resolveOwnedUser(req as AuthenticatedRequest, reply);

    if (!userId) {
      return;
    }

    const raw = await getUserAssets(userId);
    return reply.send({ assets: serializeAssets(raw) });
  });

  // Download asset
  app.get<{ Params: { id: string } }>("/assets/:id", async (req, reply) => {
    const currentUser = await resolveRequestCurrentUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (reply.sent) {
      return;
    }

    if (currentUser.kind !== "linked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const asset = await getAsset(req.params.id);
    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }
    if (asset.user_id !== currentUser.user.id) {
      return reply.status(403).send({
        error: "asset_forbidden",
        assetId: req.params.id,
      });
    }
    return reply
      .header("Content-Type", asset.mime_type)
      .header("Content-Disposition", `inline; filename="${asset.filename}"`)
      .send(asset.data);
  });

  // Delete asset
  app.delete<{ Params: { id: string } }>("/assets/:id", async (req, reply) => {
    const currentUser = await resolveRequestCurrentUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (reply.sent) {
      return;
    }

    if (currentUser.kind !== "linked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const asset = await getAsset(req.params.id);
    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }
    if (asset.user_id !== currentUser.user.id) {
      return reply.status(403).send({
        error: "asset_forbidden",
        assetId: req.params.id,
      });
    }
    const deleted = await deleteAsset(req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "Asset not found" });
    }
    return reply.send({ ok: true });
  });
}
