/**
 * Prompt Eval Tests
 *
 * Tests the eval functions themselves with known good/bad outputs.
 * No API calls — pure unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  evalLegacyWeeklyReportSections,
  evalLegacyWeeklyReportNoPreText,
  evalLegacyWeeklyReportMinSentencesPerSection,
  evalLegacyWeeklyReportNoMarkdown,
  evalSpanish,
  evalMentionsGates,
  evalNoHallucinatedGates,
  evalMentionsCanonicalChannel,
  evalRejectsInvalidChannelPair,
  evalMentionsCenters,
  evalUsesBusinessContext,
  evalHdCitationChangesAdvice,
  evalNoGenericAdvisorLanguage,
  evalEmotionalAltitude,
  evalAntiSycophancy,
  evalNoDefaultReportScaffold,
  runEvals,
} from "./prompt-eval.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const GOOD_REPORT = `🔭 PANORAMA GENERAL
Esta semana la Puerta 22 en tránsito abre un portal de receptividad emocional que conecta directamente con tu Plexo Solar definido. Tu canal de Inspiración (1-8) recibe un refuerzo significativo. Es un momento donde la apertura emocional se convierte en tu herramienta más poderosa para conectar con tu audiencia.

⚡ ENERGÍA & CUERPO
Tu Sacral definido está recibiendo la energía de Marte en la Puerta 34, lo que amplifica tu capacidad de trabajo sostenido. La Puerta 55 reforzada por Venus te pide que no ignores las señales del cuerpo. Sentís una pulsión creativa fuerte, pero tu autoridad emocional te pide que esperes la claridad antes de actuar.

💼 TRABAJO & CREATIVIDAD
Con el Sol transitando la Puerta 41, hay un impulso de iniciar algo nuevo. Pero ojo: tu perfil 6/2 necesita que ese inicio venga de una invitación, no de una urgencia mental. El canal del Reconocimiento (30-41) se activa esta semana, lo que significa que tus ideas tienen más visibilidad de lo habitual.

❤️ VÍNCULOS & AMOR
La Luna pasa por la Puerta 37 esta semana, activando tu canal de la Comunidad (37-40). Esto intensifica la necesidad de pertenencia y el deseo de nutrir tus vínculos más cercanos. Tu Plexo Solar definido te pide que no tomes decisiones emocionales impulsivas sobre relaciones.

📣 COMUNICACIÓN & MARCA
Esta semana es momento de nutrir, no de vender. La Puerta 12 en tránsito favorece la expresión selectiva y refinada. Publicá contenido que revele una verdad personal, algo que normalmente no compartirías. El tono ideal es intimista y vulnerable, no didáctico.

🧭 ESTRATEGIA DE LA SEMANA
Esperá invitaciones antes de comprometer tu energía en proyectos nuevos. Tu estrategia de Responder es especialmente crítica esta semana con la Puerta 2 reforzada. Usá los picos de energía sacral para avanzar en lo que ya está en marcha, no para arrancar de cero.

⚠️ PUNTOS DE ATENCIÓN
Tu Ajna indefinida está siendo condicionada por Mercurio esta semana, lo que puede generar presión mental por tener certezas. No te apures a definir una posición o lanzar algo para calmar esa ansiedad. Tu Bazo indefinido también recibe tránsitos: cuidado con retener relaciones o situaciones que ya no te sirven por miedo.`;

const BAD_REPORT_MISSING_SECTION = `🔭 PANORAMA GENERAL
Esta semana hay energía interesante.

⚡ ENERGÍA & CUERPO
Tu cuerpo necesita descanso.

💼 TRABAJO & CREATIVIDAD
Buen momento para proyectos.

❤️ VÍNCULOS & AMOR
Cuidá tus relaciones.

🧭 ESTRATEGIA DE LA SEMANA
Seguí tu estrategia.

⚠️ PUNTOS DE ATENCIÓN
Cuidado con las decisiones impulsivas.`;

const BAD_REPORT_MARKDOWN = `🔭 PANORAMA GENERAL
**Esta semana** la Puerta 22 abre un portal. Tu canal de \`Inspiración\` recibe un refuerzo. Es un momento donde la apertura emocional se convierte en herramienta.

⚡ ENERGÍA & CUERPO
## Energía sacral
- Tu Sacral definido recibe la energía de Marte.
- La Puerta 55 reforzada por Venus.
- Sentís una pulsión creativa fuerte.`;

const BAD_REPORT_PRE_TEXT = `Aquí te presento tu reporte semanal personalizado basado en tus tránsitos:

🔭 PANORAMA GENERAL
Esta semana la Puerta 22 abre receptividad.`;

const ENGLISH_OUTPUT = `This week Gate 22 opens a portal of emotional receptivity. Your Sacral center is receiving Mars energy. You should focus on nurturing your audience rather than selling.`;

const CONTEXT_GATES = [1, 8, 2, 14, 10, 20, 34, 30, 41, 37, 40, 55, 22, 12];
const DEFINED_CENTERS = ["G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart"];
const UNDEFINED_CENTERS = ["Head", "Ajna", "Spleen"];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("evalLegacyWeeklyReportSections", () => {
  it("passes with all 7 sections in order", () => {
    const result = evalLegacyWeeklyReportSections(GOOD_REPORT);
    expect(result.pass).toBe(true);
  });

  it("fails when a section is missing", () => {
    const result = evalLegacyWeeklyReportSections(BAD_REPORT_MISSING_SECTION);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("📣 COMUNICACIÓN & MARCA");
  });

  it("fails when sections are out of order", () => {
    const swapped = GOOD_REPORT
      .replace("⚡ ENERGÍA & CUERPO", "PLACEHOLDER")
      .replace("💼 TRABAJO & CREATIVIDAD", "⚡ ENERGÍA & CUERPO")
      .replace("PLACEHOLDER", "💼 TRABAJO & CREATIVIDAD");
    const result = evalLegacyWeeklyReportSections(swapped);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("orden");
  });
});

describe("evalLegacyWeeklyReportNoPreText", () => {
  it("passes when report starts with 🔭", () => {
    expect(evalLegacyWeeklyReportNoPreText(GOOD_REPORT).pass).toBe(true);
  });

  it("passes with leading whitespace before 🔭", () => {
    expect(evalLegacyWeeklyReportNoPreText("  \n🔭 PANORAMA GENERAL\nTexto.").pass).toBe(true);
  });

  it("fails when there is text before the first emoji", () => {
    const result = evalLegacyWeeklyReportNoPreText(BAD_REPORT_PRE_TEXT);
    expect(result.pass).toBe(false);
  });
});

describe("evalLegacyWeeklyReportMinSentencesPerSection", () => {
  it("passes when each section has >= 3 sentences", () => {
    expect(evalLegacyWeeklyReportMinSentencesPerSection(GOOD_REPORT).pass).toBe(true);
  });

  it("fails when sections are too short", () => {
    const result = evalLegacyWeeklyReportMinSentencesPerSection(BAD_REPORT_MISSING_SECTION);
    expect(result.pass).toBe(false);
  });
});

describe("evalLegacyWeeklyReportNoMarkdown", () => {
  it("passes on clean text", () => {
    expect(evalLegacyWeeklyReportNoMarkdown(GOOD_REPORT).pass).toBe(true);
  });

  it("detects bold, headers, inline code, and bullets", () => {
    const result = evalLegacyWeeklyReportNoMarkdown(BAD_REPORT_MARKDOWN);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("bold");
    expect(result.reason).toContain("headers");
    expect(result.reason).toContain("inline code");
    expect(result.reason).toContain("list bullets");
  });
});

describe("evalSpanish", () => {
  it("passes on Spanish output", () => {
    expect(evalSpanish(GOOD_REPORT).pass).toBe(true);
  });

  it("fails on English output", () => {
    expect(evalSpanish(ENGLISH_OUTPUT).pass).toBe(false);
  });
});

describe("evalMentionsGates", () => {
  it("passes when output mentions gates from context", () => {
    const result = evalMentionsGates(GOOD_REPORT, CONTEXT_GATES);
    expect(result.pass).toBe(true);
  });

  it("fails when no gates are mentioned", () => {
    const result = evalMentionsGates("Esta semana la energía es interesante.", CONTEXT_GATES);
    expect(result.pass).toBe(false);
  });
});

describe("evalNoHallucinatedGates", () => {
  it("passes when all mentioned gates are in context", () => {
    const result = evalNoHallucinatedGates(GOOD_REPORT, CONTEXT_GATES);
    expect(result.pass).toBe(true);
  });

  it("fails when output mentions a gate not in context", () => {
    const output = "La Puerta 64 se activa hoy y la Puerta 22 te acompaña.";
    const result = evalNoHallucinatedGates(output, [22, 41]);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("64");
  });
});

describe("evalMentionsCanonicalChannel", () => {
  it("accepts gate lists without repeated Puerta labels or literal channel id", () => {
    const result = evalMentionsCanonicalChannel(
      "La Puerta 8 forma el Canal de Inspiración. Puertas: 1 y 8. Circuito: Individual.",
      { id: "1-8", gates: [1, 8], name: "Canal de Inspiración" },
    );

    expect(result.pass).toBe(true);
  });

  it("accepts markdown emphasis around gate numbers", () => {
    const result = evalMentionsCanonicalChannel(
      "El Canal 5-15 es el Canal del Ritmo. Está compuesto por las puertas **5** y **15**.",
      { id: "5-15", gates: [5, 15], name: "Canal del Ritmo" },
    );

    expect(result.pass).toBe(true);
  });
});

describe("evalRejectsInvalidChannelPair", () => {
  it("accepts canonical-table rejection wording", () => {
    const result = evalRejectsInvalidChannelPair(
      "El canal 12-20 no está definido en la tabla canónica de Diseño Humano.",
      "12-20",
    );

    expect(result.pass).toBe(true);
  });

  it("accepts 'no se encuentra' rejection wording", () => {
    const result = evalRejectsInvalidChannelPair(
      "El canal 12-20 no se encuentra en la tabla canónica de Diseño Humano. Esto puede ser porque no forma un canal reconocido.",
      "12-20",
    );

    expect(result.pass).toBe(true);
  });

  it("does not treat separate gate existence as affirming the pair", () => {
    const result = evalRejectsInvalidChannelPair(
      "El id 1-2 no existe como canal canónico. La Puerta 1 existe, y la Puerta 2 existe, pero no forman un canal entre sí.",
      "1-2",
    );

    expect(result.pass).toBe(true);
  });

  it("accepts explaining each gate after rejecting the pair", () => {
    const result = evalRejectsInvalidChannelPair(
      "No existe un canal 1-2 en la tabla canónica de Diseño Humano. Si te referías a una de las puertas, la Puerta 1 es creatividad y la Puerta 2 es dirección, pero juntas no forman un canal.",
      "1-2",
    );

    expect(result.pass).toBe(true);
  });

  it("accepts gate-center detail after rejecting the pair", () => {
    const result = evalRejectsInvalidChannelPair(
      "No existe un canal canónico 12-20 en la tabla de Diseño Humano. La Puerta 12 pertenece al Throat y la Puerta 20 también está en el Throat, pero no forman un canal entre sí.",
      "12-20",
    );

    expect(result.pass).toBe(true);
  });
});

describe("evalMentionsCenters", () => {
  it("passes when output mentions centers from context", () => {
    const result = evalMentionsCenters(GOOD_REPORT, DEFINED_CENTERS, UNDEFINED_CENTERS);
    expect(result.pass).toBe(true);
  });

  it("fails when no centers are mentioned", () => {
    const result = evalMentionsCenters(
      "Esta semana aprovechá la energía disponible.",
      DEFINED_CENTERS,
      UNDEFINED_CENTERS,
    );
    expect(result.pass).toBe(false);
  });
});

describe("runEvals", () => {
  it("aggregates pass/fail counts correctly", () => {
    const result = runEvals([
      { name: "always-pass", fn: () => ({ pass: true, reason: "ok" }) },
      { name: "always-fail", fn: () => ({ pass: false, reason: "nope" }) },
      { name: "also-pass", fn: () => ({ pass: true, reason: "ok" }) },
    ]);
    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results).toHaveLength(3);
  });
});

// ─── Advisor Quality Evals (chat) ──────────────────────────────────────────────

describe("evalUsesBusinessContext", () => {
  const intake = {
    actividad: "mentora de negocios",
    objetivo_12m: "llegar a 100k de facturación",
    tipo_de_negocio: "marca_personal" as const,
  };
  const memory = "Su programa estrella es Punto de Quiebre. También dicta el mastermind Líder Cuántica.";

  it("passes when output references a concrete business token", () => {
    const output = "Para tu mastermind Líder Cuántica, esta etapa pide foco en la oferta.";
    expect(evalUsesBusinessContext(output, intake, memory).pass).toBe(true);
  });

  it("passes (vacuously) when there is no intake nor memory", () => {
    expect(evalUsesBusinessContext("Cualquier respuesta.", undefined, undefined).pass).toBe(true);
  });

  it("fails when output ignores all available business context", () => {
    const output = "Esta semana conviene descansar y conectar con tu energía interior.";
    expect(evalUsesBusinessContext(output, intake, memory).pass).toBe(false);
  });
});

describe("evalHdCitationChangesAdvice", () => {
  it("passes when there is no HD citation at all", () => {
    expect(evalHdCitationChangesAdvice("Hoy bajá el ritmo y atendé tu cuerpo.").pass).toBe(true);
  });

  it("passes when the citation is tied to a causal connector", () => {
    const output = "El Sol activa tu Puerta 8, por eso te conviene grabar el mensaje central esta semana.";
    expect(evalHdCitationChangesAdvice(output).pass).toBe(true);
  });

  it("fails when the HD citation is decorative", () => {
    const output = "Tenés Sol en Puerta 8 y Luna en Puerta 12. Contá historias y conectá con tu audiencia.";
    expect(evalHdCitationChangesAdvice(output).pass).toBe(false);
  });
});

describe("evalNoGenericAdvisorLanguage", () => {
  it("passes on specific, situated language", () => {
    const output = "Frená el relanzamiento: primero definí qué versión nueva del programa existe.";
    expect(evalNoGenericAdvisorLanguage(output).pass).toBe(true);
  });

  it("fails when the opener is a wildcard phrase", () => {
    const output = "Esta semana es propicia para crecer. Definí tu próxima acción.";
    expect(evalNoGenericAdvisorLanguage(output).pass).toBe(false);
  });

  it("fails when several generic phrases stack up", () => {
    const output = "Es momento de contar historias, usar testimonios y conectar con tu esencia.";
    expect(evalNoGenericAdvisorLanguage(output).pass).toBe(false);
  });
});

describe("evalEmotionalAltitude", () => {
  const griefInput = "Hoy falleció una persona conocida y además choqué mi auto. ¿Cómo sostengo el día?";

  it("passes when the input is not emotional", () => {
    expect(evalEmotionalAltitude("¿Cómo está la semana para vender?", "🔭 PANORAMA\nTexto.").pass).toBe(true);
  });

  it("passes when an emotional input gets sober containment first", () => {
    const output = "Lamento mucho lo que estás viviendo. Hoy no es un día para exigirte claridad; cuidá tu cuerpo.";
    expect(evalEmotionalAltitude(griefInput, output).pass).toBe(true);
  });

  it("fails when an emotional input is answered with a report scaffold", () => {
    const output =
      "🔭 PANORAMA GENERAL\nHoy hay movimiento emocional.\n\n⚡ ENERGÍA & CUERPO\nComo Generador, permitite sentir.\n\n🧭 ESTRATEGIA DEL DÍA\nDescansá.";
    expect(evalEmotionalAltitude(griefInput, output).pass).toBe(false);
  });
});

describe("evalAntiSycophancy", () => {
  const planInput = "Quiero relanzar mi programa esta semana y empezar a vender ya.";

  it("passes when the user proposes no plan", () => {
    expect(evalAntiSycophancy("¿Cómo me siento hoy?", "Estás en una etapa de apertura.").pass).toBe(true);
  });

  it("passes when the response puts tension on the plan", () => {
    const output = "No relances si solo buscás movimiento. Antes de vender, definí qué cambió del programa.";
    expect(evalAntiSycophancy(planInput, output).pass).toBe(true);
  });

  it("fails when the response only validates the plan", () => {
    const output = "Es una gran oportunidad. Relanzá con confianza, la energía te acompaña.";
    expect(evalAntiSycophancy(planInput, output).pass).toBe(false);
  });
});

describe("evalNoDefaultReportScaffold", () => {
  it("passes when the user explicitly asked for a report", () => {
    const output = "🔭 PANORAMA GENERAL\nTexto.\n⚡ ENERGÍA\nTexto.\n🧭 ESTRATEGIA\nTexto.";
    expect(evalNoDefaultReportScaffold("Hacé mi reporte semanal", output).pass).toBe(true);
  });

  it("passes when a conversational question gets a conversational answer", () => {
    expect(evalNoDefaultReportScaffold("¿Relanzo ahora?", "Todavía no: primero definí la oferta.").pass).toBe(true);
  });

  it("fails when a conversational question gets the fixed report scaffold", () => {
    const output = "🔭 PANORAMA GENERAL\nTexto.\n\n⚡ ENERGÍA & CUERPO\nTexto.\n\n🧭 ESTRATEGIA DE LA SEMANA\nTexto.";
    expect(evalNoDefaultReportScaffold("¿Cómo sostengo el día de hoy?", output).pass).toBe(false);
  });
});

// ─── Regression: real sanitized cases from docs/ai-refactor/06-advisor-quality-audit.md

describe("advisor quality regression (doc 06)", () => {
  // Caso P1 — Pilar: comunicación / relanzamiento / ventas
  const P1_INPUT = "¿Cómo está esta semana para relanzar mi programa y para vender?";
  const P1_GENERIC =
    "Esta semana es favorable para la comunicación. El Sol en Puerta 8 y la Luna en Puerta 12 te " +
    "invitan a contar historias y usar testimonios. Es un momento propicio para conectar con tu " +
    "audiencia. Esta semana es propicia para el crecimiento y la venta significativa.";
  const P1_INTAKE = {
    actividad: "mentora",
    objetivo_12m: "llegar a 100k",
    tipo_de_negocio: "marca_personal" as const,
  };
  const P1_MEMORY = "Su programa insignia es Punto de Quiebre.";

  it("P1 generic response fails anti-sycophancy and generic-language", () => {
    expect(evalAntiSycophancy(P1_INPUT, P1_GENERIC).pass).toBe(false);
    expect(evalNoGenericAdvisorLanguage(P1_GENERIC).pass).toBe(false);
  });

  it("P1 generic response fails HD-citation and business-context", () => {
    expect(evalHdCitationChangesAdvice(P1_GENERIC).pass).toBe(false);
    expect(evalUsesBusinessContext(P1_GENERIC, P1_INTAKE, P1_MEMORY).pass).toBe(false);
  });

  it("P1 improved response passes the same checks", () => {
    const improved =
      "Antes de relanzar, frená: no relances si solo buscás movimiento. Tu programa Punto de Quiebre " +
      "ya tiene audiencia, así que esta semana conviene preparar el relanzamiento, no ejecutarlo. El " +
      "Sol en Puerta 8 refuerza tu voz pública, por eso te conviene grabar el mensaje central ahora.";
    expect(evalAntiSycophancy(P1_INPUT, improved).pass).toBe(true);
    expect(evalNoGenericAdvisorLanguage(improved).pass).toBe(true);
    expect(evalHdCitationChangesAdvice(improved).pass).toBe(true);
    expect(evalUsesBusinessContext(improved, P1_INTAKE, P1_MEMORY).pass).toBe(true);
  });

  // Caso P2 — Pilar: duelo + accidente
  const P2_INPUT =
    "Hoy falleció una persona conocida de mi edad y además choqué mi auto. Dime cómo sostener este día.";
  const P2_REPORT =
    "🔭 PANORAMA GENERAL\nHoy es un día de movimiento emocional.\n\n⚡ ENERGÍA & CUERPO\nComo Generador, " +
    "permitite sentir.\n\n🧭 ESTRATEGIA DEL DÍA\nDescansá y escribí lo que sentís.\n\n⚠️ PUNTOS DE ATENCIÓN\n" +
    "No tomes decisiones importantes hoy.";

  it("P2 grief answered as a report fails altitude and default-scaffold", () => {
    expect(evalEmotionalAltitude(P2_INPUT, P2_REPORT).pass).toBe(false);
    expect(evalNoDefaultReportScaffold(P2_INPUT, P2_REPORT).pass).toBe(false);
  });

  it("P2 grief answered with sober containment passes", () => {
    const containment =
      "Lamento mucho lo que estás viviendo. Hoy no es un día para exigirte claridad. Tuviste dos golpes " +
      "fuertes en pocas horas. Por ahora lo único importante es tu cuerpo: tomá agua y no manejes si " +
      "seguís en shock.";
    expect(evalEmotionalAltitude(P2_INPUT, containment).pass).toBe(true);
    expect(evalNoDefaultReportScaffold(P2_INPUT, containment).pass).toBe(true);
  });
});
