import { describe, expect, it } from "vitest";

import { buildReportViewModel } from "../../../frontend/src/report-view-model";
import type { DesignReport } from "../../../frontend/src/types";

function buildReport(tier: "free" | "premium"): DesignReport {
  return {
    id: `report-${tier}`,
    userId: "user-1",
    tier,
    profileHash: "hash-1",
    tokensUsed: 42,
    costUsd: 0.01,
    createdAt: "2026-04-19T12:00:00.000Z",
    sections: [
      { id: "mechanical-chart", title: "Tu Carta Mecánica", icon: "⚙️", tier: "free", staticContent: "Tipo: Generador" },
      { id: "type", title: "Tu Tipo", icon: "🔋", tier: "free", staticContent: "Base de tipo", llmContent: "Lectura aplicada del tipo." },
      { id: "authority", title: "Tu Autoridad", icon: "🧭", tier: "free", staticContent: "Base de autoridad", llmContent: "Lectura aplicada de autoridad." },
      { id: "profile", title: "Tu Perfil", icon: "🎭", tier: "free", staticContent: "Base de perfil", llmContent: "Lectura teaser del perfil.", teaser: tier === "free" },
      { id: "work-rhythm", title: "Cómo trabajás mejor", icon: "⏱️", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "Diagnóstico de ritmo sostenible." : "", previewContent: "Tu ritmo sostenible, dónde te forzás de más y qué condiciones te ayudan a sostener resultados." },
      { id: "decision-style", title: "Cómo decidir sin forzarte", icon: "🧭", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "Lectura de timing y claridad." : "", previewContent: "Tu timing real para decidir, qué patrón te hace apurarte y cómo detectar claridad genuina." },
      { id: "positioning-offer", title: "Dónde está tu mayor valor", icon: "💼", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "Lectura de oferta y posicionamiento." : "", previewContent: "Cómo se traduce tu diseño en propuesta de valor, tipo de oferta y problema que mejor resolvés." },
      { id: "client-dynamics", title: "Con quién sí, con quién no", icon: "🤝", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "Lectura de cliente ideal y límites." : "", previewContent: "Señales de fit, límites necesarios, red flags y dinámicas que protegen tu energía y tus resultados." },
      { id: "visibility-sales", title: "Cómo te conviene comunicar y vender", icon: "📣", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "Lectura de visibilidad y venta." : "", previewContent: "Tu mejor estilo de visibilidad, comunicación y venta sin forzar una estrategia que no es tuya." },
      { id: "next-30-days", title: "Próximos 30 días", icon: "🗓️", tier: "premium", staticContent: "", llmContent: tier === "premium" ? "3 movimientos para hacer ahora\n- Acción 1" : "", previewContent: "Una síntesis de mentoring con movimientos concretos, cosas a dejar de forzar y una señal para observar." },
    ],
  };
}

describe("frontend report view model", () => {
  it("keeps a single free/basic report surface with locked premium continuation", () => {
    const viewModel = buildReportViewModel(buildReport("free"));

    expect(viewModel.premiumUnlocked).toBe(false);
    expect(viewModel.freeSections).toHaveLength(4);
    expect(viewModel.premiumSections).toHaveLength(6);
    expect(viewModel.premiumSections.every((section) => !section.llmContent)).toBe(true);
    expect(viewModel.premiumCtaTitle).toBe("✦ Continuación aplicada del informe");
    expect(viewModel.premiumCtaBody).toContain("Desbloqueá las 6 secciones");
    expect(viewModel.premiumCtaLabel).toBe("Completar mi informe");
  });

  it("unlocks the continuation in place for premium reports", () => {
    const viewModel = buildReportViewModel(buildReport("premium"));

    expect(viewModel.premiumUnlocked).toBe(true);
    expect(viewModel.premiumSections.find((section) => section.id === "work-rhythm")?.llmContent).toContain("Diagnóstico de ritmo sostenible.");
    expect(viewModel.premiumSections.find((section) => section.id === "next-30-days")?.llmContent).toContain("3 movimientos para hacer ahora");
    expect(viewModel.premiumCtaTitle).toBeNull();
    expect(viewModel.premiumCtaBody).toBeNull();
    expect(viewModel.premiumCtaLabel).toBeNull();
  });
});
