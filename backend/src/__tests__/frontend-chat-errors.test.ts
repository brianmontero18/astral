import { describe, expect, it } from "vitest";

import { getChatFailureMessage } from "../../../frontend/src/chat-errors";

describe("frontend chat error helpers", () => {
  it("maps auth/session failures to safe re-entry copy", () => {
    expect(
      getChatFailureMessage(new Error('Backend error 401: {"error":"authentication_required"}')),
    ).toBe("Tu sesión se cerró o venció. Volvé a entrar para seguir.");

    expect(
      getChatFailureMessage(new Error("identity_not_linked")),
    ).toBe("Tu sesión se cerró o venció. Volvé a entrar para seguir.");
  });

  it("maps connectivity failures to safe retry copy", () => {
    expect(
      getChatFailureMessage(new TypeError("Failed to fetch")),
    ).toBe("No pudimos conectar con Astral Guide en este momento. Revisá tu conexión y reintentá.");
  });

  it("maps timeout-style failures to explicit timeout copy", () => {
    expect(
      getChatFailureMessage(new Error("Request timed out while waiting for stream")),
    ).toBe("La respuesta tardó demasiado. Probá de nuevo.");
  });

  it("keeps generic backend failures user-safe", () => {
    expect(
      getChatFailureMessage(new Error("OpenAI API error 500: boom")),
    ).toBe("No se pudo responder en este momento. Probá de nuevo.");
  });
});
