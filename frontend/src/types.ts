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

export interface Intake {
  actividad?: string;
  objetivos?: string;
  desafios?: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface ReportSection {
  id: string;
  title: string;
  icon: string;
  tier: "free" | "premium";
  staticContent: string;
  llmContent?: string;
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

export interface LocalUser {
  id: string;
  name: string;
}

export interface AssetMeta {
  id: string;
  filename: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  createdAt: string;
}
