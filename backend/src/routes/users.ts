import type { FastifyInstance, FastifyReply } from "fastify";
import Passwordless from "supertokens-node/recipe/passwordless";
import {
  createUser,
  createUserWithIdentity,
  deleteUser,
  findUserByEmail,
  findUserByIdentity,
  getLlmUsageForUser,
  getUserAssetCount,
  getUserAssetStorageKeys,
  getUserIdentity,
  getUserMessageCount,
  getUser,
  listUserReportTiers,
  listUsers,
  markUserAdminProvisioned,
  type AppUserRecord,
  type AppUserListRecord,
  type AppUserOnboardingStep,
  type AppUserPlan,
  type AppUserRole,
  type AppUserStatus,
  updateUserAccess,
  updateUserProfile,
} from "../db.js";
import { deleteObject as r2DeleteObject } from "../storage/r2.js";
import { type AuthenticatedRequest } from "../auth/session.js";
import {
  resolveRequestCurrentUser,
  sendCurrentUserError,
} from "../auth/current-user.js";
import type { AuthenticatedAppUser } from "../auth/identity.js";
import { readSuperTokensConfig } from "../auth/config.js";
import {
  AdminInviteEmailUnavailableError,
  sendAdminInviteEmail,
} from "../auth/admin-invite-email.js";
import { getMessageLimitForPlan } from "../chat-limits.js";
import { deriveImpliedFields } from "../extraction-service.js";
import type { UserProfile } from "../agent-service.js";

const ALLOWED_USER_PLANS = new Set<AppUserPlan>(["free", "basic", "premium"]);
const ALLOWED_USER_ROLES = new Set<AppUserRole>(["user", "admin"]);
const ALLOWED_USER_STATUSES = new Set<AppUserStatus>(["active", "disabled", "banned"]);
const ALLOWED_ONBOARDING_STEPS = new Set<AppUserOnboardingStep>([
  "name",
  "upload",
  "review",
  "intake",
]);

// Loose RFC 5322-ish check — full validation happens at the SuperTokens layer
// when the magic link is consumed. This guards against obvious garbage at the
// admin endpoint boundary.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SuperTokens default tenant. Multi-tenancy is not configured in Astral.
const DEFAULT_TENANT_ID = "public";

function buildPlaceholderProfile(name: string): UserProfile {
  return {
    name,
    humanDesign: {
      type: "",
      strategy: "",
      authority: "",
      profile: "",
      definition: "",
      incarnationCross: "",
      notSelfTheme: "",
      variable: "",
      digestion: "",
      environment: "",
      strongestSense: "",
      channels: [],
      activatedGates: [],
      definedCenters: [],
      undefinedCenters: [],
    },
  };
}

function buildMagicLink(input: {
  preAuthSessionId: string;
  linkCode: string;
  tenantId: string;
  intent?: "invite";
}): string {
  const config = readSuperTokensConfig();
  const websiteDomain = config.appInfo.websiteDomain.replace(/\/$/, "");
  const websiteBasePath = config.appInfo.websiteBasePath.startsWith("/")
    ? config.appInfo.websiteBasePath
    : `/${config.appInfo.websiteBasePath}`;
  // SuperTokens places the linkCode in the URL fragment so it never reaches
  // server logs. Mirrors the format used by `urlWithLinkCode` in the
  // passwordless email template.
  //
  // intent=invite signals to the frontend that this magic link was minted by
  // an admin and the recipient may not have a stored login attempt in this
  // browser. The frontend uses it to auto-consume without requiring same-
  // browser state. Login-initiated links omit the param and keep the
  // stricter same-browser gate.
  const intentParam = input.intent
    ? `&intent=${encodeURIComponent(input.intent)}`
    : "";
  return `${websiteDomain}${websiteBasePath}/verify?preAuthSessionId=${encodeURIComponent(input.preAuthSessionId)}&tenantId=${encodeURIComponent(input.tenantId)}${intentParam}#${encodeURIComponent(input.linkCode)}`;
}
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

    // The auth resolver already fetched the provider email during the
    // auto-link attempt (see auth/current-user.ts). Reuse it instead of
    // hitting SuperTokens.getUser a second time on the legacy bootstrap path.
    const email = currentUser.providerEmail;

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

    const profile = user.profile as UserProfile | null | undefined;
    if (profile?.humanDesign) {
      deriveImpliedFields(profile);
    }

    return reply.send({
      ...user,
      // camelCased onboarding signals for the frontend to decide bootstrap
      // routing (chat vs OnboardingFlow resume) and to lock plan UI.
      onboardingStatus: user.onboarding_status,
      onboardingStep: user.onboarding_step,
      accessSource: user.access_source,
    });
  });

  app.patch<{
    Body: {
      step?: AppUserOnboardingStep | null;
      name?: string;
      profile?: object;
      intake?: object | null;
      complete?: boolean;
    };
  }>("/me/onboarding", async (req, reply) => {
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

    const { step, name, profile, intake, complete } = req.body ?? {};

    if (
      step !== undefined &&
      step !== null &&
      !ALLOWED_ONBOARDING_STEPS.has(step)
    ) {
      return reply.status(400).send({ error: "invalid_step" });
    }

    const { updateUserOnboarding } = await import("../db.js");
    const updated = await updateUserOnboarding(currentUser.user.id, {
      ...(name !== undefined ? { name } : {}),
      ...(profile !== undefined ? { profile } : {}),
      ...(intake !== undefined ? { intake } : {}),
      ...(step !== undefined ? { onboardingStep: step } : {}),
      ...(complete === true
        ? { onboardingStatus: "complete" as const, onboardingStep: null }
        : {}),
    });

    if (!updated) {
      return reply.status(404).send({ error: "User not found" });
    }

    return reply.send({ ok: true });
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

  app.post<{
    Body: { email?: string; plan?: AppUserPlan; name?: string };
  }>("/admin/users", async (req, reply) => {
    const adminUser = await requireAdminUser(
      req as AuthenticatedRequest,
      reply,
    );

    if (!adminUser) {
      return;
    }

    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const plan = req.body?.plan;
    const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return reply.status(400).send({ error: "invalid_email" });
    }
    if (!plan || !ALLOWED_USER_PLANS.has(plan)) {
      return reply.status(400).send({ error: "invalid_plan" });
    }

    const existingUser = await findUserByEmail(rawEmail);
    let userId: string;
    let isNewUser: boolean;

    if (existingUser) {
      // Upgrade path: keep onboarding_status, profile, identity untouched;
      // only re-mark the access source and apply the new plan.
      await markUserAdminProvisioned(existingUser.id, plan);
      userId = existingUser.id;
      isNewUser = false;
    } else {
      const onboardingStep: AppUserOnboardingStep = rawName ? "upload" : "name";
      try {
        userId = await createUser(rawName, buildPlaceholderProfile(rawName), {
          email: rawEmail,
          plan,
          accessSource: "manual",
          onboardingStatus: "pending",
          onboardingStep,
        });
        isNewUser = true;
      } catch (err) {
        // Race condition: another admin invited the same email between our
        // findUserByEmail() and createUser(). The UNIQUE INDEX on
        // lower(email) rejected the insert. Fall through to upgrade.
        const racedUser = await findUserByEmail(rawEmail);
        if (!racedUser) {
          throw err;
        }
        await markUserAdminProvisioned(racedUser.id, plan);
        userId = racedUser.id;
        isNewUser = false;
      }
    }

    let createCodeResult: Awaited<ReturnType<typeof Passwordless.createCode>>;
    let magicLink: string;
    try {
      createCodeResult = await Passwordless.createCode({
        tenantId: DEFAULT_TENANT_ID,
        email: rawEmail,
      });

      magicLink = buildMagicLink({
        preAuthSessionId: createCodeResult.preAuthSessionId,
        linkCode: createCodeResult.linkCode,
        tenantId: DEFAULT_TENANT_ID,
        intent: "invite",
      });

      await sendAdminInviteEmail({
        email: rawEmail,
        magicLink,
        codeLifetime: createCodeResult.codeLifetime,
        preAuthSessionId: createCodeResult.preAuthSessionId,
        userInputCode: createCodeResult.userInputCode,
        tenantId: DEFAULT_TENANT_ID,
        recipientName: rawName || null,
      });
    } catch (err) {
      if (err instanceof AdminInviteEmailUnavailableError) {
        app.log.error(
          { err, userId, email: rawEmail },
          "Admin invite email transport unavailable (SMTP not configured)",
        );
        return reply.status(503).send({
          error: "email_delivery_unavailable",
          userId,
          plan,
          isNewUser,
        });
      }

      app.log.error(
        { err, userId, email: rawEmail },
        "Failed to issue admin invite email",
      );
      return reply.status(502).send({
        error: "invite_send_failed",
        userId,
        plan,
        isNewUser,
      });
    }

    // expiresAt mirrors the actual TTL configured on the SuperTokens core.
    // codeLifetime is in ms and varies between dev (default 15 min) and
    // production (operationally set to 48h). Surfacing the real value keeps
    // the admin UI honest if the core config drifts.
    const expiresAt = new Date(
      Date.now() + createCodeResult.codeLifetime,
    ).toISOString();

    return reply.status(200).send({
      userId,
      plan,
      isNewUser,
      magicLink,
      expiresAt,
    });
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

  app.delete<{ Params: { id: string } }>(
    "/admin/users/:id",
    async (req, reply) => {
      const adminUser = await requireAdminUser(
        req as AuthenticatedRequest,
        reply,
      );

      if (!adminUser) {
        return;
      }

      // Self-delete from the admin panel is blocked. The legacy
      // DELETE /api/users/:id endpoint stays available for an intentional
      // self-delete UI in the future.
      if (req.params.id === adminUser.id) {
        return reply.status(400).send({ error: "cannot_delete_self" });
      }

      const target = await getUser(req.params.id);
      if (!target) {
        return reply.status(404).send({ error: "User not found" });
      }

      // Audit the admin's intent before any destructive work, so a partial
      // failure (R2 transient, DB race) still leaves a record of who tried
      // to delete whom.
      app.log.warn(
        {
          adminId: adminUser.id,
          targetId: req.params.id,
          targetEmail: target.email,
        },
        "Admin invoked user delete",
      );

      // Best-effort R2 cleanup before the DB cascade drops asset rows.
      // We continue on individual failures so a stale R2 object never
      // strands the user record. Operators inspect the response payload
      // (and structured logs) to clean up orphans by hand if needed.
      const assetKeys = await getUserAssetStorageKeys(req.params.id);
      const r2Errors: Array<{ assetId: string; storageKey: string; reason: string }> = [];
      for (const asset of assetKeys) {
        try {
          await r2DeleteObject(asset.storageKey);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          r2Errors.push({
            assetId: asset.id,
            storageKey: asset.storageKey,
            reason,
          });
          app.log.warn(
            { err, adminId: adminUser.id, targetId: req.params.id, assetId: asset.id },
            "Failed to delete R2 object during admin user delete",
          );
        }
      }

      const deleted = await deleteUser(req.params.id);
      if (!deleted) {
        // The user existed at the lookup above but vanished before the
        // DELETE — likely a concurrent delete from another admin tab.
        return reply.status(404).send({ error: "User not found" });
      }

      return reply.send({
        ok: true,
        deletedAssets: assetKeys.length,
        r2Errors,
      });
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
    onboardingStatus: user.onboarding_status,
    onboardingStep: user.onboarding_step,
    accessSource: user.access_source,
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
