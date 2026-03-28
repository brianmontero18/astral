import type { DesignReport } from "../../frontend/src/types";

export const TEST_USER = { id: "test-user-123", name: "Test User" };

export const HISTORY_MESSAGES = [
  { id: 1, role: "user", content: "Que transitos tengo esta semana?", created_at: "2026-03-28T10:00:00.000Z" },
  { id: 2, role: "assistant", content: "Esta semana el Sol transita por tu Puerta 41...", created_at: "2026-03-28T10:00:01.000Z" },
  { id: 3, role: "user", content: "Como afecta mi centro Sacral?", created_at: "2026-03-28T10:01:00.000Z" },
  { id: 4, role: "assistant", content: "Tu centro Sacral definido recibe energia del transito...", created_at: "2026-03-28T10:01:01.000Z" },
];

export const AGENT_RESPONSE_CHUNKS = [
  "Esta ", "semana ", "los ", "tránsitos ", "activan ", "tu ", "canal ", "34-57...",
];

export const TEST_INTAKE = {
  actividad: "Soy diseñadora freelance",
  objetivos: "Quiero entender mi energía",
  desafios: "Me cuesta decir que no",
};

export const FREE_REPORT: DesignReport = {
  id: "report-123",
  userId: "test-user-123",
  tier: "free",
  profileHash: "abc123",
  sections: [
    { id: "mechanical-chart", title: "Tu Carta Mecánica", icon: "⚙️", tier: "free", staticContent: "Tipo: Generador\nEstrategia: Esperar..." },
    { id: "type", title: "Tu Tipo", icon: "🔋", tier: "free", staticContent: "Los Generadores...", llmContent: "Tu energía sacral..." },
    { id: "authority", title: "Tu Autoridad", icon: "🧭", tier: "free", staticContent: "La autoridad emocional...", llmContent: "Tus decisiones..." },
    { id: "profile", title: "Tu Perfil", icon: "🎭", tier: "free", staticContent: "El perfil 6/2...", llmContent: "Tu línea 6...", teaser: true },
    { id: "definition", title: "Tu Definición", icon: "🔗", tier: "premium", staticContent: "" },
    { id: "channels", title: "Tus Canales", icon: "⚡", tier: "premium", staticContent: "" },
    { id: "undefined-centers", title: "Centros Indefinidos", icon: "🌀", tier: "premium", staticContent: "" },
    { id: "incarnation-cross", title: "Cruz de Encarnación", icon: "✨", tier: "premium", staticContent: "" },
    { id: "variables", title: "Variables", icon: "🔬", tier: "premium", staticContent: "" },
    { id: "strengths-shadows", title: "Fortalezas y Sombras", icon: "☯️", tier: "premium", staticContent: "" },
  ],
  tokensUsed: 1200,
  costUsd: 0.001,
  createdAt: "2026-03-28T12:00:00.000Z",
};

export const REGENERATED_REPORT: DesignReport = {
  ...FREE_REPORT,
  id: "report-456",
  createdAt: "2026-03-28T14:00:00.000Z",
  sections: FREE_REPORT.sections.map((s) =>
    s.id === "type" ? { ...s, llmContent: "Tu energía sacral renovada..." } : s,
  ),
};

export const HD_PROFILE = {
  name: "Test User",
  humanDesign: {
    type: "Generador",
    strategy: "Esperar para responder",
    authority: "Emocional",
    profile: "6/2",
    definition: "Simple",
    incarnationCross: "Cruz del Ángulo Derecho del Edén",
    notSelfTheme: "Frustración",
    variable: "",
    digestion: "Paz y Quietud",
    environment: "Costas",
    strongestSense: "Sentir",
    channels: [{ id: "20-34", name: "Canal de Carisma", circuit: "Integración" }],
    activatedGates: [],
    definedCenters: ["Sacral", "Throat"],
    undefinedCenters: ["Head", "Ajna", "G", "Heart", "Spleen", "SolarPlexus", "Root"],
  },
};

export const TEST_USER_WITH_INTAKE = {
  id: "test-user-123",
  name: "Test User",
  profile: HD_PROFILE,
  intake: TEST_INTAKE,
};

export const TEST_USER_NO_INTAKE = {
  id: "test-user-123",
  name: "Test User",
  profile: HD_PROFILE,
  intake: null,
};
