import { afterEach, describe, expect, it, vi } from "vitest";

import { generateReport } from "../../../frontend/src/api";
import {
  getReportFailureMessage,
  isReportFailureCode,
} from "../../../frontend/src/report-errors";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend report errors", () => {
  it.each([
    ["profile_incomplete", "Tu perfil HD no está completo. Revisá la carta cargada."],
    ["no_active_bodygraph", "Necesitamos una carta activa para generar tu informe. Cargá o calculá tu carta desde Mi Carta."],
    ["report_rate_limited", "Esperá unos segundos antes de generar otro informe."],
    ["extraction_failed", "No pudimos procesar esta carta. Probá subirla nuevamente."],
    ["model_failed", "Hubo un error temporal. Intentá en unos minutos."],
    ["intake_required", "Completá tu intake antes de generar el informe."],
    ["onboarding_required", "Terminá tu onboarding antes de generar el informe."],
    ["report_tier_not_allowed", "Tu plan actual no incluye este informe."],
  ] as const)("maps %s to specific Spanish copy", (code, expected) => {
    expect(getReportFailureMessage(new Error(code))).toBe(expected);
  });

  it("recognizes only supported report failure codes", () => {
    expect(isReportFailureCode("model_failed")).toBe(true);
    expect(isReportFailureCode("Report generation failed")).toBe(false);
  });

  it("uses a connectivity message for network failures", () => {
    expect(getReportFailureMessage(new Error("Failed to fetch"))).toBe(
      "No pudimos conectar con Astral en este momento. Revisá tu conexión y reintentá.",
    );
  });

  it("keeps backend report error codes on generateReport failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "model_failed" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(generateReport()).rejects.toMatchObject({
      code: "model_failed",
      status: 502,
      message: "model_failed",
    });
  });
});
