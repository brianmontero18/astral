import type { DesignReport, ReportSection } from "./types";

export interface ReportViewModel {
  freeSections: ReportSection[];
  premiumSections: ReportSection[];
  premiumUnlocked: boolean;
  premiumCtaTitle: string | null;
  premiumCtaBody: string | null;
  premiumCtaLabel: string | null;
}

export function buildReportViewModel(report: DesignReport): ReportViewModel {
  const freeSections = report.sections.filter((section) => section.tier === "free");
  const premiumSections = report.sections.filter((section) => section.tier === "premium");
  const premiumUnlocked = report.tier === "premium";

  if (premiumUnlocked) {
    return {
      freeSections,
      premiumSections,
      premiumUnlocked,
      premiumCtaTitle: null,
      premiumCtaBody: null,
      premiumCtaLabel: null,
    };
  }

  return {
    freeSections,
    premiumSections,
    premiumUnlocked,
    premiumCtaTitle: "✦ Continuación aplicada del informe",
    premiumCtaBody: `Desbloqueá las ${premiumSections.length} secciones que completan tu informe con trabajo, decisiones, posicionamiento, clientes y próximos pasos.`,
    premiumCtaLabel: "Completar mi informe",
  };
}
