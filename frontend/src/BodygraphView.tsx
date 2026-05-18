/**
 * BodygraphView — visualización responsive del Foundation Chart.
 *
 * El bodygraph SVG (chart-only) viene del backend (renderBodygraphSvg en
 * /api/bodygraph/preview-svg?mode=chart). El resto (header + paneles de
 * planetas + tone groups + footer con Diseño/Personalidad/Canales) se
 * renderea en HTML responsive con CSS Grid + media queries.
 *
 * Mobile (< 768px): stack vertical — header → chart → panels → tone groups → footer.
 * Desktop (>= 768px): 3-col grid — design panel | chart | personality panel.
 */
import { useEffect, useMemo, useState } from "react";
import "./BodygraphView.css";

// ─── Shared types (subset of backend UserProfile) ───────────────────────────

interface HdVariable {
  orientation: "left" | "right";
  color: number;
  tone: number;
  base: number;
}

interface VariableLabels {
  brain: string;
  determination: string;
  determinationCategory: string;
  cognition: string;
  environment: string;
  environmentDetail: string;
  environmentStyle: string;
  personality: string;
  motivation: string;
  sense: string;
  trajectory: string;
  viewPerspective: string;
  view: string;
  transferredMotivation: string;
  transferredView: string;
}

interface ActivatedGate {
  number: number;
  line: number;
  planet: string;
  isPersonality: boolean;
  isRetrograde?: boolean;
  fixingState?: "exalted" | "detriment" | null;
  color?: number;
  tone?: number;
  base?: number;
}

interface Channel {
  id: string;
  name: string;
  nameEn?: string;
}

interface BodygraphProfile {
  name: string;
  birthData?: {
    dateLocalIso: string;
    dateUtcIso: string;
    placeLabel?: string;
    coordinates?: { lat: number; lon: number };
    ageYears: number;
  };
  humanDesign: {
    type: string;
    typeQualifier?: string;
    strategy: string;
    authority: string;
    profile: string;
    profileName?: string;
    definition: string;
    incarnationCross: string;
    themes?: { positive: string; notSelf: string };
    notSelfTheme: string;
    design?: { date: string };
    variables?: {
      digestion: HdVariable;
      awareness: HdVariable;
      environment: HdVariable;
      perspective: HdVariable;
    };
    variableLabels?: VariableLabels;
    channels: Channel[];
    activatedGates: ActivatedGate[];
    definedCenters: string[];
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_SHORT_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function formatBirthIso(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  if (!datePart || !timePart) return iso;
  const [y, m, d] = datePart.split("-").map(Number);
  const hhmm = timePart.substring(0, 5);
  return `${d} ${MONTH_SHORT_ES[m - 1]} ${y} ${hhmm}`;
}

function formatDesignDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTH_SHORT_ES[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

function padGateId(id: string): string {
  const [a, b] = id.split("-").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) return id;
  return String(a).padStart(2, "0") + String(b).padStart(2, "0");
}

/** Strip "Canal de la / del / de " prefix to get the short Spanish channel name. */
function stripChannelPrefix(name: string): string {
  return name
    .replace(/^Canal de la /, "")
    .replace(/^Canal del /, "")
    .replace(/^Canal de /, "");
}

// Planet glyphs (Unicode chars). Same order as the SVG renderer.
const PLANET_GLYPHS: Record<string, string> = {
  Sun: "☉",
  Earth: "⊕",
  "North Node": "☊",
  "South Node": "☋",
  Moon: "☾",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
};

const PLANET_ORDER: ReadonlyArray<string> = [
  "Sun", "Earth", "North Node", "South Node", "Moon", "Mercury", "Venus",
  "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function HeaderBlock({ profile }: { profile: BodygraphProfile }) {
  const hd = profile.humanDesign;
  const birth = profile.birthData;
  const typeDisplay = hd.typeQualifier ? `${hd.typeQualifier} ${hd.type}` : hd.type;
  return (
    <header className="bg-header">
      <h2 className="bg-title">
        {(profile.name || "Bodygraph") + (typeDisplay ? ` — ${typeDisplay}` : "")}
      </h2>
      <dl className="bg-header-meta">
        {birth?.dateLocalIso && (
          <>
            <dt>Nacimiento (local)</dt>
            <dd>{formatBirthIso(birth.dateLocalIso)}</dd>
          </>
        )}
        {birth?.dateUtcIso && (
          <>
            <dt>Nacimiento (UTC)</dt>
            <dd>{formatBirthIso(birth.dateUtcIso)}</dd>
          </>
        )}
        {birth?.placeLabel && (
          <>
            <dt>Lugar</dt>
            <dd>{birth.placeLabel}</dd>
          </>
        )}
        {birth?.coordinates && (
          <>
            <dt>Coordenadas</dt>
            <dd>{birth.coordinates.lat}, {birth.coordinates.lon}</dd>
          </>
        )}
        {birth?.ageYears !== undefined && birth.ageYears > 0 && (
          <>
            <dt>Edad</dt>
            <dd>{birth.ageYears} años</dd>
          </>
        )}
        <dt>Perfil</dt>
        <dd>{hd.profileName ? `${hd.profile} — ${hd.profileName}` : hd.profile}</dd>
        <dt>Autoridad</dt>
        <dd>{hd.authority || "—"}</dd>
        <dt>Definición</dt>
        <dd>{hd.definition || "—"}</dd>
        <dt>Estrategia</dt>
        <dd>{hd.strategy || "—"}</dd>
        <dt>Temas</dt>
        <dd>{hd.themes ? `${hd.themes.positive} / ${hd.themes.notSelf}` : hd.notSelfTheme || "—"}</dd>
        <dt>Cruz de Encarnación</dt>
        <dd>{hd.incarnationCross || "—"}</dd>
      </dl>
    </header>
  );
}

function PlanetPanel({
  profile,
  side,
}: {
  profile: BodygraphProfile;
  side: "design" | "personality";
}) {
  const isPersonality = side === "personality";
  const rows = PLANET_ORDER.map((planet) => {
    const gate = profile.humanDesign.activatedGates.find(
      (g) => g.planet === planet && g.isPersonality === isPersonality,
    );
    return { planet, gate };
  });
  return (
    <aside className={`bg-panel bg-panel-${side}`}>
      <h3 className="bg-panel-title">{side === "design" ? "Diseño" : "Personalidad"}</h3>
      <ul className="bg-planet-list">
        {rows.map(({ planet, gate }) => (
          <li key={`${side}-${planet}`} className="bg-planet-row">
            <span className="bg-planet-glyph">{PLANET_GLYPHS[planet] || "·"}</span>
            {gate?.fixingState === "exalted" && (
              <span className="bg-fix bg-fix-exalted" aria-label="exalted">▲</span>
            )}
            {gate?.fixingState === "detriment" && (
              <span className="bg-fix bg-fix-detriment" aria-label="detriment">▽</span>
            )}
            <span className="bg-planet-gate">{gate ? `${gate.number}.${gate.line}` : "—"}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ToneGroup({
  variable,
  side,
  label,
}: {
  variable: HdVariable;
  side: "design" | "personality";
  label: string;
}) {
  // Universal: green = tone, yellow = color. Design ▲green▽yellow, Personality inverted.
  const upIsGreen = side === "design";
  const upValue = upIsGreen ? variable.tone : variable.color;
  const downValue = upIsGreen ? variable.color : variable.tone;
  const upClass = upIsGreen ? "bg-tri bg-tri-green" : "bg-tri bg-tri-yellow";
  const downClass = upIsGreen ? "bg-tri bg-tri-yellow" : "bg-tri bg-tri-green";
  return (
    <div className={`bg-tone-group bg-tone-${side}`}>
      <span className="bg-tone-label">{label}</span>
      <span className={`bg-arrow bg-arrow-${variable.orientation}`}>
        {variable.orientation === "left" ? "◀" : "▶"}
        <span className="bg-arrow-letter">{variable.orientation === "left" ? "L" : "R"}</span>
      </span>
      <span className={upClass}>▲{upValue}</span>
      <span className={downClass}>▽{downValue}</span>
    </div>
  );
}

function ToneGroupsBlock({ profile }: { profile: BodygraphProfile }) {
  const v = profile.humanDesign.variables;
  if (!v) return null;
  return (
    <section className="bg-tone-groups">
      <ToneGroup variable={v.digestion} side="design" label="Diseño Sol/Tierra" />
      <ToneGroup variable={v.environment} side="design" label="Diseño Nodos" />
      <ToneGroup variable={v.awareness} side="personality" label="Personalidad Sol/Tierra" />
      <ToneGroup variable={v.perspective} side="personality" label="Personalidad Nodos" />
    </section>
  );
}

function FooterBlock({ profile }: { profile: BodygraphProfile }) {
  const hd = profile.humanDesign;
  const labels = hd.variableLabels;
  if (!labels) return null;
  const designRows: Array<[string, string]> = [];
  if (hd.design?.date) {
    designRows.push(["Fecha del Diseño", formatDesignDate(hd.design.date)]);
  }
  designRows.push(
    ["Cerebro", labels.brain],
    ["Determinación", labels.determination],
    ["Cognición", labels.cognition],
    ["Ambiente", labels.environmentDetail],
    ["Estilo de Ambiente", labels.environmentStyle],
  );
  const personalityRows: Array<[string, string]> = [
    ["Personalidad", labels.personality],
    ["Motivación", labels.motivation],
    ["Sentido", labels.sense],
    ["Trayectoria", labels.trajectory],
    ["Perspectiva", labels.viewPerspective],
    ["Visión", labels.view],
    ["Motivación Transferida", labels.transferredMotivation],
    ["Visión Transferida", labels.transferredView],
  ];
  return (
    <footer className="bg-footer">
      <div className="bg-footer-col">
        <h3 className="bg-footer-title">Diseño</h3>
        <dl className="bg-footer-list">
          {designRows.map(([k, v]) => (
            <div key={`d-${k}`}>
              <dt>{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-footer-col">
        <h3 className="bg-footer-title">Personalidad</h3>
        <dl className="bg-footer-list">
          {personalityRows.map(([k, v]) => (
            <div key={`p-${k}`}>
              <dt>{k}</dt>
              <dd>{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="bg-footer-col">
        <h3 className="bg-footer-title">Canales</h3>
        <ul className="bg-channel-list">
          {hd.channels.map((ch) => (
            <li key={ch.id}>
              <strong>{padGateId(ch.id)}</strong> — {stripChannelPrefix(ch.name)}
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

export default function BodygraphView({
  profile,
  birthQuery,
}: {
  profile: BodygraphProfile;
  /** Query params to pass to the chart SVG endpoint. */
  birthQuery: { date: string; time: string; tz: number };
}) {
  const [chartSvg, setChartSvg] = useState<string | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  const chartUrl = useMemo(() => {
    const params = new URLSearchParams({
      date: birthQuery.date,
      time: birthQuery.time,
      timezoneOffsetHours: String(birthQuery.tz),
      mode: "chart",
      width: "800",
    });
    return `/api/bodygraph/preview-svg?${params.toString()}`;
  }, [birthQuery.date, birthQuery.time, birthQuery.tz]);

  useEffect(() => {
    let cancelled = false;
    setChartSvg(null);
    setChartError(null);
    fetch(chartUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setChartSvg(text);
      })
      .catch((err) => {
        if (!cancelled) setChartError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [chartUrl]);

  return (
    <article className="bg-view">
      <HeaderBlock profile={profile} />
      <div className="bg-body">
        <PlanetPanel profile={profile} side="design" />
        <div className="bg-chart">
          {chartSvg ? (
            <div
              className="bg-chart-svg"
              // dangerouslySetInnerHTML is safe here: SVG comes from our own
              // backend, no user input renders into it.
              dangerouslySetInnerHTML={{ __html: chartSvg }}
            />
          ) : chartError ? (
            <div className="bg-chart-error">No se pudo cargar el chart: {chartError}</div>
          ) : (
            <div className="bg-chart-loading">Generando bodygraph…</div>
          )}
        </div>
        <PlanetPanel profile={profile} side="personality" />
      </div>
      <ToneGroupsBlock profile={profile} />
      <FooterBlock profile={profile} />
    </article>
  );
}
