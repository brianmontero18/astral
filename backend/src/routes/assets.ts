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
import { calculateBodygraph, type BirthData } from "../bodygraph/calculate.js";

const FROM_BIRTH_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FROM_BIRTH_TIME_RE = /^\d{2}:\d{2}$/;

interface FromBirthBody {
  name?: unknown;
  date?: unknown;
  time?: unknown;
  place?: unknown;
}

type FromBirthParse =
  | { ok: true; birth: BirthData }
  | { ok: false; status: number; error: string; message: string };

function parseFromBirthBody(body: FromBirthBody): FromBirthParse {
  if (typeof body.date !== "string" || !FROM_BIRTH_DATE_RE.test(body.date)) {
    return { ok: false, status: 400, error: "invalid_date", message: "date must be YYYY-MM-DD" };
  }
  if (typeof body.time !== "string" || !FROM_BIRTH_TIME_RE.test(body.time)) {
    return { ok: false, status: 400, error: "invalid_time", message: "time must be HH:mm" };
  }
  if (typeof body.place !== "object" || body.place === null) {
    return { ok: false, status: 400, error: "invalid_place", message: "place must be { lat, lon, label }" };
  }
  const place = body.place as { lat?: unknown; lon?: unknown; label?: unknown };
  if (typeof place.lat !== "number" || Number.isNaN(place.lat) || place.lat < -90 || place.lat > 90) {
    return { ok: false, status: 400, error: "invalid_place", message: "place.lat must be a number in [-90, 90]" };
  }
  if (typeof place.lon !== "number" || Number.isNaN(place.lon) || place.lon < -180 || place.lon > 180) {
    return { ok: false, status: 400, error: "invalid_place", message: "place.lon must be a number in [-180, 180]" };
  }
  if (typeof place.label !== "string" || place.label.length === 0) {
    return { ok: false, status: 400, error: "invalid_place", message: "place.label must be a non-empty string" };
  }
  return {
    ok: true,
    birth: {
      date: body.date,
      time: body.time,
      coordinates: { lat: place.lat, lon: place.lon },
      placeLabel: place.label,
      name: typeof body.name === "string" ? body.name : undefined,
    },
  };
}

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
        { userId },
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

  // Birth-data path: calcula el bodygraph determinístico desde { date, time,
  // place } sin upload de PDF. profile_asset_id queda en NULL — el PDF se
  // genera on-demand cuando la usuaria pide descargarlo. Si tenía una carta
  // previa (PDF subido o asset sintético), se borra para preservar el
  // modelo "una carta activa".
  app.post<{ Body: FromBirthBody }>("/me/bodygraph/from-birth", async (req, reply) => {
    const userId = await resolveOwnedUser(req as AuthenticatedRequest, reply);
    if (!userId) return;

    const parsed = parseFromBirthBody(req.body ?? {});
    if (!parsed.ok) {
      return reply.status(parsed.status).send({ error: parsed.error, message: parsed.message });
    }

    let profile: UserProfile;
    try {
      profile = await calculateBodygraph(parsed.birth);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error({ err }, "bodygraph from-birth calculation failed");
      return reply.status(500).send({ error: "calculation_failed", message });
    }

    const existing = await getUser(userId);
    if (!existing) return reply.status(404).send({ error: "User not found" });

    profile.name = profile.name || existing.name;
    const previousAssetId = existing.profile_asset_id;

    const updated = await updateUserBodygraph(userId, profile, null);
    if (!updated) return reply.status(404).send({ error: "User not found" });

    if (previousAssetId) {
      try {
        await deleteAsset(previousAssetId);
      } catch (err) {
        app.log.warn(
          { err, userId, previousAssetId },
          "Failed to delete previous bodygraph asset after from-birth",
        );
      }
    }

    const updatedUser = await getUser(userId);
    if (!updatedUser) {
      return reply.status(404).send({ error: "Bodygraph not found after update" });
    }

    return reply.status(201).send({
      user: serializeCurrentUser(updatedUser),
      profile: updatedUser.profile,
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
