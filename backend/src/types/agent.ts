import type { VariableLabels } from "../hd-variable-labels.js";
import type { ContextBudgetSnapshot } from "./context-budget.js";

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
}

export interface AgentCallMeta {
  usage: LlmUsage;
  latencyMs: number;
  systemPrompt: string;
  contextBudget?: ContextBudgetSnapshot;
  toolCalls?: string[];
  toolsUsed?: string[];
}

export interface AgentResult extends AgentCallMeta {
  content: string;
}

export interface HdVariable {
  orientation: "left" | "right";
  color: number;
  tone: number;
  base: number;
}

export interface UserProfile {
  name: string;
  birthData?: {
    dateLocalIso: string;
    dateUtcIso: string;
    placeLabel: string;
    coordinates?: { lat: number; lon: number };
    timezoneOffsetHours: number;
    ageYears: number;
  };
  humanDesign: {
    type: string;
    typeQualifier?: string;
    strategy: string;
    authority: string;
    profile: string;
    profileName?: string;
    definition: string;
    incarnationCross: string;
    themes?: { positive: string; notSelf: string };
    notSelfTheme: string;
    variable: string;
    digestion: string;
    environment: string;
    strongestSense: string;
    design?: {
      date: string;
    };
    variables?: {
      digestion: HdVariable;
      awareness: HdVariable;
      environment: HdVariable;
      perspective: HdVariable;
    };
    variableLabels?: VariableLabels;
    channels: Array<{ id: string; name: string; nameEn?: string; circuit: string }>;
    activatedGates: Array<{
      number: number;
      line: number;
      color?: number;
      tone?: number;
      base?: number;
      planet: string;
      isPersonality: boolean;
      isRetrograde?: boolean;
      fixingState?: "exalted" | "detriment" | null;
    }>;
    definedCenters: string[];
    undefinedCenters: string[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AgentStreamCompleteHandler = (meta: AgentCallMeta) => void;
