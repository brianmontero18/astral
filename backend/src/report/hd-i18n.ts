/**
 * HD Internationalization — Report Display
 *
 * Translation maps for displaying HD data in Spanish within reports.
 * These complement (not duplicate) the extraction maps in extraction-service.ts.
 * Extraction maps: English→Spanish for normalizing GPT output.
 * These maps: canonical English IDs → Spanish display labels for reports.
 */

export const PLANET_ES: Record<string, string> = {
  Sun: "Sol",
  Earth: "Tierra",
  Moon: "Luna",
  Mercury: "Mercurio",
  Venus: "Venus",
  Mars: "Marte",
  Jupiter: "Júpiter",
  Saturn: "Saturno",
  Uranus: "Urano",
  Neptune: "Neptuno",
  Pluto: "Plutón",
  NorthNode: "Nodo Norte",
  SouthNode: "Nodo Sur",
};

export const CIRCUIT_ES: Record<string, string> = {
  "Individual Knowing": "Individual de Conocimiento",
  "Individual Centering": "Individual de Centraje",
  "Collective Understanding": "Colectivo de Entendimiento",
  "Collective Sensing": "Colectivo de Sentido",
  "Tribal Defense": "Tribal de Defensa",
  "Tribal Ego": "Tribal del Ego",
  Integration: "Integración",
};

export const PROFILE_ES: Record<string, string> = {
  "1/3": "Investigador / Mártir",
  "1/4": "Investigador / Oportunista",
  "2/4": "Ermitaño / Oportunista",
  "2/5": "Ermitaño / Hereje",
  "3/5": "Mártir / Hereje",
  "3/6": "Mártir / Modelo a Seguir",
  "4/6": "Oportunista / Modelo a Seguir",
  "4/1": "Oportunista / Investigador",
  "5/1": "Hereje / Investigador",
  "5/2": "Hereje / Ermitaño",
  "6/2": "Modelo a Seguir / Ermitaño",
  "6/3": "Modelo a Seguir / Mártir",
};

export const CENTER_CANONICAL_TO_ES: Record<string, string> = {
  Head: "Cabeza",
  Ajna: "Ajna",
  Throat: "Garganta",
  G: "Centro G",
  Heart: "Corazón",
  Spleen: "Bazo",
  Sacral: "Sacral",
  SolarPlexus: "Plexo Solar",
  Root: "Raíz",
};

export function centerToSpanish(canonical: string): string {
  return CENTER_CANONICAL_TO_ES[canonical] ?? canonical;
}

export function translateHD(key: string, map: Record<string, string>): string {
  return map[key] ?? key;
}
