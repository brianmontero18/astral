# Astral — HD Transit Refactor Spec

> **Repo**: `github.com/brianmontero18/astral`
> **Branch**: crear `feat/hd-transit-refactor` desde `main`
> **Objetivo**: Corregir el cálculo de tránsitos HD, agregar cruce tránsito↔usuario, eliminar astrología natal.

---

## Contexto

Astral es una app de Diseño Humano que genera reportes semanales personalizados.
El backend calcula posiciones planetarias con Swiss Ephemeris WASM y las mapea a puertas HD.

### Problemas encontrados

1. **Bug crítico**: `hd-gates.ts` tiene el offset del Rave Mandala mal — TODAS las puertas calculadas están ~56° desfasadas
2. **2 canales faltantes**: `HD_CHANNELS` tiene 34/36 canales (faltan 10-34 y 34-57)
3. **Sin cruce tránsito↔usuario**: el código solo detecta canales entre planetas en tránsito, no cruza con el bodygraph del usuario
4. **Astrología natal acoplada**: el sistema mezcla carta natal con Diseño Humano; queremos solo HD

### Qué hace Swiss Ephemeris (y qué NO)

Swiss Ephemeris calcula longitudes planetarias (astronomía). NO sabe nada de Diseño Humano.
La cadena es: Swiss Ephemeris → grados → `degreeToGate()` → puertas HD → lógica de cruce → impacto.
Hoy el "impacto" lo calcula el LLM por inferencia. Este refactor lo hace determinístico.

---

## Fuentes de verdad (validadas entre 3 fuentes independientes)

### Gate sequence offset

La secuencia de puertas del Rave Mandala NO empieza en 0° Aries.
- Gate 25 empieza en **28°15' Piscis = 358.25°** absolutos
- Gate 41 (posición 0 del array actual) empieza en **2°0' Acuario = 302°** absolutos
- El array `GATE_SEQUENCE` tiene el orden relativo CORRECTO, solo falta el offset

**Fuentes**:
- barneyandflow.com/gate-zodiac-degrees
- embodyyourdesign.com/blog/cheatsheet-astrology-positions-of-human-design-gates

### Gate-to-Center mapping (64 puertas → 9 centros)

```
Head (3):         64, 61, 63
Ajna (6):         47, 24, 4, 17, 43, 11
Throat (11):      62, 23, 56, 35, 12, 45, 33, 8, 31, 20, 16
G (8):            7, 1, 13, 10, 15, 2, 46, 25
Heart (4):        21, 40, 26, 51
Spleen (7):       48, 57, 44, 50, 32, 28, 18
Sacral (9):       5, 14, 29, 59, 9, 3, 42, 27, 34
SolarPlexus (7):  6, 37, 22, 36, 30, 55, 49
Root (9):         53, 60, 52, 19, 39, 41, 58, 38, 54
Total: 64 ✓
```

**Fuente**: freehumandesignchart.com/the-64-human-design-gates/

### Los 36 canales HD (el código tiene 34, faltan 2)

Canales faltantes:
```
"10-34": "Canal de la Exploración"   (G → Sacral)
"34-57": "Canal del Poder"           (Sacral → Spleen)
```

Ambos son canales de Integración (puertas 10, 20, 34, 57).

### Cómo los tránsitos impactan un bodygraph

4 tipos de impacto:

| Tipo | Qué es | Ejemplo |
|------|--------|---------|
| **Canal personal** | Usuario tiene una puerta, tránsito tiene la otra → canal temporal | Tu Gate 20 + Sol en Gate 34 → Canal de Carisma activado |
| **Canal educacional** | Ambas puertas del canal vienen de tránsitos, usuario no tiene ninguna | Marte en Gate 39 + Venus en Gate 55 → condicionamiento colectivo |
| **Puerta reforzada** | Tránsito activa puerta que el usuario ya tiene | Sol en tu Gate 51 → refuerza tu energía |
| **Centro condicionado** | Tránsito activa puerta en centro indefinido del usuario | Sol en Gate 34 → tu Sacral indefinido recibe presión temporal |

Regla: los tránsitos NUNCA quitan definición, solo agregan temporalmente.

---

## Fases de ejecución

### Fase 1: Fix `hd-gates.ts` — offset + GATE_TO_CENTER

**Archivo**: `backend/src/hd-gates.ts`

#### 1A. Fix del offset

Agregar constante y ajustar `degreeToGate()`:

```typescript
/**
 * Offset del Rave Mandala.
 * Gate 41 (primera posición del array) comienza en 2°0' Acuario = 302° absolutos.
 * Fuente: Rave Mandala estándar (Jovian Archive), validado contra
 * barneyandflow.com y embodyyourdesign.com.
 */
const WHEEL_OFFSET = 302;

export function degreeToGate(longitude: number): { gate: number; line: number } {
  const normalized = ((longitude % 360) + 360) % 360;
  const adjusted = ((normalized - WHEEL_OFFSET) % 360 + 360) % 360;
  const slot = Math.floor(adjusted / DEGREES_PER_GATE);
  const gate = GATE_SEQUENCE[slot];
  const positionWithinGate = adjusted - slot * DEGREES_PER_GATE;
  const line = Math.floor(positionWithinGate / (DEGREES_PER_GATE / 6)) + 1;
  return { gate, line: Math.min(line, 6) };
}
```

#### 1B. Agregar GATE_TO_CENTER + normalización de centros

Después de `GATE_SEQUENCE`, agregar.

**IMPORTANTE**: Los IDs canónicos de centros son en inglés (Head, Ajna, Throat, G, Heart, Spleen, Sacral, SolarPlexus, Root). Pero la extracción con GPT-4o Vision produce nombres en español (Cabeza, Garganta, Bazo, etc.) porque el `HD_PROMPT` los lista así. Para que `analyzeTransitImpact()` funcione, se necesita un normalizador que mapee variantes español/inglés al ID canónico.

```typescript
export const GATE_TO_CENTER: Record<number, string> = {
  // Head (3)
  64: "Head", 61: "Head", 63: "Head",
  // Ajna (6)
  47: "Ajna", 24: "Ajna", 4: "Ajna", 17: "Ajna", 43: "Ajna", 11: "Ajna",
  // Throat (11)
  62: "Throat", 23: "Throat", 56: "Throat", 35: "Throat", 12: "Throat",
  45: "Throat", 33: "Throat", 8: "Throat", 31: "Throat", 20: "Throat", 16: "Throat",
  // G Center (8)
  7: "G", 1: "G", 13: "G", 10: "G", 15: "G", 2: "G", 46: "G", 25: "G",
  // Heart/Will/Ego (4)
  21: "Heart", 40: "Heart", 26: "Heart", 51: "Heart",
  // Spleen (7)
  48: "Spleen", 57: "Spleen", 44: "Spleen", 50: "Spleen", 32: "Spleen", 28: "Spleen", 18: "Spleen",
  // Sacral (9)
  5: "Sacral", 14: "Sacral", 29: "Sacral", 59: "Sacral", 9: "Sacral",
  3: "Sacral", 42: "Sacral", 27: "Sacral", 34: "Sacral",
  // Solar Plexus (7)
  6: "SolarPlexus", 37: "SolarPlexus", 22: "SolarPlexus", 36: "SolarPlexus",
  30: "SolarPlexus", 55: "SolarPlexus", 49: "SolarPlexus",
  // Root (9)
  53: "Root", 60: "Root", 52: "Root", 19: "Root", 39: "Root",
  41: "Root", 58: "Root", 38: "Root", 54: "Root",
};

// Normaliza nombres de centros (español/inglés/variantes) al ID canónico.
// Necesario porque la extracción GPT-4o puede devolver cualquier variante.
const CENTER_NORMALIZE: Record<string, string> = {
  // Canonical English
  "Head": "Head", "Ajna": "Ajna", "Throat": "Throat", "G": "G",
  "Heart": "Heart", "Spleen": "Spleen", "Sacral": "Sacral",
  "SolarPlexus": "SolarPlexus", "Root": "Root",
  // Spanish (from extraction HD_PROMPT)
  "Cabeza": "Head", "Garganta": "Throat", "Centro G": "G",
  "Corazón/Ego": "Heart", "Corazón": "Heart",
  "Bazo": "Spleen", "Raíz": "Root",
  "Solar Plexus": "SolarPlexus", "Plexo Solar": "SolarPlexus",
  // Common English variants
  "G Center": "G", "Identity": "G", "Self": "G",
  "Will": "Heart", "Ego": "Heart", "Splenic": "Spleen",
  "Emotional": "SolarPlexus",
};

export function normalizeCenter(name: string): string {
  return CENTER_NORMALIZE[name] ?? name;
}
```

#### 1C. Validación obligatoria

Después de hacer el cambio, verificar estos 5 test cases:

| Longitud | Posición zodiacal | Gate esperado | Línea esperada |
|----------|-------------------|---------------|----------------|
| 0° | 0° Aries | 25 | 1 |
| 302° | 2° Aquarius | 41 | 1 |
| 347° | 17° Pisces | 22 | 1 |
| 358.25° | 28°15' Pisces | 25 | 1 |
| 3.875° | 3°52'30" Aries | 17 | 1 |

Validar programáticamente (crear un test inline o script temporal):
```typescript
const cases = [
  { lon: 0, expectedGate: 25 },
  { lon: 302, expectedGate: 41 },
  { lon: 347, expectedGate: 22 },
  { lon: 358.25, expectedGate: 25 },
  { lon: 3.875, expectedGate: 17 },
];
for (const { lon, expectedGate } of cases) {
  const { gate } = degreeToGate(lon);
  if (gate !== expectedGate) throw new Error(`FAIL: ${lon}° → gate ${gate}, expected ${expectedGate}`);
}
```

Si alguno falla, NO continuar. Revisar el offset.

Verificar también que `Object.keys(GATE_TO_CENTER).length === 64`.

---

### Fase 2: Agregar canales faltantes + lógica de cruce en `transit-service.ts`

**Archivo**: `backend/src/transit-service.ts`

#### 2A. Agregar los 2 canales faltantes

En `HD_CHANNELS`, agregar:

```typescript
"10-34": "Canal de la Exploración",
"34-57": "Canal del Poder",
```

Verificar que el total sea 36: `Object.keys(HD_CHANNELS).length === 36`.

#### 2B. Nueva función `analyzeTransitImpact()`

Agregar tipos e implementación:

```typescript
import { GATE_TO_CENTER, normalizeCenter } from "./hd-gates.js";

// ─── Transit Impact Types ─────────────────────────────────────────────────────

export interface PersonalChannel {
  channelId: string;
  channelName: string;
  userGate: number;
  transitGate: number;
  transitPlanet: string;
}

export interface EducationalChannel {
  channelId: string;
  channelName: string;
  planet1: string;
  planet2: string;
}

export interface ReinforcedGate {
  gate: number;
  planet: string;
}

export interface ConditionedCenter {
  center: string;
  gates: Array<{ gate: number; planet: string }>;
}

export interface TransitImpact {
  personalChannels: PersonalChannel[];
  educationalChannels: EducationalChannel[];
  reinforcedGates: ReinforcedGate[];
  conditionedCenters: ConditionedCenter[];
}

// ─── HD Profile (minimal, solo lo necesario para el cruce) ────────────────────

export interface UserHDProfile {
  activatedGates: Array<{ number: number }>;
  definedCenters: string[];
}

// ─── Impact Analysis ──────────────────────────────────────────────────────────

export function analyzeTransitImpact(
  transits: WeeklyTransits,
  hdProfile: UserHDProfile,
): TransitImpact {
  const userGateSet = new Set(
    (hdProfile.activatedGates ?? []).map(g => g.number)
  );
  const definedCenterSet = new Set(
    (hdProfile.definedCenters ?? []).map(c => normalizeCenter(c))
  );

  // Map: gate number → transiting planet name(s)
  const transitGateMap = new Map<number, string[]>();
  for (const p of transits.planets) {
    const existing = transitGateMap.get(p.hdGate) ?? [];
    existing.push(p.name);
    transitGateMap.set(p.hdGate, existing);
  }

  const personalChannels: PersonalChannel[] = [];
  const educationalChannels: EducationalChannel[] = [];
  const reinforcedGates: ReinforcedGate[] = [];
  const conditionedCenterMap = new Map<string, Array<{ gate: number; planet: string }>>();

  // 1. Reinforced gates: transit hits a gate user already has
  for (const [gate, planets] of transitGateMap) {
    if (userGateSet.has(gate)) {
      for (const planet of planets) {
        reinforcedGates.push({ gate, planet });
      }
    }
  }

  // 2. Channel analysis
  for (const [pair, channelName] of Object.entries(HD_CHANNELS)) {
    const [g1, g2] = pair.split("-").map(Number);
    const g1InUser = userGateSet.has(g1);
    const g2InUser = userGateSet.has(g2);
    const g1InTransit = transitGateMap.has(g1);
    const g2InTransit = transitGateMap.has(g2);

    // Personal channel: user has one gate, transit has the other
    if (g1InUser && !g2InUser && g2InTransit) {
      for (const planet of transitGateMap.get(g2)!) {
        personalChannels.push({
          channelId: pair,
          channelName,
          userGate: g1,
          transitGate: g2,
          transitPlanet: planet,
        });
      }
    } else if (g2InUser && !g1InUser && g1InTransit) {
      for (const planet of transitGateMap.get(g1)!) {
        personalChannels.push({
          channelId: pair,
          channelName,
          userGate: g2,
          transitGate: g1,
          transitPlanet: planet,
        });
      }
    }

    // Educational channel: neither gate in user, both in transit
    if (!g1InUser && !g2InUser && g1InTransit && g2InTransit) {
      educationalChannels.push({
        channelId: pair,
        channelName,
        planet1: transitGateMap.get(g1)![0],
        planet2: transitGateMap.get(g2)![0],
      });
    }
  }

  // 3. Conditioned centers: transit activates gate in user's undefined center
  for (const [gate, planets] of transitGateMap) {
    if (userGateSet.has(gate)) continue; // skip reinforced gates
    const center = GATE_TO_CENTER[gate];
    if (!center) continue;
    if (definedCenterSet.has(center)) continue; // only undefined centers

    if (!conditionedCenterMap.has(center)) {
      conditionedCenterMap.set(center, []);
    }
    for (const planet of planets) {
      conditionedCenterMap.get(center)!.push({ gate, planet });
    }
  }

  const conditionedCenters: ConditionedCenter[] = [];
  for (const [center, gates] of conditionedCenterMap) {
    conditionedCenters.push({ center, gates });
  }

  return { personalChannels, educationalChannels, reinforcedGates, conditionedCenters };
}
```

**Nota**: No modificar `fetchWeeklyTransits()` — esa función sigue igual (Swiss Ephemeris + gate mapping). Lo nuevo es `analyzeTransitImpact()` que recibe los tránsitos YA calculados + el perfil HD del usuario.

---

### Fase 3: Actualizar endpoint `/api/transits`

**Archivo**: `backend/src/routes/transits.ts`

Agregar query param `userId` opcional:

```typescript
import { getUser } from "../db.js";
import { analyzeTransitImpact, type TransitImpact } from "../transit-service.js";

export async function transitRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { userId?: string } }>("/transits", async (req, reply) => {
    try {
      const transits = await getTransitsCached();

      // Si viene userId, calcular impacto personalizado
      let impact: TransitImpact | undefined;
      if (req.query.userId) {
        const user = await getUser(req.query.userId);
        if (user) {
          const profile = user.profile as { humanDesign?: { activatedGates?: Array<{ number: number }>; definedCenters?: string[] } };
          impact = analyzeTransitImpact(transits, {
            activatedGates: profile.humanDesign?.activatedGates ?? [],
            definedCenters: profile.humanDesign?.definedCenters ?? [],
          });
        }
      }

      return reply.send({ ...transits, ...(impact && { impact }) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(message);
      return reply.status(502).send({ error: message });
    }
  });
}
```

---

### Fase 4: Refactor backend — quitar astrología natal

#### 4A. `backend/src/agent-service.ts`

**Eliminar**:
- Interface `NatalPlanet`
- Toda la sección `CARTA NATAL` del system prompt (planetas, ascendente, medio cielo, nodos)

**Modificar `UserProfile`**: quitar campo `natal`, dejar solo:
```typescript
export interface UserProfile {
  name: string;
  birthData?: { date: string; time: string; location: string };
  humanDesign: {
    type: string;
    strategy: string;
    authority: string;
    profile: string;
    definition: string;
    incarnationCross: string;
    notSelfTheme: string;
    variable: string;
    digestion: string;
    environment: string;
    strongestSense: string;
    channels: Array<{ id: string; name: string; circuit: string }>;
    activatedGates: Array<{ number: number; line: number; planet: string; isPersonality: boolean }>;
    definedCenters: string[];
    undefinedCenters: string[];
  };
}
```

**Actualizar las 3 funciones** que necesitan recibir `TransitImpact`:

**1. `buildSystemPrompt`** — agregar parámetro `impact` y bloque de impacto en el prompt:

```typescript
import type { TransitImpact } from "./transit-service.js";

function buildSystemPrompt(
  profile: UserProfile,
  transits: WeeklyTransits,
  impact?: TransitImpact,
): string {
  // ... (HD block y transits block existentes) ...

  // Después del bloque TRÁNSITOS REALES, agregar:
  const impactBlock = impact ? `

IMPACTO EN TU DISEÑO ESTA SEMANA:

CANALES PERSONALES ACTIVADOS (tránsito completa tu canal):
${impact.personalChannels.map(c =>
    `- ${c.channelName} (${c.channelId}): tu Puerta ${c.userGate} + ${c.transitPlanet} en Puerta ${c.transitGate}`
  ).join("\n") || "- Ninguno esta semana"}

CENTROS CONDICIONADOS (tránsito activa tu centro indefinido):
${impact.conditionedCenters.map(c =>
    `- ${c.center}: ${c.gates.map(g => `${g.planet} en Puerta ${g.gate}`).join(", ")}`
  ).join("\n") || "- Ninguno esta semana"}

PUERTAS REFORZADAS (tránsito toca puerta que ya tenés):
${impact.reinforcedGates.map(r =>
    `- Tu Puerta ${r.gate} reforzada por ${r.planet}`
  ).join("\n") || "- Ninguna esta semana"}` : "";

  // Concatenar impactBlock al final del prompt, antes de INSTRUCCIONES CRÍTICAS
```

**2. `runAstralAgent`** — propagar `impact` a `buildSystemPrompt`:

```typescript
export async function runAstralAgent(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,      // ← NUEVO parámetro
): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact);
  return callOpenAI(messages, systemPrompt, openaiKey);
}
```

**3. `runAstralAgentStream`** — idem:

```typescript
export async function* runAstralAgentStream(
  profile: UserProfile,
  transits: WeeklyTransits,
  messages: ChatMessage[],
  openaiKey: string,
  impact?: TransitImpact,      // ← NUEVO parámetro
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(profile, transits, impact);
  // ... resto de la función streaming igual ...
}
```

Esto le da al LLM datos CALCULADOS en vez de dejar que los infiera.

**Actualizar el system prompt**: quitar la instrucción `2. Cruzá cada tránsito con la carta natal y HD del usuario` y reemplazar con: `2. Usá los datos de IMPACTO EN TU DISEÑO provistos arriba. Son calculados, no los recalcules ni contradigas.`

#### 4B. `backend/src/extraction-service.ts`

**Eliminar**: `NATAL_PROMPT` completo.

**Modificar `MERGE_PROMPT`**: quitar toda la sección `natal` del JSON de salida. Solo queda `humanDesign` + `name` + `birthData`.

**Simplificar `extractProfileFromAssets()`**: quitar el branch `natalAssets`. Todo archivo se procesa con `HD_PROMPT`.

#### 4C. `backend/src/routes/chat.ts`

Pasar `impact` al agent service:

```typescript
const transits = await getTransitsCached();
const impact = analyzeTransitImpact(transits, {
  activatedGates: profile.humanDesign?.activatedGates ?? [],
  definedCenters: profile.humanDesign?.definedCenters ?? [],
});
const replyText = await runAstralAgent(profile, transits, messages, OPENAI_KEY, impact);
```

Lo mismo para `runAstralAgentStream`.

---

### Fase 5: Refactor frontend

#### 5A. `frontend/src/types.ts`

**Eliminar**: `NatalPlanet`.
**Eliminar** de `UserProfile`: todo el campo `natal`.

**Nota sobre `activatedChannels` vs `impact`**: La respuesta de `/api/transits` retorna ambos campos. NO son redundantes:
- `activatedChannels`: canales donde ambas puertas están en tránsito. Es el "clima colectivo" — igual para todos, no requiere userId.
- `impact.educationalChannels`: subconjunto de `activatedChannels` donde el usuario NO tiene ninguna de las dos puertas (los canales donde el usuario SÍ tiene una puerta van a `impact.personalChannels`).
- Sin `userId`, solo viene `activatedChannels`. Con `userId`, vienen ambos.

**Agregar**:
```typescript
export interface PersonalChannel {
  channelId: string;
  channelName: string;
  userGate: number;
  transitGate: number;
  transitPlanet: string;
}

export interface TransitImpact {
  personalChannels: PersonalChannel[];
  educationalChannels: Array<{ channelId: string; channelName: string; planet1: string; planet2: string }>;
  reinforcedGates: Array<{ gate: number; planet: string }>;
  conditionedCenters: Array<{ center: string; gates: Array<{ gate: number; planet: string }> }>;
}

export interface TransitsResponse {
  fetchedAt: string;
  weekRange: string;
  planets: PlanetTransit[];
  activatedChannels: string[];
  impact?: TransitImpact;
}
```

#### 5B. `frontend/src/api.ts`

Modificar `fetchTransits()` para aceptar userId:

```typescript
export async function fetchTransits(userId?: string): Promise<TransitsResponse> {
  const params = userId ? `?userId=${userId}` : "";
  const res = await fetch(`${BASE}/transits${params}`);
  if (!res.ok) throw new Error(`Transits error ${res.status}`);
  return res.json();
}
```

#### 5C. `frontend/src/components/OnboardingFlow.tsx`

Cambiar de 2 slots a 1:
- Eliminar el slot de "Carta Natal" (index 0)
- Dejar solo "Carta de Diseño Humano"
- Eliminar `natalRef`, queda solo un `fileRef`
- Todos los uploads van como `fileType: "hd"`

#### 5D. `frontend/src/components/ProfilePanel.tsx`

Eliminar filas natales: "Ascendente", "Sol".
Mantener solo datos HD: Tipo, Estrategia, Autoridad, Perfil, etc.

#### 5E. `frontend/src/components/TransitViewer.tsx`

Recibir `userId` como prop. Pasar a `fetchTransits(userId)`.

**Mapa de display para centros**: Los IDs canónicos del backend son en inglés ("Head", "Throat", etc.) pero la UI es en español. Agregar mapa de display:

```typescript
const CENTER_DISPLAY: Record<string, string> = {
  Head: "Cabeza", Ajna: "Ajna", Throat: "Garganta",
  G: "Centro G", Heart: "Corazón", Spleen: "Bazo",
  Sacral: "Sacral", SolarPlexus: "Plexo Solar", Root: "Raíz",
};
```

Usar `CENTER_DISPLAY[center] ?? center` al renderizar nombres de centros.

Agregar secciones cuando `data.impact` existe:
1. **Canales Personales** — lista con borde dorado, muestra "Tu Puerta X + Planeta en Puerta Y = Canal Z"
2. **Centros Condicionados** — lista con borde amatista, muestra "Centro X: Planeta en Puerta Y" (usar `CENTER_DISPLAY` para el nombre)
3. **Puertas Reforzadas** — sutil, muestra "Tu Puerta X reforzada por Planeta"

Mantener el grid de planetas existente.

#### 5F. `frontend/src/App.tsx`

Pasar `user.id` a `TransitViewer`:
```tsx
{currentView === "transits" && <TransitViewer profile={profile} userId={user.id} />}
```

---

### Fase 6: Actualizar `CLAUDE.md`

#### Cambios:
1. Quitar "Archivos que NO se tocan" (o actualizar — transit-service.ts y hd-gates.ts fueron refactoreados)
2. En "Arquitectura": quitar menciones a carta natal como feature activa
3. En "Flujo de datos": actualizar paso 3 de Tránsitos para incluir `impact`
4. En "API": actualizar la ruta `/api/transits` para documentar `?userId=`
5. En "types.ts": documentar que `UserProfile.natal` ya no existe
6. En "Decisiones técnicas": agregar nota sobre el offset 302° del Rave Mandala
7. En "Pendientes": mantener los items existentes (CORS, etc.) y agregar: "La extracción ahora solo soporta bodygraphs HD — si se quiere re-agregar carta natal en el futuro, crear un extraction prompt separado"

---

## Orden de ejecución (dependencias)

```
Fase 1  hd-gates.ts               ← sin dependencias, validar PRIMERO
  │
  ├─ Fase 2  transit-service.ts    ← depende de Fase 1 (usa GATE_TO_CENTER)
  │    │
  │    └─ Fase 3  routes/transits  ← depende de Fase 2 (usa analyzeTransitImpact)
  │    └─ Fase 4C routes/chat      ← depende de Fase 2
  │
  ├─ Fase 4A agent-service.ts      ← depende de Fase 2 (recibe TransitImpact)
  ├─ Fase 4B extraction-service.ts ← independiente (solo quitar natal)
  │
  ├─ Fase 5A types.ts (frontend)   ← independiente
  ├─ Fase 5B api.ts                ← depende de Fase 5A
  ├─ Fase 5C OnboardingFlow        ← depende de Fase 5A
  ├─ Fase 5D ProfilePanel          ← depende de Fase 5A
  ├─ Fase 5E TransitViewer         ← depende de Fase 5A, 5B
  ├─ Fase 5F App.tsx               ← depende de Fase 5E
  │
  └─ Fase 6  CLAUDE.md             ← última, después de todo
```

**Parallelizables**: 4B, 5A, 5C, 5D pueden ejecutarse en paralelo después de Fase 2.

---

## Validación post-implementación

### Checklist

- [ ] `degreeToGate(0)` devuelve Gate 25 (no 41)
- [ ] `degreeToGate(302)` devuelve Gate 41
- [ ] `degreeToGate(358.25)` devuelve Gate 25
- [ ] `degreeToGate(3.875)` devuelve Gate 17
- [ ] `degreeToGate(347)` devuelve Gate 22
- [ ] `Object.keys(GATE_TO_CENTER).length === 64`
- [ ] `normalizeCenter("Cabeza") === "Head"` y `normalizeCenter("Corazón/Ego") === "Heart"` (normalización español→inglés)
- [ ] `Object.keys(HD_CHANNELS).length === 36`
- [ ] `HD_CHANNELS` incluye "10-34" y "34-57"
- [ ] `UserProfile` no tiene campo `natal`
- [ ] `NatalPlanet` no existe en ningún archivo
- [ ] Extraction service no tiene `NATAL_PROMPT`
- [ ] Onboarding tiene 1 slot de upload, no 2
- [ ] ProfilePanel no muestra Ascendente ni Sol natal
- [ ] `/api/transits?userId=X` retorna `impact` con canales personales
- [ ] `/api/transits` (sin userId) retorna solo tránsitos base
- [ ] System prompt del agente incluye bloque de IMPACTO calculado
- [ ] System prompt del agente NO incluye sección CARTA NATAL
- [ ] `runAstralAgent` y `runAstralAgentStream` aceptan parámetro `impact?: TransitImpact`
- [ ] `npm run build` compila sin errores (frontend + backend)
- [ ] CLAUDE.md actualizado sin referencias a carta natal como feature activa

### Smoke test manual

1. `npm run dev`
2. Onboarding: subir solo bodygraph HD → debe extraer perfil correctamente
3. Chat: pedir "reporte semanal" → debe mencionar canales personales activados con datos específicos
4. Tránsitos: la vista debe mostrar sección de canales personales y centros condicionados

---

## Lo que NO se toca

- `transit-service.ts:fetchWeeklyTransits()` — el cálculo de Swiss Ephemeris sigue igual
- `hd-gates.ts:GATE_SEQUENCE` — el array no cambia, solo se agrega offset
- `frontend/src/index.css` — sin cambios de estilo
- `frontend/src/main.tsx` — sin cambios
- `frontend/src/utils.ts` — sin cambios (parseReport sigue igual)
- `frontend/src/components/ReportRenderer.tsx` — sin cambios
- `frontend/src/components/ChatView.tsx` — sin cambios (usa lo que el backend le mande)
- `Dockerfile`, `fly.toml` — sin cambios de infra

---

## Notas para el agente executor

1. **Clonar el repo**: `git clone https://github.com/brianmontero18/astral.git`
2. **Branch**: `git checkout -b feat/hd-transit-refactor`
3. **Ejecutar Fase 1 PRIMERO y validar** antes de tocar cualquier otro archivo
4. **No inventar datos HD** — usar SOLO las tablas de este spec
5. **Mantener el estilo** del código existente: inline styles en frontend, camelCase en API responses, español en UI/prompts
6. **CLAUDE.md del repo dice "no tocar transit-service.ts"** — ignorar esa instrucción, este spec la overridea explícitamente
7. **No agregar tests formales** si el repo no los tiene — usar la validación inline del checklist
8. **No cambiar la estructura de archivos** — no crear archivos nuevos, solo modificar existentes (excepto si se necesita un archivo de tipos compartido)
9. **Centros: siempre normalizar** — los nombres de centros en el perfil del usuario vienen de GPT-4o Vision y pueden ser en español ("Cabeza", "Bazo") o inglés ("Head", "Spleen"). Usar `normalizeCenter()` de `hd-gates.ts` SIEMPRE que se comparen centros del usuario contra `GATE_TO_CENTER`
