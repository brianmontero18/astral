import type { FastifyInstance } from "fastify";
import {
  createAsset,
  deleteAsset,
  getAsset,
  getUser,
  getUserAssets,
  updateUserBodygraph,
} from "../db.js";
import { extractProfileFromAssets, UserFacingError } from "../extraction-service.js";
import type { UserProfile } from "../agent-service.js";
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
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

type RawAssetMeta = {
  id: string;
  filename: string;
  mime_type: string;
  file_type: string;
  size_bytes: number;
  created_at: string;
};

function serializeAsset(
  asset: RawAssetMeta,
  activeAssetId: string | null,
) {
  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mime_type,
    fileType: asset.file_type,
    sizeBytes: asset.size_bytes,
    createdAt: asset.created_at,
    isActive: asset.id === activeAssetId,
  };
}

export async function assetRoutes(app: FastifyInstance) {
  function serializeAssets(
    raw: Array<RawAssetMeta>,
    activeAssetId: string | null,
  ) {
    return raw.map((asset) => serializeAsset(asset, activeAssetId));
  }

  function serializeCurrentUser(user: Awaited<ReturnType<typeof getUser>>) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      profile: user.profile,
      intake: user.intake,
      plan: user.plan,
      role: user.role,
      status: user.status,
      onboardingStatus: user.onboarding_status,
      onboardingStep: user.onboarding_step,
      accessSource: user.access_source,
    };
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

    // HD charts must go through POST /me/bodygraph, which extracts the profile
    // and links it atomically. /me/assets only persists the file, so accepting
    // fileType=hd here would leave users.profile.humanDesign empty.
    if (fileType === "hd") {
      return reply.status(400).send({ error: "use_bodygraph_endpoint" });
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

  app.post("/me/bodygraph", async (req, reply) => {
    const userId = await resolveOwnedUser(req as AuthenticatedRequest, reply);

    if (!userId) {
      return;
    }

    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    if (data.mimetype !== "application/pdf") {
      return reply.status(400).send({
        error: "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.",
      });
    }

    const buffer = await data.toBuffer();

    if (buffer.length > MAX_SIZE) {
      return reply.status(400).send({ error: "File exceeds 10MB limit" });
    }

    let profile: UserProfile;
    try {
      profile = await extractProfileFromAssets(
        [
          {
            mimeType: data.mimetype,
            data: buffer,
            filename: data.filename,
            fileType: "hd",
          },
        ],
        OPENAI_KEY,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof UserFacingError) {
        app.log.warn(message);
        return reply.status(err.status).send({ error: message });
      }
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }

    const existingUser = await getUser(userId);
    if (!existingUser) {
      return reply.status(404).send({ error: "User not found" });
    }

    // Capturar el asset previamente activo antes de cualquier mutación. Lo
    // necesitamos para borrarlo después del update — el modelo v1 es "una
    // sola carta activa", el botón "Reemplazar carta" promete reemplazo
    // y la lista de assets no debe crecer al recargar la carta.
    const previousAssetId = existingUser.profile_asset_id;

    profile.name = profile.name || existingUser.name;

    const assetId = await createAsset(
      userId,
      data.filename,
      data.mimetype,
      "hd",
      buffer,
    );

    const updated = await updateUserBodygraph(userId, profile, assetId);
    if (!updated) {
      return reply.status(404).send({ error: "User not found" });
    }

    // El nuevo asset ya está activo. Reapamos el viejo best-effort: si el
    // delete falla (R2 transient, DB race) el sistema queda con un huérfano
    // pero el usuario ya tiene la carta nueva activa, no se rompe nada
    // visible. Errores quedan en logs estructurados para reaping manual.
    if (previousAssetId && previousAssetId !== assetId) {
      try {
        await deleteAsset(previousAssetId);
      } catch (err) {
        app.log.warn(
          { err, userId, previousAssetId, newAssetId: assetId },
          "Failed to delete previous bodygraph asset after replace",
        );
      }
    }

    const [updatedUser, rawAssets] = await Promise.all([
      getUser(userId),
      getUserAssets(userId),
    ]);
    const rawAsset = rawAssets.find((asset) => asset.id === assetId);

    if (!updatedUser || !rawAsset) {
      return reply.status(404).send({ error: "Bodygraph not found after update" });
    }

    return reply.status(201).send({
      user: serializeCurrentUser(updatedUser),
      profile: updatedUser.profile,
      asset: serializeAsset(rawAsset, assetId),
    });
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
      const [user, raw] = await Promise.all([
        getUser(userId),
        getUserAssets(userId),
      ]);
      return reply.send({
        assets: serializeAssets(raw, user?.profile_asset_id ?? null),
      });
    },
  );

  app.get("/me/assets", async (req, reply) => {
    const userId = await resolveOwnedUser(req as AuthenticatedRequest, reply);

    if (!userId) {
      return;
    }

    const [user, raw] = await Promise.all([
      getUser(userId),
      getUserAssets(userId),
    ]);
    return reply.send({
      assets: serializeAssets(raw, user?.profile_asset_id ?? null),
    });
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
