import { describe, expect, it } from "vitest";

import { getTransitFailureMessage } from "../../../frontend/src/transit-errors";

describe("frontend transit error helpers", () => {
  it("maps auth/session failures to safe re-entry copy", () => {
    expect(
      getTransitFailureMessage(new Error("Transits error 401")),
    ).toBe("Tu sesión se cerró o venció. Volvé a entrar para ver tus tránsitos.");

    expect(
      getTransitFailureMessage(new Error("client_identity_mismatch")),
    ).toBe("Tu sesión se cerró o venció. Volvé a entrar para ver tus tránsitos.");
  });

  it("maps connectivity failures to safe retry copy", () => {
    expect(
      getTransitFailureMessage(new TypeError("Failed to fetch")),
    ).toBe("No pudimos cargar tus tránsitos ahora. Revisá tu conexión y reintentá.");
  });

  it("keeps generic backend failures user-safe", () => {
    expect(
      getTransitFailureMessage(new Error("OpenAI API error 500: boom")),
    ).toBe("No pudimos cargar tus tránsitos ahora. Probá de nuevo.");
  });
});
