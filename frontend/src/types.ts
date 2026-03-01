/**
 * Shared Types
 *
 * Estos tipos deben mantenerse sincronizados con el backend (astral-backend/src/agent-service.ts).
 * Claude Code: no modificar sin actualizar también el backend.
 */

// ─── Perfil del usuario ───────────────────────────────────────────────────────

export interface NatalPlanet {
  name: string;
  sign: string;
  house: number;
  degree: number;
}

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
  natal: {
    planets: NatalPlanet[];
    ascendant: string;
    midheaven: string;
    nodes: { north: string; south: string };
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

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ChatResponse {
  reply: string;
  transits_used: string; // ISO datetime of when transits were fetched
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

export interface TransitsResponse {
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
}

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
