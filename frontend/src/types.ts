/**
 * Shared Types
 *
 * Estos tipos deben mantenerse sincronizados con el backend (astral-backend/src/agent-service.ts).
 * Claude Code: no modificar sin actualizar también el backend.
 */

// ─── Perfil del usuario ───────────────────────────────────────────────────────

export interface HumanDesignChannel {
  id: string;       // ej: "20-34"
  name: string;     // ej: "Canal de Carisma"
  circuit: string;  // ej: "Integración"
}

export interface HumanDesignGate {
  number: number;
  line: number;
  planet: string;
  isPersonality: boolean;
}

export interface UserProfile {
  name: string;
  birthData?: {
    date: string;
    time: string;
    location: string;
  };
  humanDesign: {
    type: string;
    strategy: string;
    authority: string;
    profile: string;
    definition: string;
    incarnationCross: string;
    notSelfTheme: string;
    variable: string;
    digestion: string;
    environment: string;
    strongestSense: string;
    channels: HumanDesignChannel[];
    activatedGates: HumanDesignGate[];
    definedCenters: string[];
    undefinedCenters: string[];
  };
}

// ─── Intake ───────────────────────────────────────────────────────────────────

export type TipoNegocio =
  | "mentora"
  | "coach"
  | "marca_personal"
  | "servicios_premium"
  | "branding"
  | "otro";

/**
 * Intake del negocio. Schema espejo del backend.
 * Premium (8 campos extra) llega en bead astral-y3c.11.
 */
export interface Intake {
  actividad?: string;
  desafio_actual?: string;
  tipo_de_negocio?: TipoNegocio;
  objetivo_12m?: string;
  voz_marca?: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  tier: "free" | "premium";
  staticContent: string;
  llmContent?: string;
  previewContent?: string;
  teaser?: boolean;
}

export interface DesignReport {
  id: string;
  userId: string;
  tier: "free" | "premium";
  profileHash: string;
  sections: ReportSection[];
  tokensUsed: number;
  costUsd: number;
  createdAt: string;
  degraded?: boolean;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string;
  transits_used: string; // ISO datetime of when transits were fetched
  userMsgId?: number;
  assistantMsgId?: number;
}

export interface PlanetTransit {
  name: string;
  longitude: number;
  sign: string;
  degree: number;
  isRetrograde: boolean;
  hdGate: number;
  hdLine: number;
}

export interface PersonalChannel {
  channelId: string;
  channelName: string;
  userGate: number;
  transitGate: number;
  transitPlanet: string;
}

export interface TransitImpact {
  personalChannels: PersonalChannel[];
  educationalChannels: Array<{ channelId: string; channelName: string; planet1: string; planet2: string }>;
  reinforcedGates: Array<{ gate: number; planet: string }>;
  conditionedCenters: Array<{ center: string; gates: Array<{ gate: number; planet: string }> }>;
}

export interface TransitsResponse {
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
  impact?: TransitImpact;
}

// ─── Navigation ──────────────────────────────────────────────────────────────

export type View = "onboarding" | "chat" | "transits" | "assets" | "intake" | "report";
export type NavView = Exclude<View, "onboarding">;

// ─── Local storage types ─────────────────────────────────────────────────────

export type AppUserRole = "user" | "admin";
export type AppUserStatus = "active" | "disabled" | "banned";
export type AppUserPlan = "free" | "basic" | "premium";

export interface LocalUser {
  id: string;
  name: string;
  role: AppUserRole;
  status: AppUserStatus;
  plan: AppUserPlan;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string | null;
  plan: AppUserPlan;
  status: AppUserStatus;
  role: AppUserRole;
  linked: boolean;
  createdAt: string;
}

export interface AdminUserListResponse {
  users: AdminUserSummary[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  rangeStart: number;
  rangeEnd: number;
}

export interface AdminUserAccessValues {
  plan: AppUserPlan;
  status: AppUserStatus;
  role: AppUserRole;
}

export interface AdminUserAccessPatch {
  plan?: AppUserPlan;
  status?: AppUserStatus;
  role?: AppUserRole;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string | null;
  plan: AppUserPlan;
  status: AppUserStatus;
  role: AppUserRole;
  linked: boolean;
  authIdentity: null | {
    provider: "supertokens";
    subject: string;
  };
  support: {
    messagesUsed: number;
    messageLimit: number | null;
    assetCount: number;
    reportsAvailable: Array<"free" | "premium">;
  };
  humanDesign: {
    type: string | null;
    authority: string | null;
    profile: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type LlmCallRoute = "chat" | "chat_stream" | "report" | "extraction";

export interface AdminUserLlmUsageBreakdownEntry {
  callCount: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface AdminUserLlmUsage {
  days: number;
  since: string;
  totalCallCount: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  byRoute: Array<{ route: LlmCallRoute } & AdminUserLlmUsageBreakdownEntry>;
  byModel: Array<{ model: string } & AdminUserLlmUsageBreakdownEntry>;
}

export interface AssetMeta {
  id: string;
  filename: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  createdAt: string;
}
