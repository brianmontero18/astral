import type {
  TransitAskAgentPayload,
  TransitScreenModel,
} from "../transits/types";
import { BodygraphLive } from "./BodygraphLive";

interface Props {
  model: TransitScreenModel;
  onBack: () => void;
  onAskAgent?: (payload: TransitAskAgentPayload) => void;
  onRefresh: () => void;
}

export function TransitMapView({ model, onBack, onAskAgent, onRefresh }: Props) {
  const snapshot = model.bodygraphSnapshot;

  return (
    <div
      className="transit-screen transit-map-view animate-fade-in-slow"
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
      <div className="transit-map-toolbar">
        <button
          type="button"
          className="transit-map-back"
          onClick={onBack}
          aria-label="Volver a la lectura"
        >
          ← Volver
        </button>
        <div className="transit-map-meta">
          <div className="transit-map-meta-kicker">{model.header.rangeLabel}</div>
          <div className="transit-map-meta-label">{model.header.activeLabel}</div>
        </div>
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

      {snapshot && (
        <div className="transit-map-chart">
          <BodygraphLive
            variant="full"
            userDefinedCenters={snapshot.userDefinedCenters}
            userActivatedGates={snapshot.userActivatedGates}
            transitActivatedCenters={snapshot.transitActivatedCenters}
            transitConditionedCenters={snapshot.transitConditionedCenters}
            temporarilyDefinedCenters={snapshot.temporarilyDefinedCenters}
            activatedChannels={snapshot.activatedChannels}
            temporarilyDefinedChannels={snapshot.temporarilyDefinedChannels}
            personalChannels={snapshot.personalChannels}
            ariaLabel="Bodygraph del momento (vista completa)"
          />
        </div>
      )}

      <ul className="transit-map-legend" aria-label="Leyenda del bodygraph">
        <li>
          <span className="bg-legend-swatch bg-legend-swatch--user" />
          Tu definición permanente
        </li>
        <li>
          <span className="bg-legend-swatch bg-legend-swatch--temp" />
          Definido temporalmente por tránsito
        </li>
        <li>
          <span className="bg-legend-swatch bg-legend-swatch--conditioned" />
          Centro condicionado
        </li>
        <li>
          <span className="bg-legend-swatch bg-legend-swatch--activated" />
          Activado por tránsito
        </li>
      </ul>

      {model.primaryInsight && (
        <section className="transit-map-summary">
          <div className="transit-map-kicker">{model.primaryInsight.eyebrow}</div>
          <h3 className="transit-map-title">{model.primaryInsight.title}</h3>
          {model.primaryInsight.headlineDetail && (
            <p className="transit-map-headline">{model.primaryInsight.headlineDetail}</p>
          )}
          {model.primaryInsight.attribution && (
            <p className="transit-map-attribution">{model.primaryInsight.attribution}</p>
          )}
        </section>
      )}

      {model.primaryInsight.pulseChannels && model.primaryInsight.pulseChannels.length > 0 && (
        <section className="transit-map-section">
          <div className="transit-map-kicker">CANALES ACTIVOS</div>
          <ul className="transit-map-channel-list">
            {model.primaryInsight.pulseChannels.map((channel) => (
              <li key={channel.id} className="transit-map-channel">
                <div className="transit-map-channel-name">{channel.name}</div>
                <div className="transit-map-channel-meta">
                  {channel.centers} · {channel.id}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.personalSections.length > 0 && (
        <section className="transit-map-section">
          <div className="transit-map-kicker">EN TU DISEÑO</div>
          <ul className="transit-map-channel-list">
            {model.personalSections.flatMap((section) =>
              section.items.map((item) => (
                <li key={`${section.id}-${item.id}`} className="transit-map-channel">
                  <div className="transit-map-channel-tag">{item.eyebrow}</div>
                  <div className="transit-map-channel-name">{item.title}</div>
                  <div className="transit-map-channel-meta">{item.body}</div>
                </li>
              )),
            )}
          </ul>
        </section>
      )}

      <button
        type="button"
        className="btn-primary transit-cta"
        onClick={() => onAskAgent?.(model.actions.askAgent)}
      >
        Preguntale al agente sobre este mapa
      </button>
    </div>
  );
}
