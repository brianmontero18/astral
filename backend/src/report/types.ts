export interface Intake {
  actividad?: string;
  objetivos?: string;
  desafios?: string;
}

export type ReportTier = "free" | "premium";

export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  tier: ReportTier;
  staticContent: string;
  llmContent?: string;
  teaser?: boolean;
}

export interface DesignReport {
  id: string;
  userId: string;
  tier: ReportTier;
  profileHash: string;
  sections: ReportSection[];
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
  degraded?: boolean;
}

export const SECTION_ORDER = [
  "mechanical-chart",
  "type",
  "authority",
  "profile",
  "definition",
  "channels",
  "undefined-centers",
  "incarnation-cross",
  "variables",
  "strengths-shadows",
] as const;

export type SectionId = (typeof SECTION_ORDER)[number];

export interface SectionMeta {
  id: SectionId;
  title: string;
  icon: string;
  tier: ReportTier;
  teaser?: boolean;
}

export const SECTION_META: SectionMeta[] = [
  { id: "mechanical-chart", title: "Tu Carta Mecánica", icon: "⚙️", tier: "free" },
  { id: "type", title: "Tu Tipo", icon: "🔋", tier: "free" },
  { id: "authority", title: "Tu Autoridad", icon: "🧭", tier: "free" },
  { id: "profile", title: "Tu Perfil", icon: "🎭", tier: "free", teaser: true },
  { id: "definition", title: "Tu Definición", icon: "🔗", tier: "premium" },
  { id: "channels", title: "Tus Canales", icon: "⚡", tier: "premium" },
  { id: "undefined-centers", title: "Centros Indefinidos", icon: "🌀", tier: "premium" },
  { id: "incarnation-cross", title: "Cruz de Encarnación", icon: "✨", tier: "premium" },
  { id: "variables", title: "Variables", icon: "🔬", tier: "premium" },
  { id: "strengths-shadows", title: "Fortalezas y Sombras", icon: "☯️", tier: "premium" },
];
