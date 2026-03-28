import type { UserProfile } from "../agent-service.js";
import type { Intake } from "./types.js";

const SPANISH_RULE = "Responde EXCLUSIVAMENTE en español. No uses terminología en inglés para conceptos de Diseño Humano.";

function intakeBlock(intake?: Intake): string {
  if (!intake?.actividad && !intake?.objetivos && !intake?.desafios) return "";
  const parts: string[] = [];
  if (intake.actividad) parts.push(`Actividad: ${intake.actividad}`);
  if (intake.objetivos) parts.push(`Objetivos: ${intake.objetivos}`);
  if (intake.desafios) parts.push(`Desafíos: ${intake.desafios}`);
  return `\n\nContexto personal del usuario:\n${parts.join("\n")}`;
}

function profileBlock(profile: UserProfile): string {
  const hd = profile.humanDesign;
  const lines: string[] = [
    `Tipo: ${hd.type}`,
    `Autoridad: ${hd.authority}`,
    `Perfil: ${hd.profile}`,
    `Definición: ${hd.definition}`,
    `Estrategia: ${hd.strategy}`,
  ];
  if (hd.incarnationCross) lines.push(`Cruz de Encarnación: ${hd.incarnationCross}`);
  if (hd.notSelfTheme) lines.push(`Tema del no-ser: ${hd.notSelfTheme}`);
  if (hd.channels.length) {
    lines.push(`Canales: ${hd.channels.map(c => `${c.name} (${c.id})`).join(", ")}`);
  }
  if (hd.definedCenters.length) lines.push(`Centros definidos: ${hd.definedCenters.join(", ")}`);
  if (hd.undefinedCenters.length) lines.push(`Centros indefinidos: ${hd.undefinedCenters.join(", ")}`);
  if (hd.digestion) lines.push(`Digestión: ${hd.digestion}`);
  if (hd.environment) lines.push(`Ambiente: ${hd.environment}`);
  if (hd.strongestSense) lines.push(`Sentido más fuerte: ${hd.strongestSense}`);
  return lines.join("\n");
}

export function buildCall1FreePrompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un experto en Diseño Humano. ${SPANISH_RULE}

Tu tarea: generar 3 párrafos personalizados para un informe de Diseño Humano.

Párrafo 1 — TIPO: Conectá el tipo del usuario con su estrategia. Explicá cómo su tipo específico interactúa con su autoridad. No repitas la descripción genérica del tipo; personalizá basándote en la combinación única de elementos.

Párrafo 2 — AUTORIDAD: Explicá cómo la autoridad funciona en el contexto de este tipo y perfil específicos. Dá un ejemplo práctico de cómo usar la autoridad en decisiones cotidianas.

Párrafo 3 — PERFIL (teaser): 2-3 oraciones que conecten el perfil con el tipo y la autoridad. Dejá al lector queriendo saber más. No des la interpretación completa.

Formato: separá cada párrafo con la marca "[SECTION]" en su propia línea. Sin títulos, sin markdown, sin numeración. Prosa directa en segunda persona (vos/tú). Tono: cálido pero directo, como un mentor que te conoce.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall1PremiumPrompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un experto en Diseño Humano. ${SPANISH_RULE}

Tu tarea: generar 4 párrafos personalizados para un informe premium de Diseño Humano.

Párrafo 1 — TIPO: Conectá el tipo con la estrategia y la autoridad. Personalizá — no repitas descripciones genéricas. Incluí cómo este tipo específico navega el mundo dado su perfil.

Párrafo 2 — AUTORIDAD: Interpretación profunda de cómo funciona la autoridad en el contexto completo de este diseño. Ejemplos prácticos. Si hay intake, conectá con su situación específica.

Párrafo 3 — PERFIL: Interpretación completa del perfil. Cómo las dos líneas interactúan, cómo se manifiesta en su vida cotidiana, qué desafíos y dones trae esta combinación. Si hay intake, conectá con sus desafíos y objetivos.

Párrafo 4 — DEFINICIÓN: Cómo su tipo de definición afecta su procesamiento interno, sus relaciones, y su forma de tomar decisiones. Conectá con el tipo y la autoridad.

Formato: separá cada párrafo con la marca "[SECTION]" en su propia línea. Sin títulos, sin markdown. Prosa directa en segunda persona. Tono: profundo, cálido, mentor.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall2Prompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un experto en Diseño Humano. ${SPANISH_RULE}

Tu tarea: generar 3 secciones personalizadas para un informe premium.

Sección 1 — CANALES: Para cada canal del usuario, explicá cómo interactúan las dos puertas conectadas y qué energía específica crean juntas. Si hay múltiples canales, explicá cómo se relacionan entre sí. Si hay intake, conectá con su actividad y objetivos.

Sección 2 — CENTROS INDEFINIDOS: Para cada centro indefinido, explicá el patrón de condicionamiento específico que genera en combinación con los canales y el tipo del usuario. No repitas la descripción genérica; personalizá.

Sección 3 — VARIABLES: Si el usuario tiene datos de digestión, ambiente o sentido más fuerte, integrá una interpretación práctica de cómo estos elementos afectan su vida cotidiana. Si no hay datos de variables, omití esta sección.

Formato: separá cada sección con la marca "[SECTION]" en su propia línea. Dentro de cada sección, prosa continua. Sin títulos, sin markdown. Segunda persona. Tono mentor.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall3Prompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un experto en Diseño Humano. ${SPANISH_RULE}

Tu tarea: generar 2 secciones personalizadas para la conclusión de un informe premium.

Sección 1 — CRUZ DE ENCARNACIÓN: Interpretá la cruz de encarnación como el propósito vital del usuario. Conectá las 4 puertas de la cruz con su tipo, perfil y canales. Si hay intake, mostrá cómo el propósito se manifiesta (o puede manifestarse) en su actividad actual.

Sección 2 — FORTALEZAS Y SOMBRAS: Sintetizá todo el diseño en un balance de fortalezas (dones del diseño vivido correctamente) y sombras (patrones del no-ser). No hagas una lista; escribí una síntesis narrativa que integre tipo, autoridad, perfil, canales y centros indefinidos. Si hay intake, conectá con sus desafíos específicos.

Formato: separá cada sección con la marca "[SECTION]" en su propia línea. Prosa continua, sin títulos, sin markdown. Segunda persona. Tono: profundo, inspirador pero honesto.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}
