export type AstralPasswordlessFlowType =
  | "MAGIC_LINK"
  | "USER_INPUT_CODE"
  | "USER_INPUT_CODE_AND_MAGIC_LINK";

export type AstralAuthStep =
  | "email"
  | "code"
  | "link-sent"
  | "magic-link-ready"
  | "verifying";

export interface StoredPasswordlessAttempt {
  deviceId: string;
  preAuthSessionId: string;
  flowType: AstralPasswordlessFlowType;
  contactInfo?: string;
  redirectToPath?: string;
  lastResendAt?: number;
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const trimmed = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return trimmed || "/";
}

export function readRedirectToPath(search: string): string | null {
  const value = new URLSearchParams(search).get("redirectToPath");

  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

export function readPreAuthSessionId(search: string): string | null {
  return new URLSearchParams(search).get("preAuthSessionId");
}

export function readLinkCode(hash: string): string | null {
  const value = hash.replace(/^#/, "").trim();
  return value.length > 0 ? value : null;
}

export function hasMagicLinkAttempt(search: string, hash: string): boolean {
  return readPreAuthSessionId(search) !== null && readLinkCode(hash) !== null;
}

export function shouldAutoConsumeMagicLink(
  search: string,
  hash: string,
  attempt: Pick<StoredPasswordlessAttempt, "preAuthSessionId"> | null | undefined,
): boolean {
  const preAuthSessionId = readPreAuthSessionId(search);

  return Boolean(
    preAuthSessionId &&
      readLinkCode(hash) &&
      attempt &&
      attempt.preAuthSessionId === preAuthSessionId,
  );
}

export function getStepForFlowType(
  flowType: AstralPasswordlessFlowType,
): Extract<AstralAuthStep, "code" | "link-sent"> {
  return flowType === "MAGIC_LINK" ? "link-sent" : "code";
}

export function buildStoredAttempt(input: {
  contactInfo: string;
  deviceId: string;
  flowType: AstralPasswordlessFlowType;
  preAuthSessionId: string;
  redirectToPath: string | null;
}): StoredPasswordlessAttempt {
  return {
    deviceId: input.deviceId,
    preAuthSessionId: input.preAuthSessionId,
    flowType: input.flowType,
    contactInfo: input.contactInfo,
    redirectToPath: input.redirectToPath ?? undefined,
    lastResendAt: Date.now(),
  };
}

export function buildCleanAuthPath(
  basePath: string,
  redirectToPath: string | null,
): string {
  if (!redirectToPath) {
    return basePath;
  }

  const search = new URLSearchParams({ redirectToPath });
  return `${basePath}?${search.toString()}`;
}

export function shouldPreserveAuthRedirect(
  pathname: string,
  authBasePath: string,
): boolean {
  const normalizedPath = normalizePathname(pathname);
  const normalizedAuthBasePath = normalizePathname(authBasePath);

  return (
    normalizedPath !== "/" &&
    normalizedPath !== normalizedAuthBasePath &&
    !normalizedPath.startsWith(`${normalizedAuthBasePath}/`)
  );
}

export function getCodeConsumeErrorMessage(input: {
  failedCodeInputAttemptCount: number;
  maximumCodeInputAttempts: number;
  status: "INCORRECT_USER_INPUT_CODE_ERROR" | "EXPIRED_USER_INPUT_CODE_ERROR";
}): string {
  if (input.status === "EXPIRED_USER_INPUT_CODE_ERROR") {
    return "Ese codigo expiro. Reenviá un acceso nuevo.";
  }

  return `Ese codigo no coincide. Intento ${input.failedCodeInputAttemptCount} de ${input.maximumCodeInputAttempts}.`;
}
