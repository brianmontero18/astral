export type TipoNegocio =
  | "sin_negocio"
  | "mentora"
  | "coach"
  | "marca_personal"
  | "servicios_premium"
  | "branding"
  | "otro";

/**
 * Intake del negocio del usuario (esquema mínimo, 5 campos).
 *
 * Los 2 primeros (actividad, desafio_actual) son obligatorios en los forms
 * del frontend pero opcionales en el TYPE para tolerar JSON parcial cargado
 * desde DB (ej: rows antiguas con alguno vacío).
 *
 * El form premium con 8 campos extendidos (etapa_negocio, oferta_principal,
 * cliente_ideal, ritmo_actual, que_te_drena, que_te_enciende, mayor_bloqueo,
 * decision_pendiente) llega en bead astral-y3c.11 — follow-up.
 */
export interface Intake {
  actividad?: string;
  desafio_actual?: string;
  tipo_de_negocio?: TipoNegocio;
  objetivo_12m?: string;
  voz_marca?: string;
}

export type ReportTier = "free" | "premium";

export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  tier: ReportTier;
  staticContent: string;
  llmContent?: string;
  previewContent?: string;
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
  "work-rhythm",
  "decision-style",
  "positioning-offer",
  "client-dynamics",
  "visibility-sales",
  "next-30-days",
] as const;

export type SectionId = (typeof SECTION_ORDER)[number];

export interface SectionMeta {
  id: SectionId;
  title: string;
  icon: string;
  tier: ReportTier;
  previewContent?: string;
  teaser?: boolean;
}

export const SECTION_META: SectionMeta[] = [
  { id: "mechanical-chart", title: "Tu Carta Mecánica", icon: "⚙️", tier: "free" },
  { id: "type", title: "Tu Tipo", icon: "🔋", tier: "free" },
  { id: "authority", title: "Tu Autoridad", icon: "🧭", tier: "free" },
  { id: "profile", title: "Tu Perfil", icon: "🎭", tier: "free", teaser: true },
  {
    id: "work-rhythm",
    title: "Cómo trabajás mejor",
    icon: "⏱️",
    tier: "premium",
    previewContent: "Tu ritmo sostenible, dónde te forzás de más y qué condiciones te ayudan a sostener resultados.",
  },
  {
    id: "decision-style",
    title: "Cómo decidir sin forzarte",
    icon: "🧭",
    tier: "premium",
    previewContent: "Tu timing real para decidir, qué patrón te hace apurarte y cómo detectar claridad genuina.",
  },
  {
    id: "positioning-offer",
    title: "Dónde está tu mayor valor",
    icon: "💼",
    tier: "premium",
    previewContent: "Cómo se traduce tu diseño en propuesta de valor, tipo de oferta y problema que mejor resolvés.",
  },
  {
    id: "client-dynamics",
    title: "Con quién sí, con quién no",
    icon: "🤝",
    tier: "premium",
    previewContent: "Señales de fit, límites necesarios, red flags y dinámicas que protegen tu energía y tus resultados.",
  },
  {
    id: "visibility-sales",
    title: "Cómo te conviene comunicar y vender",
    icon: "📣",
    tier: "premium",
    previewContent: "Tu mejor estilo de visibilidad, comunicación y venta sin forzar una estrategia que no es tuya.",
  },
  {
    id: "next-30-days",
    title: "Próximos 30 días",
    icon: "🗓️",
    tier: "premium",
    previewContent: "Una síntesis de mentoring con movimientos concretos, cosas a dejar de forzar y una señal para observar.",
  },
];
