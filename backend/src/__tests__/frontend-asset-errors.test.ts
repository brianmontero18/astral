import { describe, expect, it } from "vitest";

import { getAssetFailureMessage } from "../../../frontend/src/asset-errors";

describe("frontend asset error helpers", () => {
  it("maps validation and permission failures to safe copy", () => {
    expect(
      getAssetFailureMessage(new Error("No file uploaded"), "fallback"),
    ).toBe("Elegí un archivo antes de continuar.");

    expect(
      getAssetFailureMessage(
        new Error("Invalid file type: application/octet-stream"),
        "fallback",
      ),
    ).toBe("Podés subir PDF, PNG, JPG o TXT.");

    expect(
      getAssetFailureMessage(new Error("File exceeds 10MB limit"), "fallback"),
    ).toBe("El archivo supera el límite de 10 MB.");

    expect(
      getAssetFailureMessage(new Error("asset_forbidden"), "fallback"),
    ).toBe("No tenés acceso a este archivo.");
  });

  it("maps missing and connectivity failures without leaking transport details", () => {
    expect(
      getAssetFailureMessage(new Error("Asset not found"), "fallback"),
    ).toBe("Ese archivo ya no está disponible.");

    expect(
      getAssetFailureMessage(new TypeError("Failed to fetch"), "fallback"),
    ).toBe(
      "No pudimos conectar tus archivos en este momento. Reintentá en unos segundos.",
    );
  });

  it("keeps the contracted HD upload guidance and generic fallbacks", () => {
    const hdCopy =
      "Subi un PDF exportado desde MyHumanDesign o Genetic Matrix. No aceptamos imagenes ni capturas.";

    expect(getAssetFailureMessage(new Error(hdCopy), "fallback")).toBe(hdCopy);
    expect(getAssetFailureMessage(new Error("Assets error 500"), "fallback")).toBe(
      "fallback",
    );
  });
});
