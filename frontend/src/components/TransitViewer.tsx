import { useState } from "react";
import { getGateTheme } from "../hd-data";
import { BodygraphLive } from "./BodygraphLive";
import type {
  DayKeyFact,
  TransitAskAgentPayload,
  TransitCenterGroupModel,
  TransitImpactCardModel,
  TransitImpactSectionModel,
  TransitMode,
  TransitPlanetDetailModel,
  TransitScreenModel,
} from "../transits/types";

interface Props {
  model: TransitScreenModel;
  error?: string | null;
  onModeChange: (mode: TransitMode) => void;
  onTimeSelect: (snapshotId: string) => void;
  onTimeNow: () => void;
  onRefresh: () => void;
  onAskAgent?: (payload: TransitAskAgentPayload) => void;
  onOpenMap?: () => void;
}

export function TransitViewer({
  model,
  error,
  onModeChange,
  onTimeSelect,
  onTimeNow,
  onRefresh,
  onAskAgent,
  onOpenMap,
}: Props) {
  const [expandedPlanet, setExpandedPlanet] = useState<string | null>(null);
  const [showAllPlanets, setShowAllPlanets] = useState(false);
  const [showAllActivated, setShowAllActivated] = useState(false);

  const timelineIndex = model.timeline
    ? resolveTimelineIndex(
        model.timeline.snapshots,
        model.timeline.selectedSnapshotId,
        model.actions.askAgent.targetAt,
      )
    : 0;

  const isSelectedHour = model.actions.askAgent.source === "selectedTime";
  const pulseChannels = model.primaryInsight.pulseChannels ?? [];
  const pulseGates = model.primaryInsight.pulseGates ?? [];

  return (
    <div
      className="animate-fade-in-slow transit-screen"
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "16px 16px 32px",
        overflowY: "auto",
        flex: 1,
        width: "100%",
        minWidth: 0,
      }}
    >
      <div className="page-header">
        <div className="page-header-kicker">{model.header.rangeLabel}</div>
        <h2 className="page-header-title">{model.header.title}</h2>
        <p className="page-header-description">
          {model.header.activeLabel} · {model.header.subtitle}
        </p>
      </div>

      {/*
        Bodygraph miniature + "Ver mapa" entry to the L2 map view.
        Hidden for now while we iterate on the bodygraph rendering. The
        underlying components (BodygraphLive, TransitMapView) and the
        bodygraphSnapshot model field stay live so we can re-enable this
        once the visual treatment is finalized.

        {model.bodygraphSnapshot && onOpenMap && (
          <button
            type="button"
            className="transit-hero-bodygraph"
            onClick={onOpenMap}
            aria-label="Ver mapa del momento"
          >
            <BodygraphLive
              variant="miniature"
              userDefinedCenters={model.bodygraphSnapshot.userDefinedCenters}
              userActivatedGates={model.bodygraphSnapshot.userActivatedGates}
              transitActivatedCenters={model.bodygraphSnapshot.transitActivatedCenters}
              transitConditionedCenters={model.bodygraphSnapshot.transitConditionedCenters}
              temporarilyDefinedCenters={model.bodygraphSnapshot.temporarilyDefinedCenters}
              activatedChannels={model.bodygraphSnapshot.activatedChannels}
              temporarilyDefinedChannels={model.bodygraphSnapshot.temporarilyDefinedChannels}
              personalChannels={model.bodygraphSnapshot.personalChannels}
              ariaLabel="Miniatura del bodygraph del momento"
            />
            <span className="transit-hero-bodygraph-label">Ver mapa</span>
          </button>
        )}
      */}

      <div className="transit-controls">
        <div
          role="group"
          aria-label="Rango de tránsitos"
          className="transit-segmented"
        >
          {model.selector.options.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => onModeChange(option.mode)}
              aria-pressed={option.selected}
              className={`transit-segmented-option${option.selected ? " is-selected" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="transit-controls-actions">
          {model.mode === "today" && (
            <button
              type="button"
              onClick={onTimeNow}
              className={`transit-now-chip${isSelectedHour ? " is-active" : ""}`}
              aria-pressed={!isSelectedHour}
            >
              <span aria-hidden="true" className="transit-now-dot" />
              Ahora
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="transit-icon-button"
            aria-label="Actualizar tránsitos"
            title="Actualizar"
          >
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel transit-error" role="alert">
          {error}
        </div>
      )}

      {model.loadingState === "refreshing" && (
        <div className="transit-refreshing">Actualizando lectura…</div>
      )}

      <section className="glass-panel-gold transit-insight">
        <div className="transit-insight-kicker">{model.primaryInsight.eyebrow}</div>
        <h3 className="transit-insight-title">{model.primaryInsight.title}</h3>
        {model.primaryInsight.headlineDetail && (
          <p className="transit-insight-detail">{model.primaryInsight.headlineDetail}</p>
        )}
        {(model.primaryInsight.attribution || model.primaryInsight.duration) && (
          <p className="transit-insight-microcopy">
            {model.primaryInsight.attribution && (
              <span className="transit-insight-attribution">
                {model.primaryInsight.attribution}
              </span>
            )}
            {model.primaryInsight.duration && (
              <span className="transit-insight-duration">
                {model.primaryInsight.duration}
              </span>
            )}
          </p>
        )}
        <p className="transit-insight-body">{model.primaryInsight.body}</p>
        {(pulseChannels.length > 0 || pulseGates.length > 0) && (
          <div className="transit-insight-pulse">
            {pulseChannels.length > 0 && (
              <ul className="transit-insight-channels" aria-label="Canales activos">
                {pulseChannels.map((channel) => (
                  <li key={channel.id} className="transit-insight-channel">
                    <span className="transit-insight-channel-name">{channel.name}</span>
                    {channel.centers && (
                      <span className="transit-insight-channel-meta">{channel.centers}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {pulseGates.length > 0 && (
              <ul className="transit-insight-gates" aria-label="Puertas activadas">
                {pulseGates.map((gate) => (
                  <li key={gate.id} className="transit-insight-gate">
                    {gate.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {model.nextChange && (
        <section className="transit-next-change" aria-label="Próximo cambio del día">
          <div className="transit-next-change-kicker">{model.nextChange.kicker}</div>
          <div className="transit-next-change-row">
            <span className="transit-next-change-time">{model.nextChange.atLabel}</span>
            <span className="transit-next-change-summary">{model.nextChange.summary}</span>
          </div>
        </section>
      )}

      {model.dayKeyFacts && model.dayKeyFacts.length > 0 && (
        <DayKeyFactsSection facts={model.dayKeyFacts} />
      )}

      {model.personalSections.map((section) => (
        <ImpactSection key={section.id} section={section} />
      ))}

      {model.timeline && (
        <TimelineSection
          activeLabel={model.header.activeLabel}
          isSelectedHour={isSelectedHour}
          snapshots={model.timeline.snapshots}
          selectedIndex={timelineIndex}
          onTimeSelect={onTimeSelect}
          onTimeNow={onTimeNow}
        />
      )}

      {model.centerGroups.length > 0 && (
        <CentersSection
          groups={model.centerGroups}
          showAllActivated={showAllActivated}
          onToggleAllActivated={() => setShowAllActivated((prev) => !prev)}
        />
      )}

      <section className="glass-panel transit-panel">
        <div className="transit-panel-kicker">DETALLE PLANETARIO</div>
        <p className="transit-panel-sub">
          {model.planetDetails.length} cuerpos en este momento. Cada uno está cayendo en una puerta y línea HD.
        </p>
        <div className="transit-planet-grid">
          {(showAllPlanets ? model.planetDetails : model.planetDetails.slice(0, 6)).map((planet) => (
            <PlanetRow
              key={planet.id}
              planet={planet}
              expanded={expandedPlanet === planet.id}
              onToggle={() => setExpandedPlanet((prev) => (prev === planet.id ? null : planet.id))}
            />
          ))}
        </div>
        {model.planetDetails.length > 6 && (
          <button
            type="button"
            className="transit-show-more"
            onClick={() => setShowAllPlanets((prev) => !prev)}
            aria-expanded={showAllPlanets}
          >
            {showAllPlanets
              ? "Mostrar menos"
              : `Ver los ${model.planetDetails.length - 6} cuerpos restantes`}
          </button>
        )}
      </section>

      <button
        type="button"
        className="btn-primary transit-cta"
        onClick={() => onAskAgent?.(model.actions.askAgent)}
      >
        {buildAskAgentButtonLabel(model)}
      </button>

      <p className="transit-calculated">{model.header.calculatedLabel}</p>
    </div>
  );
}

interface ImpactSectionProps {
  section: TransitImpactSectionModel;
}

function ImpactSection({ section }: ImpactSectionProps) {
  return (
    <section className={`glass-panel transit-impact transit-impact--${section.kind}`}>
      <div className="transit-impact-kicker">{section.title.toUpperCase()}</div>
      {section.subtitle && <p className="transit-impact-sub">{section.subtitle}</p>}
      <ul className="transit-impact-list">
        {section.items.map((item) => (
          <ImpactRow key={item.id} item={item} kind={section.kind} />
        ))}
      </ul>
    </section>
  );
}

interface ImpactRowProps {
  item: TransitImpactCardModel;
  kind: TransitImpactSectionModel["kind"];
}

function ImpactRow({ item, kind }: ImpactRowProps) {
  return (
    <li className="transit-impact-row">
      <span className={`transit-impact-tag transit-impact-tag--${kind}`}>{item.eyebrow}</span>
      <div className="transit-impact-row-body">
        <div className="transit-impact-row-title">{item.title}</div>
        <div className="transit-impact-row-text">{item.body}</div>
        {item.meta && <div className="transit-impact-row-meta">{item.meta}</div>}
      </div>
    </li>
  );
}

interface DayKeyFactsSectionProps {
  facts: DayKeyFact[];
}

function DayKeyFactsSection({ facts }: DayKeyFactsSectionProps) {
  return (
    <section className="transit-days-key" aria-label="Días clave de la semana">
      <div className="transit-days-key-kicker">DÍAS CLAVE</div>
      <ul className="transit-days-key-list">
        {facts.map((fact, index) => (
          <li key={fact.id} className={`transit-days-key-row transit-days-key-row--${fact.kind}`}>
            <span
              className={`transit-days-key-dot${index === 0 ? " is-today" : ""}`}
              aria-hidden="true"
            />
            <div className="transit-days-key-body">
              <div className="transit-days-key-label">{fact.dayLabel}</div>
              <div className="transit-days-key-summary">{fact.summary}</div>
              {fact.impactLabel && (
                <div className="transit-days-key-impact">{fact.impactLabel}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TimelineSectionProps {
  activeLabel: string;
  isSelectedHour: boolean;
  snapshots: Array<{ id: string; label: string; targetAt: string }>;
  selectedIndex: number;
  onTimeSelect: (snapshotId: string) => void;
  onTimeNow: () => void;
}

function TimelineSection({
  activeLabel,
  isSelectedHour,
  snapshots,
  selectedIndex,
  onTimeSelect,
  onTimeNow,
}: TimelineSectionProps) {
  const max = Math.max(snapshots.length - 1, 0);
  const fillPercent = max > 0 ? (selectedIndex / max) * 100 : 0;
  const tickLabels = pickTickLabels(snapshots);

  return (
    <section className="glass-panel transit-panel transit-timeline">
      <div className="transit-panel-kicker">EXPLORAR EL DÍA</div>
      <p className="transit-timeline-active">{activeLabel}</p>
      <div className="transit-timeline-track">
        <div
          className="transit-timeline-fill"
          style={{ width: `${fillPercent}%` }}
          aria-hidden="true"
        />
        <input
          type="range"
          aria-label="Seleccionar hora del tránsito"
          min={0}
          max={max}
          value={selectedIndex}
          onChange={(event) => {
            const snapshot = snapshots[Number(event.currentTarget.value)];
            if (snapshot) onTimeSelect(snapshot.id);
          }}
          className="transit-timeline-input"
        />
      </div>
      <div className="transit-timeline-ticks" aria-hidden="true">
        {tickLabels.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
      {isSelectedHour && (
        <button type="button" onClick={onTimeNow} className="transit-timeline-now-link">
          Volver al momento actual
        </button>
      )}
    </section>
  );
}

interface CentersSectionProps {
  groups: TransitCenterGroupModel[];
  showAllActivated: boolean;
  onToggleAllActivated: () => void;
}

function CentersSection({ groups, showAllActivated, onToggleAllActivated }: CentersSectionProps) {
  const temporarilyDefined = groups.find((g) => g.kind === "temporarilyDefined");
  const reinforced = groups.find((g) => g.kind === "reinforced");
  const conditioned = groups.find((g) => g.kind === "conditioned");
  const activated = groups.find((g) => g.kind === "activated");

  return (
    <section className="glass-panel transit-panel transit-centers">
      <div className="transit-panel-kicker">CENTROS</div>

      {temporarilyDefined && temporarilyDefined.centers.length > 0 && (
        <div className="transit-centers-group transit-centers-group--temporary">
          <div className="transit-centers-label">Definidos temporalmente</div>
          <p className="transit-centers-hint">
            Un canal completo está uniendo estos centros mientras dure el tránsito.
          </p>
          <ul className="transit-centers-pills">
            {temporarilyDefined.centers.map((center) => (
              <li key={`temp-${center.id}`} className="transit-center-pill transit-center-pill--temporary">
                <span className="transit-center-dot" aria-hidden="true" />
                {center.displayName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reinforced && reinforced.centers.length > 0 && (
        <div className="transit-centers-group transit-centers-group--reinforced">
          <div className="transit-centers-label">Reforzados</div>
          <p className="transit-centers-hint">
            Tus centros definidos que el cielo está tocando hoy. Energía conocida, intensificada.
          </p>
          <ul className="transit-centers-pills">
            {reinforced.centers.map((center) => (
              <li key={`reinf-${center.id}`} className="transit-center-pill transit-center-pill--reinforced">
                {center.displayName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conditioned && conditioned.centers.length > 0 && (
        <div className="transit-centers-group transit-centers-group--conditioned">
          <div className="transit-centers-label">Condicionados</div>
          <p className="transit-centers-hint">
            Centros indefinidos tuyos recibiendo presión externa. Notalo, no lo confundas con vos.
          </p>
          <ul className="transit-centers-pills">
            {conditioned.centers.map((center) => (
              <li key={`cond-${center.id}`} className="transit-center-pill transit-center-pill--conditioned">
                {center.displayName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {activated && activated.centers.length > 0 && (
        <div className="transit-centers-group transit-centers-group--activated">
          <button
            type="button"
            className="transit-centers-toggle"
            onClick={onToggleAllActivated}
            aria-expanded={showAllActivated}
          >
            <span className="transit-centers-label">Activados</span>
            <span className="transit-centers-count">{activated.centers.length}</span>
            <span className="transit-centers-chevron" aria-hidden="true">
              {showAllActivated ? "−" : "+"}
            </span>
          </button>
          {showAllActivated && (
            <ul className="transit-centers-pills">
              {activated.centers.map((center) => (
                <li key={`act-${center.id}`} className="transit-center-pill transit-center-pill--activated">
                  {center.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

interface PlanetRowProps {
  planet: TransitPlanetDetailModel;
  expanded: boolean;
  onToggle: () => void;
}

function PlanetRow({ planet, expanded, onToggle }: PlanetRowProps) {
  const gateTheme = getGateTheme(planet.hdGate);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`transit-planet-card${expanded ? " is-expanded" : ""}`}
    >
      <span className="transit-planet-glyph" aria-hidden="true">
        {planet.glyph}
      </span>
      <span className="transit-planet-body">
        <span className="transit-planet-name">
          {planet.name}
          {planet.isRetrograde && <span className="transit-planet-rx">Rx</span>}
        </span>
        <span className="transit-planet-meta">
          {planet.sign} {planet.degree}°
        </span>
        <span className="transit-planet-gate">
          Puerta {planet.hdGate}
          <span className="transit-planet-line"> · Línea {planet.hdLine}</span>
        </span>
      </span>
      <span className={`transit-planet-chevron${expanded ? " is-open" : ""}`} aria-hidden="true">
        ⌄
      </span>
      {expanded && gateTheme && (
        <span className="transit-planet-detail">
          <span className="transit-planet-detail-title">{gateTheme.name}</span>
          <span className="transit-planet-detail-theme">{gateTheme.theme}</span>
        </span>
      )}
    </button>
  );
}

function resolveTimelineIndex(
  snapshots: Array<{ id: string; targetAt: string }>,
  selectedSnapshotId: string,
  targetAt: string,
): number {
  const exactIndex = snapshots.findIndex((snapshot) => snapshot.id === selectedSnapshotId);
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const selectedTime = Date.parse(targetAt);
  if (!Number.isFinite(selectedTime)) {
    return 0;
  }

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  snapshots.forEach((snapshot, index) => {
    const snapshotTime = Date.parse(snapshot.targetAt);
    if (!Number.isFinite(snapshotTime)) {
      return;
    }

    const distance = Math.abs(snapshotTime - selectedTime);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function pickTickLabels(snapshots: Array<{ label: string }>): string[] {
  if (snapshots.length === 0) return [];
  if (snapshots.length <= 6) return snapshots.map((s) => s.label);
  const indexes = [0, 4, 8, 12, 16, 20].filter((i) => i < snapshots.length);
  const labels = indexes.map((i) => snapshots[i].label);
  const last = snapshots[snapshots.length - 1].label;
  if (!labels.includes(last)) labels.push(last);
  return labels;
}

function buildAskAgentButtonLabel(model: TransitScreenModel): string {
  if (model.actions.askAgent.source === "selectedTime") {
    return `Preguntale al agente sobre ${model.header.activeLabel.replace("A las ", "las ")}`;
  }

  if (model.mode === "next7Days") {
    return "Preguntale al agente sobre los próximos 7 días";
  }

  return "Preguntale al agente sobre este momento";
}
