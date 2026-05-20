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
    /** Local ISO datetime con offset (ej "1988-12-28T04:13:00-02:00"). */
    dateLocalIso: string;
    /** UTC ISO datetime (ej "1988-12-28T06:13:00.000Z"). */
    dateUtcIso: string;
    /** Display label del lugar (ej "Esquel, Chubut, Argentina"). */
    placeLabel?: string;
    /** Coordenadas geográficas — fuente de verdad para resolver tz histórica. */
    coordinates?: { lat: number; lon: number };
    /** Offset UTC efectivo, signed hours fraccionales (ej -2 para Esquel DST 1988). */
    timezoneOffsetHours?: number;
    /** Edad calculada al momento de la lectura. */
    ageYears?: number;
  };
  humanDesign: {
    type: string;
    /** Cualificador del tipo (ej "Emocional", "Mental"). Derivado de la autoridad. */
    typeQualifier?: string;
    strategy: string;
    authority: string;
    profile: string;
    /** Nombre canónico del perfil (ej "Modelo a Seguir / Ermitaño"). */
    profileName?: string;
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
    /** Design moment ISO — usado en el footer "Fecha del Diseño". */
    design?: { date: string };
    /** Variable Wheel labels canónicas (16 properties, computeVariableLabels). */
    variableLabels?: {
      brain: string;
      determination: string;
      determinationCategory: string;
      cognition: string;
      environment: string;
      environmentDetail: string;
      environmentStyle: string;
      personality: string;
      motivation: string;
      sense: string;
      trajectory: string;
      viewPerspective: string;
      view: string;
      transferredMotivation: string;
      transferredView: string;
    };
  };
}

// ─── Intake ───────────────────────────────────────────────────────────────────

export type TipoNegocio =
  | "sin_negocio"
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
export type AppUserOnboardingStatus = "pending" | "complete";
export type AppUserOnboardingStep = "name" | "upload" | "review" | "intake";
export type AppUserAccessSource = "self" | "manual" | "payment";

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
  onboardingStatus: AppUserOnboardingStatus;
  onboardingStep: AppUserOnboardingStep | null;
  accessSource: AppUserAccessSource;
  createdAt: string;
  updatedAt: string;
}

export interface AdminInviteRequest {
  email: string;
  plan: AppUserPlan;
  name?: string;
}

export interface AdminInviteSuccess {
  userId: string;
  plan: AppUserPlan;
  isNewUser: boolean;
  magicLink: string;
  expiresAt: string;
}

export interface AdminInviteSendFailure {
  error: "invite_send_failed";
  userId: string;
  plan: AppUserPlan;
  isNewUser: boolean;
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
  /**
   * True when this asset is the bodygraph backing the user's current
   * Diseño Humano profile. The backend derives it from users.profile_asset_id.
   * UI marks it with an "En uso" pill and sorts it to the top.
   */
  isActive?: boolean;
}
