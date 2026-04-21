import { describe, expect, it } from "vitest";

import {
  getAuthRedirectFailureDisplay,
  getAuthRequiredConfigDisplay,
  getCurrentUserFailureDisplay,
  getInactiveAccountErrorDisplay,
} from "../../../frontend/src/auth/bootstrap-errors";
import {
  buildCleanAuthPath,
  buildStoredAttempt,
  getCodeConsumeErrorMessage,
  getStepForFlowType,
  hasMagicLinkAttempt,
  readRedirectToPath,
  shouldAutoConsumeMagicLink,
  shouldPreserveAuthRedirect,
} from "../../../frontend/src/auth/helpers";

describe("frontend auth helpers", () => {
  it("only accepts safe internal redirect targets", () => {
    expect(readRedirectToPath("?redirectToPath=%2Fchat")).toBe("/chat");
    expect(readRedirectToPath("?redirectToPath=https%3A%2F%2Fevil.test")).toBeNull();
    expect(readRedirectToPath("?redirectToPath=%2F%2Fevil.test")).toBeNull();
    expect(readRedirectToPath("")).toBeNull();
  });

  it("detects magic-link attempts and whether they can be auto-consumed", () => {
    expect(hasMagicLinkAttempt("?preAuthSessionId=pre-123", "#link-code")).toBe(true);
    expect(hasMagicLinkAttempt("", "#link-code")).toBe(false);

    expect(
      shouldAutoConsumeMagicLink("?preAuthSessionId=pre-123", "#link-code", {
        preAuthSessionId: "pre-123",
      }),
    ).toBe(true);

    expect(
      shouldAutoConsumeMagicLink("?preAuthSessionId=pre-123", "#link-code", {
        preAuthSessionId: "pre-999",
      }),
    ).toBe(false);
  });

  it("maps flow types to the Astral auth steps", () => {
    expect(getStepForFlowType("MAGIC_LINK")).toBe("link-sent");
    expect(getStepForFlowType("USER_INPUT_CODE")).toBe("code");
    expect(getStepForFlowType("USER_INPUT_CODE_AND_MAGIC_LINK")).toBe("code");
  });

  it("builds stored passwordless metadata for the custom auth flow", () => {
    const attempt = buildStoredAttempt({
      contactInfo: "daniela@astral.test",
      deviceId: "device-1",
      flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
      preAuthSessionId: "pre-1",
      redirectToPath: "/chat",
    });

    expect(attempt).toMatchObject({
      contactInfo: "daniela@astral.test",
      deviceId: "device-1",
      flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
      preAuthSessionId: "pre-1",
      redirectToPath: "/chat",
    });
    expect(attempt.lastResendAt).toEqual(expect.any(Number));
  });

  it("keeps auth resets on the clean Astral route while preserving redirectBack", () => {
    expect(buildCleanAuthPath("/auth", "/chat")).toBe("/auth?redirectToPath=%2Fchat");
    expect(buildCleanAuthPath("/auth", null)).toBe("/auth");
  });

  it("only preserves redirectBack for non-root non-auth routes", () => {
    expect(shouldPreserveAuthRedirect("/", "/auth")).toBe(false);
    expect(shouldPreserveAuthRedirect("/auth", "/auth")).toBe(false);
    expect(shouldPreserveAuthRedirect("/auth/step", "/auth")).toBe(false);
    expect(shouldPreserveAuthRedirect("/admin/users", "/auth")).toBe(true);
  });

  it("translates OTP failures into support-friendly copy", () => {
    expect(
      getCodeConsumeErrorMessage({
        failedCodeInputAttemptCount: 2,
        maximumCodeInputAttempts: 5,
        status: "INCORRECT_USER_INPUT_CODE_ERROR",
      }),
    ).toBe("Ese codigo no coincide. Intento 2 de 5.");

    expect(
      getCodeConsumeErrorMessage({
        failedCodeInputAttemptCount: 3,
        maximumCodeInputAttempts: 5,
        status: "EXPIRED_USER_INPUT_CODE_ERROR",
      }),
    ).toBe("Ese codigo expiro. Reenviá un acceso nuevo.");
  });

  it("maps bootstrap failures to precise auth and connectivity copy", () => {
    expect(getAuthRedirectFailureDisplay()).toEqual({
      title: "No se pudo abrir Astral Guide",
      body: "No pudimos iniciar tu acceso en este momento. Reintentá en unos segundos.",
      retryable: true,
    });

    expect(getAuthRequiredConfigDisplay()).toEqual({
      title: "Acceso no disponible",
      body: "Ahora mismo no pudimos abrir tu acceso. Probá de nuevo más tarde.",
      retryable: false,
    });

    expect(getInactiveAccountErrorDisplay("disabled")).toEqual({
      title: "Cuenta deshabilitada",
      body: "Tu cuenta está deshabilitada por ahora. Contactanos para reactivarla.",
      retryable: false,
    });

    expect(
      getCurrentUserFailureDisplay(new TypeError("Failed to fetch")),
    ).toEqual({
      title: "No se pudo conectar con Astral Guide",
      body: "No pudimos recuperar tu sesión en este momento. Revisá tu conexión y reintentá.",
      retryable: true,
    });

    expect(
      getCurrentUserFailureDisplay(new Error("Get current user error 500: boom")),
    ).toEqual({
      title: "No se pudo abrir Astral Guide",
      body: "No pudimos abrir tu espacio en este momento. Reintentá en unos segundos.",
      retryable: true,
    });
  });
});
