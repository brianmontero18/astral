import { describe, expect, it } from "vitest";

import { getOnboardingFailureMessage } from "../../../frontend/src/onboarding-errors";

describe("frontend onboarding error helpers", () => {
  it("preserves the contracted extractor guidance for supported user-facing failures", () => {
    const pdfOnly =
      "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.";
    const unsupported =
      "Solo aceptamos PDFs oficiales de MyHumanDesign o Genetic Matrix. Reexporta el bodygraph desde la fuente oficial.";
    const unreadable =
      "No pudimos leer tu PDF. Reexporta el bodygraph desde la fuente oficial y vuelve a subirlo.";

    expect(getOnboardingFailureMessage(new Error(pdfOnly))).toBe(pdfOnly);
    expect(getOnboardingFailureMessage(new Error(unsupported))).toBe(unsupported);
    expect(getOnboardingFailureMessage(new Error(unreadable))).toBe(unreadable);
  });

  it("maps missing file, invalid upload and connectivity failures to safe retry copy", () => {
    expect(getOnboardingFailureMessage(new Error("No file uploaded"))).toBe(
      "Elegí un PDF antes de continuar.",
    );

    expect(
      getOnboardingFailureMessage(
        new Error("Invalid file type: application/octet-stream"),
      ),
    ).toBe(
      "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.",
    );

    expect(
      getOnboardingFailureMessage(new TypeError("Failed to fetch")),
    ).toBe("No pudimos leer tu carta ahora. Reintentá en unos segundos.");
  });

  it("hides internal extractor/bootstrap details behind a generic fallback", () => {
    expect(
      getOnboardingFailureMessage(new Error("vector store timeout on worker 3")),
    ).toBe("No pudimos leer tu carta ahora. Reintentá con otro PDF o probá de nuevo.");

    expect(
      getOnboardingFailureMessage(new Error("Update current user error 500: boom")),
    ).toBe("No pudimos leer tu carta ahora. Reintentá con otro PDF o probá de nuevo.");
  });
});
