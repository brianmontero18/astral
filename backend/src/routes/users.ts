import type { FastifyInstance, FastifyReply } from "fastify";
import SuperTokens from "supertokens-node";
import {
  createUserWithIdentity,
  deleteUser,
  findUserByIdentity,
  getLlmUsageForUser,
  getUserAssetCount,
  getUserIdentity,
  getUserMessageCount,
  getUser,
  listUserReportTiers,
  listUsers,
  type AppUserRecord,
  type AppUserListRecord,
  type AppUserPlan,
  type AppUserRole,
  type AppUserStatus,
  updateUserAccess,
  updateUserProfile,
} from "../db.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import type { AuthenticatedAppUser } from "../auth/identity.js";
import { getMessageLimitForPlan } from "../chat-limits.js";

async function fetchProviderEmail(
  app: FastifyInstance,
  provider: string,
  subject: string,
): Promise<string | null> {
  if (provider !== "supertokens") {
    return null;
  }

  try {
    const stUser = await SuperTokens.getUser(subject);
    return stUser?.emails?.[0] ?? null;
  } catch (error) {
    app.log.warn(
      { err: error, provider, subject },
      "Failed to fetch email from SuperTokens at signup",
    );
    return null;
  }
}

const ALLOWED_USER_PLANS = new Set<AppUserPlan>(["free", "basic", "premium"]);
const ALLOWED_USER_ROLES = new Set<AppUserRole>(["user", "admin"]);
const ALLOWED_USER_STATUSES = new Set<AppUserStatus>(["active", "disabled", "banned"]);
export async function userRoutes(app: FastifyInstance) {
  app.post<{ Body: { name: string; profile: object } }>("/users", async (req, reply) => {
    const { name, profile } = req.body;
    if (!name || !profile) {
      return reply.status(400).send({ error: "Missing name or profile" });
    }

    const currentUser = await resolveRequestUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (reply.sent) {
      return;
    }

    if (currentUser.kind === "linked") {
      return reply.status(409).send({
        error: "identity_already_linked",
        userId: currentUser.user.id,
      });
    }

    if (currentUser.kind !== "unlinked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const email = await fetchProviderEmail(
      app,
      currentUser.provider,
      currentUser.subject,
    );

    try {
      const id = await createUserWithIdentity(
        name,
        profile,
        currentUser.provider,
        currentUser.subject,
        { email },
      );

      return reply.status(201).send({ id });
    } catch (error) {
      const existingUser = await findUserByIdentity(
        currentUser.provider,
        currentUser.subject,
      );

      if (existingUser) {
        return reply.status(409).send({
          error: "identity_already_linked",
          userId: existingUser.id,
        });
      }

      throw error;
    }
  });

  app.get("/me", async (req, reply) => {
    const currentUser = await resolveRequestUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (reply.sent) {
      return;
    }

    if (currentUser.kind !== "linked") {
      return sendCurrentUserError(reply, currentUser);
    }

    const user = await getUser(currentUser.user.id);

    if (!user) {
      return reply.status(409).send({
        error: "identity_not_linked",
        provider: currentUser.provider,
        subject: currentUser.subject,
      });
    }

    return reply.send(user);
  });

  app.put<{ Body: { name: string; profile: object; intake?: object } }>(
    "/me",
    async (req, reply) => {
      const { name, profile, intake } = req.body;
      if (!name || !profile) {
        return reply.status(400).send({ error: "Missing name or profile" });
      }

      const currentUser = await resolveRequestUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (reply.sent) {
        return;
      }

      if (currentUser.kind !== "linked") {
        return sendCurrentUserError(reply, currentUser);
      }

      const updated = await updateUserProfile(
        currentUser.user.id,
        name,
        profile,
        intake,
      );

      if (!updated) {
        return reply.status(409).send({
          error: "identity_not_linked",
          provider: currentUser.provider,
          subject: currentUser.subject,
        });
      }

      return reply.send({ ok: true });
    },
  );

  app.get<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    const adminUser = await requireAdminUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (!adminUser) {
      return;
    }

    const user = await getUser(req.params.id);
    if (!user) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send(await buildAdminUserDetail(user));
  });

  app.put<{ Params: { id: string }; Body: { name: string; profile: object; intake?: object } }>(
    "/users/:id",
    async (req, reply) => {
      const adminUser = await requireAdminUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!adminUser) {
        return;
      }

      const { name, profile, intake } = req.body;
      if (!name || !profile) {
        return reply.status(400).send({ error: "Missing name or profile" });
      }
      const updated = await updateUserProfile(req.params.id, name, profile, intake);
      if (!updated) {
        return reply.status(404).send({ error: "User not found" });
      }
      return reply.send({ ok: true });
    },
  );

  app.delete<{ Params: { id: string } }>("/users/:id", async (req, reply) => {
    const adminUser = await requireAdminUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (!adminUser) {
      return;
    }

    const deleted = await deleteUser(req.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: "User not found" });
    }
    return reply.send({ ok: true });
  });

  app.get<{ Querystring: { q?: string; page?: string; pageSize?: string } }>(
    "/admin/users",
    async (req, reply) => {
      const adminUser = await requireAdminUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!adminUser) {
        return;
      }

      const usersPage = await listUsers({
        query: req.query.q,
        page: Number.parseInt(req.query.page ?? "", 10),
        pageSize: Number.parseInt(req.query.pageSize ?? "", 10),
      });
      return reply.send({
        users: usersPage.users.map(serializeUserSummary),
        currentPage: usersPage.currentPage,
        totalPages: usersPage.totalPages,
        totalItems: usersPage.totalItems,
        pageSize: usersPage.pageSize,
        rangeStart: usersPage.rangeStart,
        rangeEnd: usersPage.rangeEnd,
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: { plan?: AppUserPlan; role?: AppUserRole; status?: AppUserStatus } }>(
    "/admin/users/:id/access",
    async (req, reply) => {
      const adminUser = await requireAdminUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!adminUser) {
        return;
      }

      if (req.params.id === adminUser.id) {
        return reply.status(400).send({ error: "cannot_modify_self_access" });
      }

      const targetUser = await getUser(req.params.id);
      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      const nextPlan = req.body.plan;
      const nextRole = req.body.role;
      const nextStatus = req.body.status;

      if (
        typeof nextPlan === "undefined" &&
        typeof nextRole === "undefined" &&
        typeof nextStatus === "undefined"
      ) {
        return reply.status(400).send({ error: "Missing plan, role, or status" });
      }

      if (typeof nextPlan !== "undefined" && !ALLOWED_USER_PLANS.has(nextPlan)) {
        return reply.status(400).send({ error: "Invalid plan" });
      }

      if (typeof nextRole !== "undefined" && !ALLOWED_USER_ROLES.has(nextRole)) {
        return reply.status(400).send({ error: "Invalid role" });
      }

      if (typeof nextStatus !== "undefined" && !ALLOWED_USER_STATUSES.has(nextStatus)) {
        return reply.status(400).send({ error: "Invalid status" });
      }

      const updated = await updateUserAccess(req.params.id, {
        ...(nextPlan ? { plan: nextPlan } : {}),
        ...(nextRole ? { role: nextRole } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
      });

      if (!updated) {
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send({ ok: true });
    },
  );

  app.get<{ Params: { id: string }; Querystring: { days?: string } }>(
    "/admin/users/:id/llm-usage",
    async (req, reply) => {
      const adminUser = await requireAdminUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!adminUser) {
        return;
      }

      const targetUser = await getUser(req.params.id);
      if (!targetUser) {
        return reply.status(404).send({ error: "User not found" });
      }

      const rawDays = Number.parseInt(req.query.days ?? "7", 10);
      const days =
        Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 90 ? rawDays : 7;
      const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const sinceIso = sinceDate.toISOString();

      const usage = await getLlmUsageForUser(req.params.id, sinceIso);
      return reply.send({ days, since: sinceIso, ...usage });
    },
  );
}

async function resolveRequestUser(
  request: AuthenticatedRequest,
  reply: FastifyReply,
) {
  return resolveRequestCurrentUser(request, reply);
}

async function requireAdminUser(
  request: AuthenticatedRequest,
  reply: FastifyReply,
): Promise<AuthenticatedAppUser | null> {
  const currentUser = await resolveRequestUser(request, reply);

  if (reply.sent) {
    return null;
  }

  if (currentUser.kind !== "linked") {
    sendCurrentUserError(reply, currentUser);
    return null;
  }

  if (currentUser.user.role !== "admin") {
    reply.status(403).send({ error: "admin_required" });
    return null;
  }

  return currentUser.user;
}

function serializeUserSummary(user: AppUserListRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    role: user.role,
    status: user.status,
    linked: user.linked,
    createdAt: user.created_at,
  };
}

async function buildAdminUserDetail(user: AppUserRecord) {
  const authIdentity = await getUserIdentity(user.id);
  const messagesUsed = await getUserMessageCount(user.id);
  const assetCount = await getUserAssetCount(user.id);
  const reportsAvailable = await listUserReportTiers(user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan,
    status: user.status,
    role: user.role,
    linked: authIdentity !== null,
    authIdentity: authIdentity
      ? {
          provider: authIdentity.provider as "supertokens",
          subject: authIdentity.subject,
        }
      : null,
    support: {
      messagesUsed,
      messageLimit: getMessageLimitForPlan(user.plan),
      assetCount,
      reportsAvailable,
    },
    humanDesign: extractHumanDesignSummary(user.profile),
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

function extractHumanDesignSummary(profile: object) {
  const root = isRecord(profile) ? profile : null;
  const humanDesign = isRecord(root?.humanDesign)
    ? root.humanDesign
    : root;

  return {
    type: getOptionalString(humanDesign?.type),
    authority: getOptionalString(humanDesign?.authority),
    profile: getOptionalString(humanDesign?.profile),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
