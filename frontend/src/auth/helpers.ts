export type AstralPasswordlessFlowType =
  | "MAGIC_LINK"
  | "USER_INPUT_CODE"
  | "USER_INPUT_CODE_AND_MAGIC_LINK";

export type AstralAuthStep =
  | "email"
  | "code"
  | "link-sent"
  | "magic-link-ready"
  | "verifying"
  | "invite-while-signed-in";

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

export type MagicLinkIntent = "invite";

// Reads the optional intent flag carried in admin-minted magic links. We
// only accept the literal "invite" value — anything else is treated as
// missing so attackers cannot widen auto-consume by forging arbitrary
// intent strings.
export function readMagicLinkIntent(search: string): MagicLinkIntent | null {
  const raw = new URLSearchParams(search).get("intent");
  return raw === "invite" ? "invite" : null;
}

export function hasMagicLinkAttempt(search: string, hash: string): boolean {
  return readPreAuthSessionId(search) !== null && readLinkCode(hash) !== null;
}

// True when a recipient lands on an admin invite link while already
// holding an active session. The bootstrap flow uses this to show the
// "close session and open invitation" intermediate screen instead of
// silently redirecting away and burning the invite.
export function isInviteWhileSignedIn(input: {
  hasActiveSession: boolean;
  hash: string;
  search: string;
}): boolean {
  if (!input.hasActiveSession) return false;
  if (readMagicLinkIntent(input.search) !== "invite") return false;
  return hasMagicLinkAttempt(input.search, input.hash);
}

// Decides whether the auth screen should consume the magic link without
// asking the visitor for an extra confirmation click.
//
// User-initiated logins keep the strict same-browser rule: the visitor's
// own attempt state must match the link's preAuthSessionId. That is a
// CSRF-style defense for self-served links.
//
// Admin invites carry intent=invite. They are minted from the admin panel
// and arrive in a different browser than the one that requested them, so
// the strict rule would force an unnecessary "Continuar con este enlace"
// click. Auto-consume is safe because the link itself is one-time, expires
// quickly, and is delivered to the recipient's email under SuperTokens'
// own threat model.
export function shouldAutoConsumeMagicLink(
  search: string,
  hash: string,
  attempt: Pick<StoredPasswordlessAttempt, "preAuthSessionId"> | null | undefined,
): boolean {
  const preAuthSessionId = readPreAuthSessionId(search);
  const linkCode = readLinkCode(hash);

  if (!preAuthSessionId || !linkCode) {
    return false;
  }

  if (attempt && attempt.preAuthSessionId === preAuthSessionId) {
    return true;
  }

  return readMagicLinkIntent(search) === "invite";
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
