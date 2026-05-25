import type { ChatMessage } from "../types/agent.js";
import type {
  ModelRoutingComplexity,
  ModelRoutingDecision,
  ModelRoutingRoute,
  ModelRoutingSignal,
} from "../types/context-budget.js";

interface SelectChatModelInput {
  route: Extract<ModelRoutingRoute, "chat" | "chat_stream" | "mcp_ask">;
  messages: readonly ChatMessage[];
  defaultModel: string;
  simpleModel: string;
  complexModel: string;
}

interface SelectReportModelInput {
  tier: "free" | "premium";
  defaultModel: string;
  premiumModel: string;
}

interface SelectMemoryWriterModelInput {
  defaultModel: string;
  configuredModel: string;
}

const LONG_MESSAGE_CHARS = 1_200;

const HUMAN_DESIGN_TERMS = [
  "autoridad",
  "canal",
  "centro",
  "carta",
  "diseño",
  "gate",
  "human design",
  "perfil",
  "puerta",
  "tipo",
];

const TRANSIT_TERMS = [
  "activación",
  "activaciones",
  "colectivo",
  "planeta",
  "tránsito",
  "tránsitos",
  "transito",
  "transitos",
];

const BUSINESS_TERMS = [
  "cliente",
  "clientes",
  "marca",
  "negocio",
  "oferta",
  "posicionamiento",
  "trabajo",
  "venta",
  "ventas",
];

const RELATIONSHIP_TERMS = [
  "compará",
  "comparar",
  "comparame",
  "relación",
  "relaciones",
  "relacion",
  "vínculo",
  "vínculos",
  "vinculo",
  "vinculos",
];

const MULTI_STEP_TERMS = [
  "analizá",
  "analiza",
  "diagnóstico",
  "pasos",
  "plan",
  "próximos pasos",
  "riesgos",
  "estrategia",
];

function latestUserText(messages: readonly ChatMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .at(-1)?.content ?? "";
}

function includesAny(text: string, terms: readonly string[]): boolean {
  const normalized = text.toLocaleLowerCase("es");
  return terms.some((term) => normalized.includes(term));
}

function hasCrossDomain(text: string): boolean {
  const domains = [
    includesAny(text, HUMAN_DESIGN_TERMS),
    includesAny(text, TRANSIT_TERMS),
    includesAny(text, BUSINESS_TERMS),
  ];
  return domains.filter(Boolean).length >= 2;
}

function classifyChatComplexity(messages: readonly ChatMessage[]): {
  complexity: ModelRoutingComplexity;
  signals: ModelRoutingSignal[];
} {
  const text = latestUserText(messages);
  const signals: ModelRoutingSignal[] = [];

  if (text.length >= LONG_MESSAGE_CHARS) {
    signals.push("long_message");
  }
  if (includesAny(text, MULTI_STEP_TERMS)) {
    signals.push("multi_step");
  }
  if (hasCrossDomain(text)) {
    signals.push("cross_domain");
  }
  if (includesAny(text, RELATIONSHIP_TERMS)) {
    signals.push("relationship_analysis");
  }

  return {
    complexity: signals.includes("long_message") || signals.length >= 2
      ? "complex"
      : "simple",
    signals,
  };
}

export function selectChatModel(input: SelectChatModelInput): ModelRoutingDecision {
  const { complexity, signals } = classifyChatComplexity(input.messages);

  if (complexity === "simple") {
    return {
      route: input.route,
      model: input.simpleModel,
      reason: input.simpleModel === input.defaultModel
        ? "chat_simple_default"
        : "chat_simple_opt_in",
      complexity,
      signals,
    };
  }

  return {
    route: input.route,
    model: input.complexModel,
    reason: input.complexModel === input.defaultModel
      ? "chat_complex_no_upgrade_configured"
      : "chat_complex_opt_in",
    complexity,
    signals,
  };
}

export function selectReportModel(input: SelectReportModelInput): ModelRoutingDecision {
  if (input.tier === "premium" && input.premiumModel !== input.defaultModel) {
    return {
      route: "report",
      model: input.premiumModel,
      reason: "report_premium_opt_in",
      signals: [],
    };
  }

  return {
    route: "report",
    model: input.defaultModel,
    reason: "report_default",
    signals: [],
  };
}

export function selectMemoryWriterModel(
  input: SelectMemoryWriterModelInput,
): ModelRoutingDecision {
  return {
    route: "memory_writer",
    model: input.configuredModel,
    reason: input.configuredModel === input.defaultModel
      ? "memory_writer_default"
      : "memory_writer_configured",
    signals: [],
  };
}
