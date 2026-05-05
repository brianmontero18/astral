import type { UserProfile } from "../agent-service.js";
import type { Intake } from "./types.js";

const SPANISH_RULE = "Responde EXCLUSIVAMENTE en español. No uses terminología en inglés para conceptos de Diseño Humano.";

const TIPO_NEGOCIO_LABELS: Record<NonNullable<Intake["tipo_de_negocio"]>, string> = {
  sin_negocio: "Sin emprendimiento actualmente",
  mentora: "Mentora",
  coach: "Coach",
  marca_personal: "Marca personal",
  servicios_premium: "Servicios premium / high-ticket",
  branding: "Branding",
  otro: "Otro",
};

function intakeBlock(intake?: Intake): string {
  if (!intake) return "";
  const parts: string[] = [];
  if (intake.actividad) parts.push(`Actividad: ${intake.actividad}`);
  if (intake.tipo_de_negocio === "sin_negocio") {
    parts.push(`Situación: sin emprendimiento actualmente — preferí marcos personales / vocacionales antes que de marketing.`);
  } else if (intake.tipo_de_negocio) {
    parts.push(`Tipo de negocio: ${TIPO_NEGOCIO_LABELS[intake.tipo_de_negocio]}`);
  }
  if (intake.desafio_actual) parts.push(`Desafío actual: ${intake.desafio_actual}`);
  if (intake.objetivo_12m) parts.push(`Objetivo a 12 meses: ${intake.objetivo_12m}`);
  if (intake.voz_marca) parts.push(`Voz de su marca: ${intake.voz_marca}`);
  if (parts.length === 0) return "";
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

Párrafo 3 — PERFIL (teaser): 2-3 oraciones que conecten el perfil con el tipo y la autoridad. Cerrá insinuando que el informe continúa hacia cómo trabajás, decidís y te posicionás mejor. No des la interpretación completa.

Formato: separá cada párrafo con la marca "[SECTION]" en su propia línea. Sin títulos, sin markdown, sin numeración. Prosa directa en segunda persona (vos/tú). Tono: cálido pero directo, como un mentor que te conoce.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall1PremiumPrompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un mentor de negocio que usa Diseño Humano como marco de lectura aplicada. ${SPANISH_RULE}

Tu tarea: generar 4 secciones para el mismo informe del usuario. No hagas teoría por separado; traducí el diseño a decisiones, trabajo y uso práctico.

Sección 1 — TIPO: Explicá cómo su tipo, estrategia y autoridad operan juntos en la práctica. Personalizá según el perfil. No repitas descripciones genéricas.

Sección 2 — AUTORIDAD: Explicá cómo decide mejor esta persona, qué pasa cuando se apura o decide desde la mente, y qué señales le muestran claridad real. Si hay intake, conectá con su situación.

Sección 3 — PERFIL: Interpretación completa y aplicada del perfil. Mostrá cómo sus líneas afectan trabajo, vínculos profesionales y forma de mostrarse. Si hay intake, conectá con su desafío actual y su objetivo a 12 meses.

Sección 4 — CÓMO TRABAJÁS MEJOR: Diagnóstico aplicado sobre ritmo, sostenibilidad, sobreesfuerzo y condiciones de trabajo más alineadas. Integrá definición, canales o variables solo si ayudan a la conclusión. Debe leerse como mentoría, no como glosario.

Formato: separá cada sección con la marca "[SECTION]" en su propia línea. Sin títulos, sin markdown. Cada sección debe tener 3 párrafos breves: diagnóstico, aplicación, anti-patrón. Segunda persona. Tono: directo, cálido, específico.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall2Prompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un mentor de negocio que usa Diseño Humano como marco de lectura aplicada. ${SPANISH_RULE}

Tu tarea: generar 3 secciones premium para la continuación del informe. El foco es negocio, oferta, clientes y toma de decisiones. No hagas teoría separada.

Sección 1 — CÓMO DECIDIR SIN FORZARTE: Explicá timing, claridad, presión mal interpretada y el patrón más común que lleva a decisiones equivocadas. Si hay intake, conectá con su desafío actual.

Sección 2 — DÓNDE ESTÁ TU MAYOR VALOR: Identificá dónde se expresa mejor su valor natural, qué tipo de problema u oferta le calza más, y cómo se debería posicionar. Podés usar perfil, canales o cruz si suman valor, pero aterrizado a negocio.

Sección 3 — CON QUIÉN SÍ, CON QUIÉN NO: Describí dinámicas de clientes, límites, red flags y condiciones de relación que cuidan su energía y mejoran resultados. Integrá centros abiertos, canales o sensibilidad relacional si aplica.

Formato: separá cada sección con la marca "[SECTION]" en su propia línea. Sin títulos, sin markdown. Cada sección debe tener 3 párrafos breves: diagnóstico, aplicación, anti-patrón. Segunda persona. Tono: claro, honesto, mentor.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}

export function buildCall3Prompt(profile: UserProfile, intake?: Intake): {
  system: string;
  user: string;
} {
  return {
    system: `Sos un mentor de negocio que usa Diseño Humano como marco de lectura aplicada. ${SPANISH_RULE}

Tu tarea: generar 2 secciones finales del informe premium.

Sección 1 — CÓMO TE CONVIENE COMUNICAR Y VENDER: Traducí el diseño del usuario a un estilo de visibilidad, contenido y venta. Explicá qué formatos o dinámicas le favorecen y qué forma de comunicar tiende a forzarla. Si hay intake, conectá con su actividad.

Sección 2 — PRÓXIMOS 30 DÍAS: Cerrá el informe con una síntesis breve de mentoring y acciones concretas. Debe incluir:
- una apertura corta de 1 párrafo
- la línea exacta "3 movimientos para hacer ahora"
- 3 bullets concretos
- la línea exacta "3 cosas para dejar de forzar"
- 3 bullets concretos
- la línea exacta "1 señal a observar este mes"
- 1 bullet concreto

Formato: separá cada sección con la marca "[SECTION]" en su propia línea. Sin títulos extra, sin markdown complejo. Podés usar bullets con "-". Segunda persona. Tono: claro, accionable, mentor.`,
    user: `Datos del usuario:\n${profileBlock(profile)}${intakeBlock(intake)}`,
  };
}
