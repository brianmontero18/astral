/**
 * Tests para extraction-service:
 *
 *   1. parseHdSummaryFromText — labels en los 3 formatos reales
 *      (MyHumanDesign EN, Genetic Matrix EN, Genetic Matrix ES).
 *      Regresión de astral-86a (strings vacíos en formato ES).
 *
 *   2. extractProfileFromAssets fallback a Vision cuando el PDF no
 *      tiene capa de texto (capturas, exports vectoriales, paid
 *      Genetic Matrix). Regresión de astral-asy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../hd-pdf/pdf-text.js", () => ({
  extractPdfText: vi.fn(async () => ""),
}));

vi.mock("../db.js", async () => {
  const actual = await vi.importActual<typeof import("../db.js")>("../db.js");
  return {
    ...actual,
    insertLlmCall: vi.fn(async () => undefined),
  };
});

const { extractProfileFromAssets, parseHdSummaryFromText, UserFacingError } =
  await import("../extraction-service.js");
const { extractPdfText } = await import("../hd-pdf/pdf-text.js");
const { insertLlmCall } = await import("../db.js");
const extractPdfTextMock = extractPdfText as unknown as ReturnType<typeof vi.fn>;
const insertLlmCallMock = insertLlmCall as unknown as ReturnType<typeof vi.fn>;

describe("parseHdSummaryFromText", () => {
  describe("MyHumanDesign English format (spaced labels)", () => {
    it("extracts type, profile, definition, authority", () => {
      const text = `
        Name John Doe Design
        TYPE Manifesting Generator
        PROFILE 6/2
        DEFINITION Split Definition
        AUTHORITY (THE WAY YOU MAKE DECISIONS) Emotional - Solar Plexus
        STRATEGY To Respond
        LIFE THEME (INCARNATION CROSS) Right Angle Cross of Industry (1)
      `;
      const result = parseHdSummaryFromText(text);
      expect(result.name).toBe("John Doe");
      expect(result.humanDesign.type).toBe("Manifesting Generator");
      expect(result.humanDesign.profile).toBe("6/2");
      expect(result.humanDesign.definition).toBe("Split Definition");
      expect(result.humanDesign.authority).toMatch(/Emotional|Solar Plexus/);
      expect(result.humanDesign.strategy).toBe("To Respond");
      expect(result.humanDesign.incarnationCross).toMatch(/Industry/);
    });
  });

  describe("Genetic Matrix English format (colon labels)", () => {
    it("extracts type, profile, definition, authority", () => {
      const text = `
        Foundation Chart Quantum
        Name: Brian Montero Birth Date (Local): 18 February 1989
        Type: Emotional Manifesting Generator
        Profile: 6/2 - Role Model / Hermit
        Definition: Split - Small (6)
        Incarnation Cross: LAX Industry 1
        Inner Authority: Solar Plexus
      `;
      const result = parseHdSummaryFromText(text);
      expect(result.name).toBe("Brian Montero");
      expect(result.humanDesign.type).toBe("Emotional Manifesting Generator");
      expect(result.humanDesign.profile).toBe("6/2");
      expect(result.humanDesign.definition).toMatch(/Split/);
      expect(result.humanDesign.authority).toMatch(/Solar Plexus/);
      expect(result.humanDesign.incarnationCross).toMatch(/LAX Industry/);
    });
  });

  describe("Genetic Matrix Spanish format — astral-86a regression", () => {
    // Texto que el sitio de Genetic Matrix devuelve cuando el browser está
    // en español. Reproduce el formato exacto de un caso real (con el
    // nombre y datos personales reemplazados por fixtures neutros).
    const SAMPLE_ES = `
      Carta individual Cuántica Sistema: Tropical
      Nombre: Test User Fecha de Nacimiento (local): 01 Enero 1990, 12:00
      Lugar de Nacimiento: Test City, Country
      Tipo: Manifestador Emocional
      Perfil: 3/5 - Mártir / Hereje
      Definición: Definición Singular
      Encarnación Cruz: RAX Esfinge 3
      Autoridad interna: Plexo Solar
      Canales: 1222 - Apertura 1333 - Pródigo
      www.geneticmatrix.com
    `;

    it("extracts type from Tipo: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.type).toBe("Manifestador Emocional");
    });

    it("extracts profile digits from Perfil: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.profile).toBe("3/5");
    });

    it("extracts definition from Definición: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.definition).toBe("Definición Singular");
    });

    it("extracts authority from Autoridad interna: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.authority).toBe("Plexo Solar");
    });

    it("extracts incarnation cross from Encarnación Cruz: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.incarnationCross).toBe("RAX Esfinge 3");
    });

    it("extracts name from Nombre: label", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.name).toBe("Test User");
    });

    it("does not leave any of the 4 summary strings empty", () => {
      const result = parseHdSummaryFromText(SAMPLE_ES);
      expect(result.humanDesign.type).toBeTruthy();
      expect(result.humanDesign.profile).toBeTruthy();
      expect(result.humanDesign.authority).toBeTruthy();
      expect(result.humanDesign.definition).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("returns empty humanDesign when no labels are found", () => {
      const text = "Random text without any HD labels.";
      const result = parseHdSummaryFromText(text);
      expect(result.humanDesign.type).toBeUndefined();
      expect(result.humanDesign.profile).toBeUndefined();
      expect(result.name).toBeUndefined();
    });

    it("Spanish label search does not falsely match English Tipo within other words", () => {
      // The label regex requires "TIPO: " with colon and space, so words
      // that contain "tipo" as substring (e.g. "estereotipo") should not
      // pollute the type field.
      const text = "Algún estereotipo sobre HD que no debería matchear.";
      const result = parseHdSummaryFromText(text);
      expect(result.humanDesign.type).toBeUndefined();
    });
  });
});

// ─── Vision fallback (astral-asy) ────────────────────────────────────────────

/**
 * Build a 26-gate fixture with valid line numbers and exactly one of each
 * planet on personality and design — the minimum shape that
 * validateActivatedGates accepts.
 */
function buildValidGates() {
  const planets = [
    "Sun",
    "Earth",
    "Moon",
    "North Node",
    "South Node",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
  ];
  // Gate numbers are in [1, 64] and chosen so the personality+design
  // pairing matches at least one HD channel, which lets
  // deriveChannelsAndCenters compose without throwing.
  const designNumbers = [3, 50, 61, 62, 39, 51, 16, 52, 31, 41, 38, 54, 43];
  const personalityNumbers = [56, 60, 54, 53, 43, 4, 59, 59, 7, 41, 38, 38, 1];
  const designLines = [4, 4, 3, 3, 2, 6, 3, 6, 3, 5, 5, 2, 1];
  const personalityLines = [2, 2, 5, 5, 4, 6, 6, 4, 6, 3, 2, 6, 5];
  return [
    ...designNumbers.map((number, i) => ({
      number,
      line: designLines[i],
      planet: planets[i],
      isPersonality: false,
    })),
    ...personalityNumbers.map((number, i) => ({
      number,
      line: personalityLines[i],
      planet: planets[i],
      isPersonality: true,
    })),
  ];
}

function mockOpenAi(content: string, usage = { prompt_tokens: 500, completion_tokens: 200 }) {
  const response = {
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
      usage,
    }),
    text: async () => "",
  };
  global.fetch = vi.fn(async () => response as unknown as Response) as typeof fetch;
}

const IMAGE_PDF_ASSET = {
  mimeType: "application/pdf",
  data: Buffer.from("%PDF-fake-image-only"),
  filename: "screenshot.pdf",
  fileType: "hd",
};

describe("extractProfileFromAssets — Vision fallback for image-only PDFs (astral-asy)", () => {
  const originalFlag = process.env.FEATURE_EXTRACTION_VISION_FALLBACK;

  beforeEach(() => {
    extractPdfTextMock.mockReset();
    extractPdfTextMock.mockResolvedValue(""); // simulates an image-only PDF
    insertLlmCallMock.mockReset();
    // The Vision path is gated behind a feature flag in production. Tests
    // exercise the implementation directly so they enable it explicitly.
    process.env.FEATURE_EXTRACTION_VISION_FALLBACK = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalFlag === undefined) {
      delete process.env.FEATURE_EXTRACTION_VISION_FALLBACK;
    } else {
      process.env.FEATURE_EXTRACTION_VISION_FALLBACK = originalFlag;
    }
  });

  it("falls back to Vision when pdfjs extracts no text and returns a valid profile", async () => {
    const gates = buildValidGates();
    mockOpenAi(
      JSON.stringify({
        name: "Vision Subject",
        humanDesign: {
          type: "Generator",
          profile: "5/1",
          authority: "Sacral",
          definition: "Single Definition",
          activatedGates: gates,
        },
      }),
    );

    const profile = await extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key");

    expect(profile.name).toBe("Vision Subject");
    expect(profile.humanDesign.type).toBe("Generador"); // canonicalized
    expect(profile.humanDesign.profile).toBe("5/1");
    expect(profile.humanDesign.authority).toBe("Sacral");
    expect(profile.humanDesign.definition).toBe("Definición simple");
    expect(profile.humanDesign.activatedGates).toHaveLength(26);
    // Channels and centers are derived from gates, not taken from Vision
    expect(profile.humanDesign.channels.length).toBeGreaterThan(0);
    expect(profile.humanDesign.definedCenters.length).toBeGreaterThan(0);
    // Strategy / notSelfTheme are derived from type
    expect(profile.humanDesign.strategy).toBe("Esperar para responder");
    expect(profile.humanDesign.notSelfTheme).toBe("Frustración");
  });

  it("rejects when Vision returns fewer than 26 gates (hallucination guard)", async () => {
    mockOpenAi(
      JSON.stringify({
        humanDesign: {
          type: "Generator",
          activatedGates: buildValidGates().slice(0, 10),
        },
      }),
    );

    await expect(
      extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key"),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("rejects when Vision returns gate.line outside [1, 6]", async () => {
    const gates = buildValidGates();
    gates[0].line = 9;
    mockOpenAi(
      JSON.stringify({
        humanDesign: { type: "Generator", activatedGates: gates },
      }),
    );

    await expect(
      extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key"),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("rejects when Vision returns duplicated planets within one side", async () => {
    const gates = buildValidGates();
    gates[0].planet = gates[1].planet; // duplicate planet in design
    mockOpenAi(
      JSON.stringify({
        humanDesign: { type: "Generator", activatedGates: gates },
      }),
    );

    await expect(
      extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key"),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("records llm_calls telemetry when a telemetry context is provided", async () => {
    mockOpenAi(
      JSON.stringify({
        name: "T",
        humanDesign: {
          type: "Generator",
          activatedGates: buildValidGates(),
        },
      }),
    );

    await extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key", {
      userId: "user-abc",
    });

    expect(insertLlmCallMock).toHaveBeenCalledTimes(1);
    const call = insertLlmCallMock.mock.calls[0][0];
    expect(call.userId).toBe("user-abc");
    expect(call.route).toBe("extraction");
    expect(call.tokensIn).toBe(500);
    expect(call.tokensOut).toBe(200);
    expect(call.costUsd).toBeGreaterThan(0);
  });

  it("does NOT record telemetry when no context is passed (back-compat)", async () => {
    mockOpenAi(
      JSON.stringify({
        humanDesign: {
          type: "Generator",
          activatedGates: buildValidGates(),
        },
      }),
    );

    await extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key");

    expect(insertLlmCallMock).not.toHaveBeenCalled();
  });

  it("does NOT fall back to Vision when FEATURE_EXTRACTION_VISION_FALLBACK is not 'true'", async () => {
    delete process.env.FEATURE_EXTRACTION_VISION_FALLBACK;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key"),
    ).rejects.toBeInstanceOf(UserFacingError);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does NOT call Vision when the PDF has extractable text from a known provider (regression)", async () => {
    extractPdfTextMock.mockResolvedValueOnce(
      "Foundation Chart Quantum Name: Foo Bar Birth Date: 1990 www.geneticmatrix.com 1.2 2.3 3.4 …",
    );
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    // The deterministic path will likely fail to parse 26 gates from this
    // synthetic snippet — but the critical assertion is that we never call
    // fetch (Vision) when the deterministic path is the right one.
    await extractProfileFromAssets([IMAGE_PDF_ASSET], "fake-key").catch(() => {
      /* expected — synthetic text is not a real bodygraph */
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
