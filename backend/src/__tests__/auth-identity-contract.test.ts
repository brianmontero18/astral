import { describe, expect, it } from "vitest";
import { resolveCurrentUser, type ResolveCurrentUserDeps } from "../auth/identity.js";

describe("resolveCurrentUser", () => {
  it("returns authentication_required when there is no validated session", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => null,
    };

    await expect(
      resolveCurrentUser({ session: null }, deps),
    ).resolves.toEqual({
      kind: "anonymous",
      statusCode: 401,
      error: "authentication_required",
    });
  });

  it("returns identity_not_linked when a valid session has no Astral user mapping", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => null,
    };

    await expect(
      resolveCurrentUser(
        {
          session: { provider: "supertokens", subject: "st-user-123" },
        },
        deps,
      ),
    ).resolves.toEqual({
      kind: "unlinked",
      statusCode: 409,
      error: "identity_not_linked",
      provider: "supertokens",
      subject: "st-user-123",
    });
  });

  it("returns the linked Astral user when the session subject resolves cleanly", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => ({
        id: "user-1",
        name: "Brian",
        role: "user",
        status: "active",
      }),
    };

    await expect(
      resolveCurrentUser(
        {
          session: { provider: "supertokens", subject: "st-user-123" },
        },
        deps,
      ),
    ).resolves.toEqual({
      kind: "linked",
      user: { id: "user-1", name: "Brian", role: "user", status: "active" },
      provider: "supertokens",
      subject: "st-user-123",
    });
  });

  it("rejects legacy client userId when it does not match the resolved session user", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => ({
        id: "user-1",
        name: "Brian",
        role: "user",
        status: "active",
      }),
    };

    await expect(
      resolveCurrentUser(
        {
          session: { provider: "supertokens", subject: "st-user-123" },
          requestedUserId: "user-2",
        },
        deps,
      ),
    ).resolves.toEqual({
      kind: "forbidden",
      statusCode: 403,
      error: "client_identity_mismatch",
      userId: "user-1",
      requestedUserId: "user-2",
      provider: "supertokens",
      subject: "st-user-123",
    });
  });

  it("allows the temporary compatibility path when requestedUserId matches the resolved user", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => ({
        id: "user-1",
        name: "Brian",
        role: "user",
        status: "active",
      }),
    };

    await expect(
      resolveCurrentUser(
        {
          session: { provider: "supertokens", subject: "st-user-123" },
          requestedUserId: "user-1",
        },
        deps,
      ),
    ).resolves.toEqual({
      kind: "linked",
      user: { id: "user-1", name: "Brian", role: "user", status: "active" },
      provider: "supertokens",
      subject: "st-user-123",
    });
  });

  it("returns account_inactive when the linked Astral user is not active", async () => {
    const deps: ResolveCurrentUserDeps = {
      findUserByIdentity: async () => ({
        id: "user-1",
        name: "Brian",
        role: "user",
        status: "disabled",
      }),
    };

    await expect(
      resolveCurrentUser(
        {
          session: { provider: "supertokens", subject: "st-user-123" },
        },
        deps,
      ),
    ).resolves.toEqual({
      kind: "inactive",
      statusCode: 403,
      error: "account_inactive",
      status: "disabled",
      userId: "user-1",
      provider: "supertokens",
      subject: "st-user-123",
    });
  });
});
