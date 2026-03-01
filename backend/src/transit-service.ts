/**
 * Transit Service — Swiss Ephemeris (WASM)
 *
 * Calcula posiciones planetarias reales usando Swiss Ephemeris,
 * la misma fuente que Astro.com, Jovian Archive y todo software serio.
 * Sin API keys, sin límites, sin costo.
 */

import SwissEph from "swisseph-wasm";
import { degreeToGate } from "./hd-gates.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanetTransit {
  name: string;
  longitude: number;
  sign: string;
  degree: number;
  isRetrograde: boolean;
  hdGate: number;
  hdLine: number;
}

export interface WeeklyTransits {
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
}

// ─── Planet config ────────────────────────────────────────────────────────────

interface PlanetDef {
  id: number;
  name: string;
}

// ─── Zodiac signs ─────────────────────────────────────────────────────────────

const SIGNS = [
  "Aries", "Tauro", "Géminis", "Cáncer",
  "Leo", "Virgo", "Libra", "Escorpio",
  "Sagitario", "Capricornio", "Acuario", "Piscis",
];

function longitudeToSign(lon: number): { sign: string; degree: number } {
  const normalized = ((lon % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const degree = parseFloat((normalized - signIndex * 30).toFixed(2));
  return { sign: SIGNS[signIndex], degree };
}

// ─── HD Channels ──────────────────────────────────────────────────────────────

const HD_CHANNELS: Record<string, string> = {
  "1-8": "Canal de Inspiración", "2-14": "Canal del Pulso",
  "3-60": "Canal de la Mutación", "4-63": "Canal de la Lógica",
  "5-15": "Canal del Ritmo", "6-59": "Canal de Mating",
  "7-31": "Canal del Alfa", "9-52": "Canal de la Concentración",
  "10-20": "Canal del Despertar", "10-57": "Canal del Perfeccionismo",
  "11-56": "Canal de la Curiosidad", "12-22": "Canal de la Apertura",
  "13-33": "Canal del Testimonio", "16-48": "Canal de la Longitud de Onda",
  "17-62": "Canal de la Aceptación", "18-58": "Canal de la Corrección",
  "19-49": "Canal de la Síntesis", "20-34": "Canal de Carisma",
  "20-57": "Canal de la Mente Cerebral", "21-45": "Canal del Dinero",
  "23-43": "Canal de la Estructuración", "24-61": "Canal del Conocimiento",
  "25-51": "Canal de la Iniciación", "26-44": "Canal de la Transmisión",
  "27-50": "Canal de la Preservación", "28-38": "Canal de la Lucha",
  "29-46": "Canal del Descubrimiento", "30-41": "Canal del Reconocimiento",
  "32-54": "Canal de la Transformación", "35-36": "Canal de lo Transitorio",
  "37-40": "Canal de la Comunidad", "39-55": "Canal de la Emoción",
  "42-53": "Canal de la Madurez", "47-64": "Canal de la Abstracción",
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function fetchWeeklyTransits(): Promise<WeeklyTransits> {
  const swe = new SwissEph();
  await swe.initSwissEph();

  const now = new Date();
  const jd = swe.julday(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours() + now.getUTCMinutes() / 60,
  );

  const PLANETS: PlanetDef[] = [
    { id: swe.SE_SUN,     name: "Sol"       },
    { id: swe.SE_MOON,    name: "Luna"      },
    { id: swe.SE_MERCURY, name: "Mercurio"  },
    { id: swe.SE_VENUS,   name: "Venus"     },
    { id: swe.SE_MARS,    name: "Marte"     },
    { id: swe.SE_JUPITER, name: "Júpiter"   },
    { id: swe.SE_SATURN,  name: "Saturno"   },
    { id: swe.SE_URANUS,  name: "Urano"     },
    { id: swe.SE_NEPTUNE, name: "Neptuno"   },
    { id: swe.SE_PLUTO,   name: "Plutón"    },
    { id: swe.SE_CHIRON,  name: "Quirón"    },
    { id: swe.SE_MEAN_NODE, name: "Nodo Norte" },
  ];

  const planets: PlanetTransit[] = [];

  for (const planet of PLANETS) {
    const result = swe.calc_ut(jd, planet.id, swe.SEFLG_SWIEPH | swe.SEFLG_SPEED);
    const longitude = ((result[0] % 360) + 360) % 360;
    const speed = result[3]; // negative = retrograde
    const { sign, degree } = longitudeToSign(longitude);
    const { gate, line } = degreeToGate(longitude);

    planets.push({
      name: planet.name,
      longitude: parseFloat(longitude.toFixed(4)),
      sign,
      degree,
      isRetrograde: speed < 0,
      hdGate: gate,
      hdLine: line,
    });

    // South Node = opposite of North Node
    if (planet.id === swe.SE_MEAN_NODE) {
      const southLon = ((longitude + 180) % 360 + 360) % 360;
      const southPos = longitudeToSign(southLon);
      const southGate = degreeToGate(southLon);
      planets.push({
        name: "Nodo Sur",
        longitude: parseFloat(southLon.toFixed(4)),
        sign: southPos.sign,
        degree: southPos.degree,
        isRetrograde: false,
        hdGate: southGate.gate,
        hdLine: southGate.line,
      });
    }
  }

  swe.close();

  // Detect full channels activated by transiting planets
  const activeGates = new Set(planets.map(p => p.hdGate));
  const activatedChannels: string[] = [];

  for (const [pair, channelName] of Object.entries(HD_CHANNELS)) {
    const [g1, g2] = pair.split("-").map(Number);
    if (activeGates.has(g1) && activeGates.has(g2)) {
      activatedChannels.push(channelName);
    }
  }

  return {
    fetchedAt: now.toISOString(),
    weekRange: getWeekRange(now),
    planets,
    activatedChannels,
  };
}

function getWeekRange(now: Date): string {
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  return `${fmt(monday)} al ${fmt(sunday)}`;
}
