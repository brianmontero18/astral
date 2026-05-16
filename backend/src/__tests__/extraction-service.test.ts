/**
 * Tests para parseHdSummaryFromText.
 *
 * El parser tiene que reconocer los 3 formatos reales que recibimos:
 *   - MyHumanDesign EN: labels "TYPE", "PROFILE", … sin ":".
 *   - Genetic Matrix EN: "Type:", "Inner Authority:", …
 *   - Genetic Matrix ES: "Tipo:", "Autoridad interna:", … (el sitio
 *     detecta el locale del browser y traduce los labels y los valores).
 *
 * Regresión de astral-86a: antes del fix el formato ES devolvía strings
 * vacíos en type/profile/authority/definition aunque el texto tenía la
 * información.
 */
import { describe, expect, it } from "vitest";
import { parseHdSummaryFromText } from "../extraction-service.js";

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
