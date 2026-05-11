import { CENTER_DISPLAY } from "../utils";
import type { UserProfile } from "../types";
import type {
  BodygraphSnapshot,
  TransitAskAgentPayload,
  TransitCenterDefinitionFact,
  TransitCenterFact,
  TransitCenterGroupModel,
  TransitExperienceResponse,
  TransitImpactSectionModel,
  TransitPlanetDetailModel,
  TransitScreenModel,
  TransitSnapshot,
} from "./types";

const PLANET_GLYPHS: Record<string, string> = {
  Sol: "☉",
  Luna: "☽",
  Mercurio: "☿",
  Venus: "♀",
  Marte: "♂",
  "Júpiter": "♃",
  Saturno: "♄",
  Urano: "♅",
  Neptuno: "♆",
  "Plutón": "♇",
  "Quirón": "⚷",
  "Nodo Norte": "☊",
  "Nodo Sur": "☋",
};

export function buildTransitScreenModel(
  response: TransitExperienceResponse,
  selectedSnapshotId = response.selectedSnapshotId,
  loadingState: TransitScreenModel["loadingState"] = "ready",
  userProfile?: UserProfile,
): TransitScreenModel {
  const selected = findSelectedSnapshot(response, selectedSnapshotId);
  const timelineSnapshots = response.snapshots.filter((snapshot) => snapshot.id.startsWith("hour:"));

  return {
    mode: response.mode,
    header: {
      title: "Tránsitos",
      rangeLabel: response.mode === "next7Days" ? "Próximos 7 días" : response.range.label,
      activeLabel: buildActiveLabel(response, selected),
      subtitle: buildSubtitle(response, selected),
      calculatedLabel: `Calculado ${formatDateTime(selected.calculatedAt, response.timeZone)}`,
    },
    selector: {
      options: [
        { mode: "today", label: "Hoy", selected: response.mode === "today" },
        { mode: "next7Days", label: "Próximos 7 días", selected: response.mode === "next7Days" },
      ],
    },
    timeline: response.mode === "today" && timelineSnapshots.length > 0
      ? {
          selectedSnapshotId: selected.id,
          snapshots: timelineSnapshots.map((snapshot) => ({
            id: snapshot.id,
            label: snapshot.label,
            targetAt: snapshot.targetAt,
          })),
        }
      : undefined,
    primaryInsight: buildPrimaryInsight(response, selected, timelineSnapshots),
    nextChange: buildNextChange(selected, timelineSnapshots, response.timeZone),
    dayKeyFacts: response.mode === "next7Days" ? response.dayKeyFacts : undefined,
    bodygraphSnapshot: buildBodygraphSnapshot(selected, userProfile),
    personalSections: buildPersonalSections(selected),
    centerGroups: buildCenterGroups(selected),
    planetDetails: buildPlanetDetails(selected),
    actions: {
      askAgent: buildAskAgentPayload(response, selected),
    },
    screenOrder: ["primaryInsight", "personalSections", "timeline", "centers", "planetDetails"],
    loadingState,
  };
}

function findSelectedSnapshot(
  response: TransitExperienceResponse,
  selectedSnapshotId: string,
): TransitSnapshot {
  return (
    response.snapshots.find((snapshot) => snapshot.id === selectedSnapshotId) ??
    response.snapshots.find((snapshot) => snapshot.id === response.selectedSnapshotId) ??
    response.snapshots[0]
  );
}

function buildActiveLabel(
  response: TransitExperienceResponse,
  snapshot: TransitSnapshot,
): string {
  if (response.mode === "next7Days") {
    return "Tema de la semana";
  }

  if (snapshot.label === "Ahora") {
    return `Ahora · ${formatTime(snapshot.targetAt, response.timeZone)}`;
  }

  return `A las ${snapshot.label}`;
}

function buildSubtitle(
  response: TransitExperienceResponse,
  snapshot: TransitSnapshot,
): string {
  if (response.mode === "next7Days") {
    return `${response.range.label} · panorama colectivo`;
  }

  return formatLongDate(snapshot.targetAt, response.timeZone);
}

function buildPrimaryInsight(
  response: TransitExperienceResponse,
  snapshot: TransitSnapshot,
  timelineSnapshots: TransitSnapshot[],
): TransitScreenModel["primaryInsight"] {
  const temporaryCenters = snapshot.personal?.temporarilyDefinedCenters.length
    ? snapshot.personal.temporarilyDefinedCenters
    : snapshot.collective.temporarilyDefinedCenters;
  const activatedCenters = snapshot.personal?.activatedCenters.length
    ? snapshot.personal.activatedCenters
    : snapshot.collective.activatedCenters;
  const personalChannels = snapshot.personal?.personalChannels ?? [];
  const temporaryNames = temporaryCenters.map((center) => center.displayName);
  const activatedNames = activatedCenters.map((center) => center.displayName);
  const title = buildPrimaryTitle({
    mode: response.mode,
    hasPersonal: Boolean(snapshot.personal),
    personalChannelsCount: personalChannels.length,
    temporaryNames,
    activatedNames,
  });
  const headlineDetail = buildHeadlineDetail({
    mode: response.mode,
    temporaryNames,
    activatedNames,
  });
  const body = response.mode === "next7Days"
    ? "Este panorama conserva una foto semántica del tránsito para leer el clima general sin prometer precisión diaria."
    : snapshot.personal
      ? buildTodayPersonalBody({
          personalChannelsCount: personalChannels.length,
          conditionedCount: snapshot.personal.conditionedCenters.length,
          reinforcedCount: snapshot.personal.reinforcedGates.length,
        })
      : "Lectura colectiva disponible: el tránsito está moviendo el clima general, sin lectura personalizada en esta sesión.";
  const pulseChannels = snapshot.collective.activatedChannels.map((channel) => ({
    id: channel.id,
    name: channel.name,
    centers: channel.centers.map(centerDisplayName).join(" + "),
  }));
  const pulseGates = snapshot.collective.activatedGates.slice(0, 6).map((gate) => ({
    id: gate.gate,
    label: `Puerta ${gate.gate}`,
  }));
  const supportingFacts = [
    ...pulseChannels.map((channel) => channel.name),
    ...pulseGates.map((gate) => gate.label),
  ];
  const attribution = buildAttribution(snapshot);
  const duration = buildDurationLabel(response.mode, snapshot, timelineSnapshots, response.timeZone);

  return {
    eyebrow: response.mode === "next7Days" ? "TEMA DE LA SEMANA" : "LO PRINCIPAL AHORA",
    title,
    body,
    headlineDetail,
    attribution,
    duration,
    pulseChannels,
    pulseGates,
    supportingFacts,
  };
}

function buildAttribution(snapshot: TransitSnapshot): string | undefined {
  const channels = snapshot.collective.activatedChannels;
  if (channels.length === 0) {
    return undefined;
  }

  const planetByGate = new Map<number, { planet: string; line: number }>();
  for (const planet of snapshot.collective.planets) {
    planetByGate.set(planet.hdGate, { planet: planet.name, line: planet.hdLine });
  }

  const firstChannel = channels[0];
  const [gateA, gateB] = firstChannel.gates;
  const planetA = planetByGate.get(gateA);
  const planetB = planetByGate.get(gateB);

  if (!planetA || !planetB) {
    return undefined;
  }

  return `Por ${planetA.planet} (${gateA}.${planetA.line}) y ${planetB.planet} (${gateB}.${planetB.line}) en el cielo.`;
}

function buildDurationLabel(
  mode: "today" | "next7Days",
  snapshot: TransitSnapshot,
  timelineSnapshots: TransitSnapshot[],
  timeZone: string,
): string | undefined {
  if (mode !== "today") return undefined;
  if (timelineSnapshots.length === 0) return undefined;

  const currentKey = snapshotKey(snapshot);
  if (!currentKey) return undefined;

  const selectedTime = Date.parse(snapshot.targetAt);
  if (!Number.isFinite(selectedTime)) return undefined;

  const futureSnapshots = timelineSnapshots.filter(
    (s) => Date.parse(s.targetAt) > selectedTime,
  );

  if (futureSnapshots.length === 0) {
    return undefined;
  }

  const firstChange = futureSnapshots.find((s) => snapshotKey(s) !== currentKey);

  if (!firstChange) {
    return "Estable durante el resto del día.";
  }

  return `Hasta las ${formatTime(firstChange.targetAt, timeZone)} de hoy.`;
}

function buildNextChange(
  selected: TransitSnapshot,
  timelineSnapshots: TransitSnapshot[],
  timeZone: string,
): TransitScreenModel["nextChange"] {
  if (timelineSnapshots.length === 0) return undefined;

  const selectedTime = Date.parse(selected.targetAt);
  if (!Number.isFinite(selectedTime)) return undefined;

  const currentKey = snapshotKey(selected);
  if (!currentKey) return undefined;

  const future = timelineSnapshots.filter(
    (s) => Date.parse(s.targetAt) > selectedTime,
  );

  let firstChange: { snapshot: TransitSnapshot; previous: TransitSnapshot } | undefined;
  let previous = selected;
  for (const candidate of future) {
    if (snapshotKey(candidate) !== snapshotKey(previous)) {
      firstChange = { snapshot: candidate, previous };
      break;
    }
    previous = candidate;
  }

  if (!firstChange) return undefined;

  const summary = describeChange(firstChange.previous, firstChange.snapshot);
  if (!summary) return undefined;

  return {
    kicker: "PRÓXIMO CAMBIO",
    atLabel: formatTime(firstChange.snapshot.targetAt, timeZone),
    summary,
    atTargetIso: firstChange.snapshot.targetAt,
  };
}

function snapshotKey(snapshot: TransitSnapshot): string | undefined {
  const tempIds = snapshot.collective.temporarilyDefinedCenters
    .map((center) => center.id)
    .sort()
    .join(",");
  const channelIds = snapshot.collective.activatedChannels
    .map((channel) => channel.id)
    .sort()
    .join(",");
  return `temp:${tempIds}|channels:${channelIds}`;
}

function describeChange(previous: TransitSnapshot, next: TransitSnapshot): string | undefined {
  const prevTemp = new Set(previous.collective.temporarilyDefinedCenters.map((c) => c.id));
  const nextTemp = new Set(next.collective.temporarilyDefinedCenters.map((c) => c.id));
  const prevChannels = new Set(previous.collective.activatedChannels.map((c) => c.id));
  const nextChannels = new Set(next.collective.activatedChannels.map((c) => c.id));

  const enteringCenters = next.collective.temporarilyDefinedCenters
    .filter((c) => !prevTemp.has(c.id))
    .map((c) => c.displayName);
  const leavingCenters = previous.collective.temporarilyDefinedCenters
    .filter((c) => !nextTemp.has(c.id))
    .map((c) => c.displayName);
  const openingChannels = next.collective.activatedChannels
    .filter((c) => !prevChannels.has(c.id))
    .map((c) => c.name);
  const closingChannels = previous.collective.activatedChannels
    .filter((c) => !nextChannels.has(c.id))
    .map((c) => c.name);

  if (openingChannels.length > 0) {
    return `Se abre ${openingChannels[0]}.`;
  }
  if (closingChannels.length > 0) {
    return `Se cierra ${closingChannels[0]}.`;
  }
  if (enteringCenters.length > 0) {
    return `${enteringCenters[0]} entra en definición temporal.`;
  }
  if (leavingCenters.length > 0) {
    return `${leavingCenters[0]} vuelve a indefinición.`;
  }
  return undefined;
}

function buildPrimaryTitle({
  mode,
  hasPersonal,
  personalChannelsCount,
  temporaryNames,
  activatedNames,
}: {
  mode: "today" | "next7Days";
  hasPersonal: boolean;
  personalChannelsCount: number;
  temporaryNames: string[];
  activatedNames: string[];
}): string {
  if (mode === "next7Days") {
    if (temporaryNames.length) return "Una semana con definición sostenida";
    if (activatedNames.length) return "Una semana con activaciones marcadas";
    return "Una semana de clima sutil";
  }

  if (!hasPersonal) {
    if (temporaryNames.length) return "Hay canales completos en el aire";
    if (activatedNames.length) return "El cielo está activando puertas";
    return "Un momento de quietud en el cielo";
  }

  if (personalChannelsCount > 0) {
    return personalChannelsCount === 1
      ? "Un canal tuyo se está completando ahora"
      : "Varios canales tuyos se están completando";
  }

  if (temporaryNames.length) {
    return temporaryNames.length === 1
      ? `Tu ${temporaryNames[0]} entra en definición temporal`
      : "Hay centros que se definen temporalmente";
  }

  if (activatedNames.length) {
    return "Hay puertas activas tocando tu diseño";
  }

  return "Un momento de baja densidad energética";
}

function buildHeadlineDetail({
  mode,
  temporaryNames,
  activatedNames,
}: {
  mode: "today" | "next7Days";
  temporaryNames: string[];
  activatedNames: string[];
}): string | undefined {
  if (mode === "next7Days") {
    if (!temporaryNames.length && !activatedNames.length) return undefined;
    if (temporaryNames.length) {
      return `${joinLabels(temporaryNames)} sostienen el tema de la semana.`;
    }
    return `${joinLabels(activatedNames)} en juego durante la semana.`;
  }

  if (temporaryNames.length) {
    return `${joinLabels(temporaryNames)} ${temporaryNames.length === 1 ? "queda" : "quedan"} unidos por canales temporales.`;
  }

  if (activatedNames.length) {
    return `${joinLabels(activatedNames)} reciben activación.`;
  }

  return undefined;
}

function buildTodayPersonalBody({
  personalChannelsCount,
  conditionedCount,
  reinforcedCount,
}: {
  personalChannelsCount: number;
  conditionedCount: number;
  reinforcedCount: number;
}): string {
  const parts: string[] = [];
  if (personalChannelsCount > 0) {
    parts.push(
      personalChannelsCount === 1
        ? "Un tránsito completa algo de tu diseño"
        : `${personalChannelsCount} tránsitos completan canales tuyos`,
    );
  }
  if (conditionedCount > 0) {
    parts.push(
      conditionedCount === 1
        ? "un centro indefinido recibe presión"
        : `${conditionedCount} centros indefinidos reciben presión`,
    );
  }
  if (reinforcedCount > 0) {
    parts.push(
      reinforcedCount === 1
        ? "una puerta tuya se refuerza"
        : `${reinforcedCount} puertas tuyas se refuerzan`,
    );
  }

  if (parts.length === 0) {
    return "El cielo de hoy te toca de forma sutil: sin canales completos, sin presión clara en centros indefinidos.";
  }

  return `${capitalize(parts.join(", "))}.`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPersonalSections(snapshot: TransitSnapshot): TransitImpactSectionModel[] {
  if (!snapshot.personal) {
    return [];
  }

  const sections: TransitImpactSectionModel[] = [];

  if (snapshot.personal.personalChannels.length > 0) {
    sections.push({
      id: "personal-channels",
      kind: "temporaryChannel",
      title: "Cómo te toca",
      subtitle: "Un tránsito completa algo de tu diseño.",
      items: snapshot.personal.personalChannels.map((channel) => ({
        id: `${channel.channelId}-${channel.transitPlanet}`,
        eyebrow: "CANAL TEMPORAL",
        title: channel.channelName,
        body: `Tu Puerta ${channel.userGate} se encuentra con ${channel.transitPlanet} en Puerta ${channel.transitGate}.`,
        meta: `${channel.centers.map(centerDisplayName).join(" + ")} · ${channel.channelId}`,
      })),
    });
  }

  if (snapshot.personal.conditionedCenters.length > 0) {
    sections.push({
      id: "conditioned-centers",
      kind: "conditionedCenter",
      title: "Centros condicionados",
      subtitle: "Tránsitos tocando centros indefinidos.",
      items: snapshot.personal.conditionedCenters.map((center) => ({
        id: center.center,
        eyebrow: "CONDICIONAMIENTO",
        title: center.displayName,
        body: center.gates.map((gate) => `${gate.planet} en Puerta ${gate.gate}`).join(", "),
        meta: "No es definición permanente.",
      })),
    });
  }

  if (snapshot.personal.reinforcedGates.length > 0) {
    sections.push({
      id: "reinforced-gates",
      kind: "reinforcedGate",
      title: "Puertas reforzadas",
      subtitle: "El tránsito toca puertas que ya tenés activas.",
      items: snapshot.personal.reinforcedGates.map((gate) => ({
        id: `${gate.gate}-${gate.planet}`,
        eyebrow: "REFUERZO",
        title: `Puerta ${gate.gate}`,
        body: `${gate.planet} refuerza una puerta de tu diseño.`,
        meta: centerDisplayName(gate.center),
      })),
    });
  }

  if (snapshot.personal.educationalChannels.length > 0) {
    sections.push({
      id: "educational-channels",
      kind: "educationalChannel",
      title: "Canales colectivos",
      subtitle: "Canales completos por tránsito, útiles como clima educativo.",
      items: snapshot.personal.educationalChannels.map((channel) => ({
        id: channel.channelId,
        eyebrow: "CLIMA COLECTIVO",
        title: channel.channelName,
        body: `${channel.planet1} y ${channel.planet2} completan este canal en el tránsito.`,
        meta: `${channel.centers.map(centerDisplayName).join(" + ")} · ${channel.channelId}`,
      })),
    });
  }

  return sections;
}

function buildCenterGroups(snapshot: TransitSnapshot): TransitCenterGroupModel[] {
  const temporary = snapshot.personal?.temporarilyDefinedCenters.length
    ? snapshot.personal.temporarilyDefinedCenters
    : snapshot.collective.temporarilyDefinedCenters;
  const conditioned = snapshot.personal?.conditionedCenters ?? [];
  const activated = snapshot.personal?.activatedCenters.length
    ? snapshot.personal.activatedCenters
    : snapshot.collective.activatedCenters;

  const groups: TransitCenterGroupModel[] = [
    {
      kind: "temporarilyDefined",
      label: "Definidos temporalmente",
      centers: mapDefinitionCenters(temporary),
    },
    {
      kind: "conditioned",
      label: "Condicionados",
      centers: conditioned.map((center) => ({
        id: center.center,
        displayName: center.displayName,
        sourceIds: center.gates.map((gate) => String(gate.gate)),
      })),
    },
    {
      kind: "activated",
      label: "Activados",
      centers: mapActivatedCenters(activated),
    },
  ];

  return groups.filter((group) => group.centers.length > 0);
}

function mapDefinitionCenters(
  centers: TransitCenterDefinitionFact[],
): TransitCenterGroupModel["centers"] {
  return centers.map((center) => ({
    id: center.id,
    displayName: center.displayName,
    sourceIds: center.channels.map((channel) => channel.id),
  }));
}

function mapActivatedCenters(
  centers: TransitCenterFact[],
): TransitCenterGroupModel["centers"] {
  return centers.map((center) => ({
    id: center.id,
    displayName: center.displayName,
    sourceIds: [...center.gates.map(String), ...center.channels],
  }));
}

function buildPlanetDetails(snapshot: TransitSnapshot): TransitPlanetDetailModel[] {
  return snapshot.collective.planets.map((planet) => ({
    id: planet.name,
    name: planet.name,
    glyph: PLANET_GLYPHS[planet.name] ?? "•",
    sign: planet.sign,
    degree: planet.degree,
    isRetrograde: planet.isRetrograde,
    hdGate: planet.hdGate,
    hdLine: planet.hdLine,
  }));
}

function buildAskAgentPayload(
  response: TransitExperienceResponse,
  snapshot: TransitSnapshot,
): TransitAskAgentPayload {
  const source = response.mode === "next7Days"
    ? "weekly"
    : snapshot.label === "Ahora"
      ? "now"
      : "selectedTime";
  const prefill = response.mode === "next7Days"
    ? "¿Cómo puedo usar el panorama de tránsitos de los próximos 7 días en mis decisiones?"
    : `¿Cómo me afecta este tránsito de ${snapshot.label === "Ahora" ? "ahora" : `las ${snapshot.label}`}?`;

  return {
    source,
    mode: response.mode,
    snapshotId: snapshot.id,
    targetAt: snapshot.targetAt,
    timeZone: response.timeZone,
    prefill,
  };
}

function centerDisplayName(center: string): string {
  return CENTER_DISPLAY[center] ?? center;
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels.slice(0, 2).join(" + ")} + ${labels.length - 2} más`;
}

function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function formatLongDate(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function formatDateTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

function buildBodygraphSnapshot(
  snapshot: TransitSnapshot,
  userProfile?: UserProfile,
): BodygraphSnapshot {
  const userDefinedCenters = userProfile?.humanDesign?.definedCenters ?? [];
  const userActivatedGates =
    userProfile?.humanDesign?.activatedGates?.map((gate) => gate.number) ?? [];

  const transitActivatedCenters = snapshot.collective.activatedCenters.map((center) => center.id);
  const transitConditionedCenters =
    snapshot.personal?.conditionedCenters.map((center) => center.center) ?? [];
  const temporarilyDefinedCenters = (
    snapshot.personal?.temporarilyDefinedCenters.length
      ? snapshot.personal.temporarilyDefinedCenters
      : snapshot.collective.temporarilyDefinedCenters
  ).map((center) => center.id);

  const activatedChannels = snapshot.collective.activatedChannels.map((channel) => ({ id: channel.id }));
  const temporarilyDefinedChannels = (
    snapshot.personal?.temporarilyDefinedCenters.length
      ? snapshot.personal.temporarilyDefinedCenters.flatMap((center) => center.channels)
      : snapshot.collective.temporarilyDefinedCenters.flatMap((center) => center.channels)
  ).map((channel) => ({ id: channel.id }));
  const personalChannels =
    snapshot.personal?.personalChannels.map((channel) => ({ id: channel.channelId })) ?? [];

  return {
    userDefinedCenters,
    userActivatedGates,
    transitActivatedCenters,
    transitConditionedCenters,
    temporarilyDefinedCenters,
    activatedChannels,
    temporarilyDefinedChannels,
    personalChannels,
  };
}
