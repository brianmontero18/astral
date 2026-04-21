import type { Page } from "@playwright/test";

import { TEST_USER_WITH_INTAKE } from "./fixtures";

export const ADMIN_USER_SESSION = {
  ...TEST_USER_WITH_INTAKE,
  id: "admin-user-1",
  name: "Admin User",
  plan: "premium" as const,
  role: "admin" as const,
  status: "active" as const,
};

export const REGULAR_USER_SESSION = {
  ...TEST_USER_WITH_INTAKE,
  id: "regular-user-1",
  name: "Regular User",
  plan: "free" as const,
  role: "user" as const,
  status: "active" as const,
};

export function isExactPath(url: string, pathname: string) {
  return new URL(url).pathname === pathname;
}

export async function mockCurrentUser(
  page: Page,
  user: typeof ADMIN_USER_SESSION | typeof REGULAR_USER_SESSION,
) {
  await page.route("**/api/me", async (route) => {
    if (route.request().method() === "GET" && isExactPath(route.request().url(), "/api/me")) {
      await route.fulfill({ status: 200, json: user });
      return;
    }

    await route.fallback();
  });
}

export function createAdminUserSummary(overrides: {
  id: string;
  name: string;
  email?: string | null;
  plan?: "free" | "basic" | "premium";
  status?: "active" | "disabled" | "banned";
  role?: "user" | "admin";
  linked?: boolean;
  createdAt?: string;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email ?? `${overrides.id}@astral.test`,
    plan: overrides.plan ?? "free",
    status: overrides.status ?? "active",
    role: overrides.role ?? "user",
    linked: overrides.linked ?? true,
    createdAt: overrides.createdAt ?? "2026-04-10T10:00:00.000Z",
  };
}

export function createAdminUserListResponse(
  users: ReturnType<typeof createAdminUserSummary>[],
  overrides?: {
    currentPage?: number;
    pageSize?: number;
    totalItems?: number;
  },
) {
  const currentPage = overrides?.currentPage ?? 1;
  const pageSize = overrides?.pageSize ?? 12;
  const totalItems = overrides?.totalItems ?? users.length;
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;
  const rangeStart = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const rangeEnd = totalItems > 0 ? rangeStart + users.length - 1 : 0;

  return {
    users,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    rangeStart,
    rangeEnd,
  };
}

export function createAdminUserDetail(overrides: {
  id: string;
  name: string;
  email?: string | null;
  plan?: "free" | "basic" | "premium";
  status?: "active" | "disabled" | "banned";
  role?: "user" | "admin";
  linked?: boolean;
  authIdentity?: { provider: "supertokens"; subject: string } | null;
  support?: {
    messagesUsed?: number;
    messageLimit?: number | null;
    assetCount?: number;
    reportsAvailable?: Array<"free" | "premium">;
  };
  humanDesign?: {
    type?: string | null;
    authority?: string | null;
    profile?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}) {
  return {
    id: overrides.id,
    name: overrides.name,
    email: overrides.email ?? `${overrides.id}@astral.test`,
    plan: overrides.plan ?? "free",
    status: overrides.status ?? "active",
    role: overrides.role ?? "user",
    linked: overrides.linked ?? true,
    authIdentity: overrides.authIdentity ?? {
      provider: "supertokens" as const,
      subject: `st-${overrides.id}`,
    },
    support: {
      messagesUsed: overrides.support?.messagesUsed ?? 8,
      messageLimit: overrides.support?.messageLimit ?? 20,
      assetCount: overrides.support?.assetCount ?? 1,
      reportsAvailable: overrides.support?.reportsAvailable ?? ["free"],
    },
    humanDesign: {
      type: overrides.humanDesign?.type ?? "Projector",
      authority: overrides.humanDesign?.authority ?? "Splenic",
      profile: overrides.humanDesign?.profile ?? "5/1",
    },
    createdAt: overrides.createdAt ?? "2026-04-10T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-12T18:10:00.000Z",
  };
}
