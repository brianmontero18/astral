import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfile } from "../agent-service.js";
import { generateReport } from "../report/generate-report.js";

const profile: UserProfile = {
  name: "Astral Test User",
  humanDesign: {
    type: "Generador",
    strategy: "Responder",
    authority: "Emocional (Plexo Solar)",
    profile: "2/5",
    definition: "Definición dividida",
    incarnationCross: "Cruz de Ángulo Recto de las Cuatro Vías",
    notSelfTheme: "Frustración",
    variable: "",
    digestion: "Apetito alternante",
    environment: "Cocinas",
    strongestSense: "Visión interna",
    channels: [
      { id: "5-15", name: "Canal del Ritmo", circuit: "Collective Understanding" },
      { id: "19-49", name: "Canal de la Síntesis", circuit: "Tribal Defense" },
    ],
    activatedGates: [],
    definedCenters: ["G", "Sacral", "SolarPlexus", "Root"],
    undefinedCenters: ["Head", "Ajna", "Throat", "Heart"],
  },
};

const intake = {
  actividad: "Mentora y creadora de contenido",
  objetivos: "Ordenar mejor mi oferta",
  desafios: "Me sobreexijo y me cuesta sostener foco",
};

function mockFetchWithSections(sectionBodies: string[]) {
  const responseBody = sectionBodies.join("\n[SECTION]\n");

  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ message: { content: responseBody } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    ),
  );
}

describe("generateReport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps a single incremental report surface for free reports", async () => {
    vi.stubGlobal("fetch", mockFetchWithSections([
      "Lectura aplicada del tipo",
      "Lectura aplicada de la autoridad",
      "Teaser del perfil y continuidad del informe",
    ]));

    const report = await generateReport(profile, "free", "test-key", intake);

    expect(report.sections.map((section) => section.id)).toEqual([
      "mechanical-chart",
      "type",
      "authority",
      "profile",
      "work-rhythm",
      "decision-style",
      "positioning-offer",
      "client-dynamics",
      "visibility-sales",
      "next-30-days",
    ]);

    expect(report.sections.find((section) => section.id === "profile")?.teaser).toBe(true);

    const premiumSections = report.sections.filter((section) => section.tier === "premium");
    expect(premiumSections).toHaveLength(6);
    expect(premiumSections.every((section) => section.previewContent && section.previewContent.length > 0)).toBe(true);
    expect(premiumSections.every((section) => !section.llmContent)).toBe(true);
    expect(premiumSections.every((section) => section.staticContent === "")).toBe(true);
  });

  it("unlocks the premium continuation inside the same report for premium users", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: [
              "Lectura aplicada del tipo",
              "Lectura aplicada de la autoridad",
              "Perfil completo aplicado",
              "Diagnóstico de trabajo y ritmo",
            ].join("\n[SECTION]\n"),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: [
              "Timing y patrón de decisión",
              "Posicionamiento y oferta",
              "Cliente ideal y límites",
            ].join("\n[SECTION]\n"),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: [
              "Visibilidad y venta alineadas",
              [
                "Apertura breve de mentoring.",
                "3 movimientos para hacer ahora",
                "- Ordená tu oferta alrededor del problema correcto.",
                "- Protegé bloques de trabajo con ritmo sostenible.",
                "- Tomá decisiones importantes después de más claridad emocional.",
                "3 cosas para dejar de forzar",
                "- Publicar por presión.",
                "- Decidir en caliente.",
                "- Sostener clientes sin fit.",
                "1 señal a observar este mes",
                "- Cuándo aparece alivio en el cuerpo al elegir.",
              ].join("\n"),
            ].join("\n[SECTION]\n"),
          },
        }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    vi.stubGlobal("fetch", fetchMock);

    const report = await generateReport(profile, "premium", "test-key", intake);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(report.sections.map((section) => section.id)).toEqual([
      "mechanical-chart",
      "type",
      "authority",
      "profile",
      "work-rhythm",
      "decision-style",
      "positioning-offer",
      "client-dynamics",
      "visibility-sales",
      "next-30-days",
    ]);

    expect(report.sections.find((section) => section.id === "profile")?.teaser).toBe(false);
    expect(report.sections.find((section) => section.id === "work-rhythm")?.llmContent).toContain("Diagnóstico de trabajo");
    expect(report.sections.find((section) => section.id === "next-30-days")?.llmContent).toContain("3 movimientos para hacer ahora");
    expect(report.sections.find((section) => section.id === "next-30-days")?.llmContent).toContain("1 señal a observar este mes");
    expect(report.sections.some((section) => section.id === "definition")).toBe(false);
    expect(report.sections.some((section) => section.id === "channels")).toBe(false);
  });
});
