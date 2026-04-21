type SessionRequest = {
  headers: Record<string, string | string[] | undefined>;
};

export async function resolveTestSessionPrincipal(request: SessionRequest) {
  const header = request.headers["x-test-session-subject"];
  const subject = Array.isArray(header) ? header[0] : header;

  if (!subject) {
    return null;
  }

  return {
    provider: "supertokens" as const,
    subject,
  };
}

export function mockSessionModule() {
  return {
    getOptionalSessionPrincipal: resolveTestSessionPrincipal,
  };
}
