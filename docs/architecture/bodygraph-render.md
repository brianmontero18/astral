# Bodygraph render — arquitectura de capas

**Status**: vivo. Esta es la fuente de verdad para CUALQUIER agente (IA o humano) que toque la generación de bodygraphs / Foundation Charts. Si tu cambio rompe alguna regla acá, parate y revisa.

**Contexto**: parte del pivot Swiss Ephemeris (bead `astral-jrf` y descendientes). Reemplaza el flujo de subir PDF de bodygraph por cálculo determinístico desde birth data.

---

## 1. Capas (decoupling estricto)

```
                         ┌─────────────────────────────────────┐
   Input                  │ CAPA 1 — CÁLCULO                    │
   ─────                  │ backend/src/bodygraph/calculate.ts  │
   BirthData    ──────▶   │ + tablas HD canónicas               │
   { date, time, tz,      │ (hd-gates, hd-channels,             │
     placeLabel?,         │  hd-lines, hd-crosses, hd-fixings,  │
     coordinates?,        │  hd-variables)                      │
     name? }              │                                     │
                         │ Swiss Ephemeris (astronomía)        │
                         └────────────────┬────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────────┐
                         │ DTO — UserProfile (contrato)         │
                         │ backend/src/types/agent.ts           │
                         │ TODO lo que un consumidor necesita,  │
                         │ ya derivado y nombrado.              │
                         └────────────┬────────────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ CAPA 2a — RENDER │   │ CAPA 2b — RENDER │   │ CAPA 2c — CHAT/  │
   │ SVG              │   │ PDF              │   │ AI               │
   │ render-svg.ts +  │   │ render-pdf.tsx   │   │ agent-service-v2 │
   │ svg-geometry.ts  │   │ (pdfkit +        │   │ (system prompt)  │
   │ + planet-symbols │   │  svg-to-pdfkit)  │   │                  │
   └──────────────────┘   └──────────────────┘   └──────────────────┘
        ▼                       ▼                       ▼
    SVG string              PDF buffer              prompt text
```

### Reglas duras

1. **Capa 1 no sabe que existe SVG/PDF**. No importa shapes, ni colores, ni viewBoxes. Emite `UserProfile` y nada más.
2. **Capa 2 no recalcula nada HD**. Recibe `UserProfile` completo y consume. Si necesita algo nuevo (ej. retrograde flag), se agrega al DTO, no se computa en el renderer.
3. **Tablas canónicas HD** (line names, incarnation crosses, fixing states, variable wheel) viven con la capa 1. Son **lookups**, no rendering.
4. **Paletas, posiciones, fonts, dimensiones** viven en `render-svg.ts` / `svg-geometry.ts`. La capa 1 nunca habla de hexcodes.
5. **Birth metadata** (date local, UTC, place, coordinates, age, designDate) viaja **adentro del `UserProfile`**, no como argumentos paralelos al renderer.
6. **Source of truth única para HD canon**: la definición autoritativa de los 64 gates, 36 channels y 9 centers vive en `hd-gates.ts` + `hd-channels.ts` (capa 1). `svg-geometry.ts` lista esos ids junto a sus coordenadas SVG; los ids deben matchear ambos lados. Si HD cambia (ej. renombrar un canal), se actualiza canon y geometría juntas. **Deuda técnica reconocida**: `svg-geometry.ts` no `import`-a de `hd-channels.ts` hoy — refactorearlo para iterar `HD_CHANNELS_FULL` y agregar coords queda como cleanup futuro, sin bead asignado.

---

## 2. Contratos

### 2.1 BirthData (input)

```ts
interface BirthData {
  date: string;                    // ISO yyyy-mm-dd (LOCAL)
  time: string;                    // HH:mm 24h (LOCAL)
  timezoneOffsetHours: number;     // ej. -3 para AR
  placeLabel?: string;             // "Buenos Aires, Argentina"
  coordinates?: { lat: number; lon: number };  // P0+ requirement
  name?: string;
}
```

### 2.2 UserProfile (DTO core — target shape)

```ts
interface UserProfile {
  name: string;
  birthData: {
    dateLocalIso: string;          // "1988-12-28T04:13:00-03:00"
    dateUtcIso: string;            // "1988-12-28T06:13:00Z"
    placeLabel: string;
    coordinates?: { lat: number; lon: number };
    timezoneOffsetHours: number;
    ageYears: number;
  };
  humanDesign: {
    // Identidad
    type: string;                              // "Proyector"
    typeQualifier?: string;                    // "Emocional" → "Emotional Projector" display
    profile: string;                           // "4/6"
    profileName: string;                       // "Opportunist / Role Model"
    authority: string;
    definition: string;
    strategy: string;
    incarnationCross: string;                  // "RAX Service 4"
    themes: { positive: string; notSelf: string }; // "Success / Bitterness"
    notSelfTheme: string;                      // backward compat (= themes.notSelf)

    // Variables (Design + Personality)
    design: {
      date: string;                            // ISO of design moment (~88° antes)
      brain?: "Active" | "Passive";
      determination?: string;                  // 12-value lookup
      cognition?: string;                      // 6-value lookup
      environment?: string;
      environmentStyle?: string;
    };
    personality: {
      personality?: string;
      motivation?: string;
      sense?: string;
      trajectory?: string;
      viewPerspective?: string;
      view?: string;
      transferredMotivation?: string;
      transferredView?: string;
    };

    // Geometría HD
    channels: Array<{ id: string; name: string; circuit: string; subCircuit?: string }>;
    activatedGates: Array<{
      number: number;
      line: number;                            // 1..6
      tone?: number;                           // 1..6 (subdivisión de line)
      planet: string;
      isPersonality: boolean;
      isRetrograde?: boolean;
      fixingState?: "exalted" | "detriment" | "juxtaposed" | null;
    }>;
    definedCenters: string[];
    undefinedCenters: string[];
  };
}
```

### 2.3 Render functions (capa 2a)

```ts
// Solo el chart (centros + canales + gates). Sin paneles, sin header.
renderBodygraphSvg(profile: UserProfile, opts?: { width; height }): string

// Documento completo: header + design panel + chart + personality panel.
renderFullDocument(profile: UserProfile, opts?: { width; height }): string
//                ↑ birth metadata viene en profile.birthData.
```

`renderFullDocument` ya no recibe `birth` como argumento paralelo. Todo dato
de nacimiento que el renderer necesita debe viajar dentro de `profile.birthData`.

---

## 3. Status (a 2026-05-24)

### ✅ Hecho

**Capa render (fases 1-3 originales de `astral-jrf`)**:
- `backend/src/bodygraph/calculate.ts` — POC determinístico Swiss Eph, 26/26 gates validados contra Agos + Brian.
- `backend/src/bodygraph/svg-geometry.ts` — 9 centros, 64 gates, 30 line channels + Integration knot K4 (hub + 4 spokes).
- `backend/src/bodygraph/planet-symbols.ts` — 13 glifos planetarios vectoriales (portados de SharpAstrology MIT).
- `backend/src/bodygraph/render-svg.ts` — `renderBodygraphSvg()` + `renderFullDocument()`. Activación P/D/Mixed/none por gate y channel half.
- `backend/src/bodygraph/render-pdf.tsx` — `renderBodygraphPdf(profile)`: convierte el SVG completo a PDF vector puro con `pdfkit` + `svg-to-pdfkit`. **Importa `render-svg.ts`** y no recalcula HD; mantiene paths/texto vectoriales en lugar de rasterizar el chart.

**Capa cálculo P0 (`astral-ffm`)**:
- `backend/src/hd-meta.ts` — tablas chicas (`PROFILE_LINE_NAMES`, `TYPE_POSITIVE_THEME`, `TYPE_QUALIFIER_BY_AUTHORITY`) + helpers (`lookupProfileName`, `lookupPositiveTheme`, `lookupTypeQualifier`, `calcAgeYears`).
- `calculate.ts` populate todos los campos esenciales del DTO: `birthData` ISOs + tz + age, `typeQualifier`, `profileName`, `themes.{positive, notSelf}`, `design.date`, `activatedGates[].isRetrograde`.
- Prompt builder v2 migrado al nuevo shape via `formatBirthForPrompt` en `agent-prompt-helpers.ts`.
- `renderFullDocument` corrigió la violación de regla 5: ya no recibe `birth:` aparte — todo desde `profile.birthData`.

**Validación contra Foundation Chart real de Agos**:
- `design.date` matches `01 October 1988, 17:14:58` al segundo.
- `typeQualifier="Emotional"`, `profileName="Opportunistic / Role Model"`, `themes.positive="Success"`.
- Mercury retrograde verificado contra Swiss Eph ground truth: Design retro (-0.343°/día), Personality direct (+1.547°/día).

Estado histórico de esa etapa: 507/507 tests verde, tsc limpio. El conteo actual de la suite puede cambiar; verificar con `cd backend && npx vitest run`.

### Observaciones del cross-check con Foundation Chart oficial

- **Genetic Matrix usa "Opportunistic"** (no "Opportunist" del canon Ra Uru Hu). Nuestra tabla `PROFILE_LINE_NAMES` se alinea al dialecto de Genetic Matrix.
- **Genetic Matrix NO renderiza markers "R" en este layout de Foundation Chart**. Los markers visibles `△ ▽` son **fixing state** (Exalted/Detriment), no retrograde. `astral-lor` (P3.3) va a pintar fixing state visualmente; la representación de retrograde queda como decisión de diseño nuestra (probablemente fuera de scope para MVP).
- **Naming canónico de subdivisiones**: HD canon (per SharpAstrology.HumanDesign/Utility/HumanDesignUtility.cs) define cinco niveles: `gate → line → color → tone → base`. La primera versión de `astral-hjx` llamó "tone" a lo que canon llama "color"; corregido en `astral-hjx-fix` (rename + agregar tone real + base). El Variable Wheel consume color y tone por separado.

### ❌ Falta — agrupado por paquetes

Ver beads hijos abajo. La sección 4 detalla el gap analysis.

---

## 4. Gap analysis (vs Foundation Chart de Genetic Matrix)

### 4.1 Capa 1 — datos del DTO

| Campo | Ubicación target | Bead |
|---|---|---|
| `birthData.dateLocalIso` / `dateUtcIso` / `coordinates` / `ageYears` | DTO root | P0 |
| `humanDesign.design.date` (designDate ISO) | DTO | P0 |
| `humanDesign.typeQualifier` ("Emocional"/"Mental") | DTO | P0 |
| `humanDesign.profileName` ("Opportunist / Role Model") | DTO + tabla 6 líneas | P0 |
| `humanDesign.themes.positive` ("Success") | DTO + mapping by type | P0 |
| `activatedGates[].isRetrograde` | DTO + Swiss Eph speed flag | P0 |
| `humanDesign.incarnationCross` | DTO + tabla canónica 192 crosses | P1 ✅ |
| `activatedGates[].fixingState` | DTO + tabla `(planet, gate, line)` (759 entries) | P1 ✅ |
| `activatedGates[].color` (1..6, sixth de la line) | DTO + cálculo astronómico | P2 ✅ |
| `activatedGates[].tone` (1..6, sixth del color) | DTO + cálculo astronómico | P2 ✅ |
| `activatedGates[].base` (1..5, fifth del tone) | DTO + cálculo astronómico | P2 ✅ |
| `humanDesign.design.*` + `humanDesign.personality.*` (Brain, Determination, Cognition, Environment, Motivation, Sense, Trajectory, View, Perspective, etc.) | DTO + Variable Wheel | P2 |

### 4.2 Capa 2 — visual

| Elemento | Bead |
|---|---|
| Endpoint `GET /api/me/bodygraph/pdf` con `pdfkit` + `svg-to-pdfkit` | Fase 4 ✅ |
| Botón "Descargar PDF" en `frontend/src/components/MyChartView.tsx` | Fase 5 ✅ |
| Arrows L/R en panel (Variable Configuration) | P3 |
| Triángulos de tone (▲/▽ numerados 1-6) | P3 |
| Markers retrograde (R) + fixing state (△/▽/✱) por planeta | P3 |
| Silueta humana lila de fondo | P3 (cosmético) |
| Header expandido: bloques "Design" + "Personality" + "Channels" en inglés | P3 |

---

## 5. Reglas de cambio para reviewers (IA o humano)

**Si tu PR cae en cualquiera de estos patrones, está mal**:

1. ❌ Importar `pdfkit`, `svg-to-pdfkit` o cualquier renderer PDF desde `calculate.ts` o `svg-geometry.ts`.
2. ❌ Hardcodear colores hex en `calculate.ts`.
3. ❌ Calcular nombres de profile / incarnation cross / variables dentro de `render-svg.ts`.
4. ❌ Pasar `birth` como argumento separado al renderer (debe vivir en `profile.birthData`).
5. ❌ Recalcular activación / retrograde / fixing en el renderer (todo viene resuelto del DTO).
6. ❌ Duplicar la lista de 36 canales fuera de `hd-channels.ts`.
7. ❌ Duplicar la posición de un gate fuera de `svg-geometry.ts`.
8. ❌ Mezclar lookup tables HD con shapes SVG en el mismo módulo.

**Tests obligatorios para cualquier cambio**:

- `cd backend && npx tsc --noEmit` verde.
- `cd backend && npx vitest run` verde (mínimo `bodygraph-calculate.test.ts` + `bodygraph-render-svg.test.ts`).
- Cualquier campo nuevo del DTO necesita test contra ground truth de Agos o Brian.

---

## 6. Tasks (beads hijos de `astral-jrf`)

Ver `bd show astral-jrf` para el bead padre. Tree completo: `bd dep tree astral-jrf`.

### Reference
- **`astral-vf1`** *(closed)* — Bead inicial que creó este doc. Cerrado tras la creación; este archivo es la referencia viva — cada bead hijo lo mantiene actualizado al cerrar.

### P0 — Esencial (≤2h, sin tablas externas grandes)
- **`astral-ffm`** — birthData expandido + typeQualifier + profileName + themes.positive + retrograde + designDate.

### P1 — Tablas canónicas medianas (3-4h)
- **`astral-aqa`** — Incarnation Cross (tabla ~192 crosses). Depende: `astral-ffm`.
- **`astral-13j`** — Fixing state (Exalted/Detriment/Juxtaposed) por planeta. Depende: `astral-ffm`.

### P2 — Variables avanzadas (6-8h, requiere extender astronomía)
- **`astral-hjx`** — Tones (subdivisión line/6) en activatedGates.
- **`astral-7w2`** — Variable Wheel (Brain/Determination/Cognition/Environment/Motivation/Sense/Trajectory/View). Depende: `astral-hjx`.

### P3 — Visual nice-to-haves (4-5h)
- **`astral-upn`** — Arrows L/R Variable Configuration. Depende: `astral-7w2`.
- **`astral-cle`** — Triángulos de tone (▲/▽ numerados). Depende: `astral-hjx`.
- **`astral-lor`** — Markers retrograde + fixing state en panel. Depende: `astral-ffm`, `astral-13j`.
- **`astral-56r`** — Silueta humana lila (cosmético, sin deps).
- **`astral-8ke`** — Header expandido (Identity + Design + Personality + Channels en inglés). Depende: `astral-ffm`, `astral-aqa`, `astral-7w2`.

### Fases originalmente parte de `astral-jrf`, ahora beads cerrados
- **`astral-ur2`** — Endpoint PDF del bodygraph. Implementación actual: `GET /api/me/bodygraph/pdf` vía `pdfkit` + `svg-to-pdfkit`.
- **`astral-kn0`** — Botón Descargar PDF, migrado al flujo actual de `frontend/src/components/MyChartView.tsx`.

### Orden de ejecución recomendado

```
arch (vf1)  →  P0 (ffm)  ─┬→  P1.1 (aqa)  ─┐
                          ├→  P1.2 (13j)   │
                          └→  PDF (ur2)  ──┼→  Frontend (kn0)
                                           │
P2.1 (hjx)  →  P2.2 (7w2) ──┬→  P3 arrows (upn)
                            └→  P3 header (8ke)
P2.1 (hjx)  ───────────────→  P3 triangles (cle)
P0 + P1.2  ────────────────→  P3 markers (lor)
(no deps)  ────────────────→  P3 silueta (56r)
```
