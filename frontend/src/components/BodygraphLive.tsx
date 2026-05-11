import {
  BODYGRAPH_CENTERS,
  BODYGRAPH_CHANNELS,
  BODYGRAPH_GATES,
  BODYGRAPH_VIEWBOX,
  findChannelPath,
} from "../hd-bodygraph-layout";

interface ChannelRef {
  id: string;
}

export interface BodygraphLiveProps {
  variant: "miniature" | "full";
  userDefinedCenters: string[];
  userActivatedGates: number[];
  transitActivatedCenters: string[];
  transitConditionedCenters: string[];
  temporarilyDefinedCenters: string[];
  activatedChannels: ChannelRef[];
  temporarilyDefinedChannels: ChannelRef[];
  personalChannels?: ChannelRef[];
  transitActivatedGates?: number[];
  ariaLabel?: string;
}

export function BodygraphLive({
  variant,
  userDefinedCenters,
  userActivatedGates,
  transitActivatedCenters,
  transitConditionedCenters,
  temporarilyDefinedCenters,
  activatedChannels,
  temporarilyDefinedChannels,
  personalChannels,
  transitActivatedGates,
  ariaLabel,
}: BodygraphLiveProps) {
  const userDefined = new Set(userDefinedCenters);
  const tempDefined = new Set(temporarilyDefinedCenters);
  const conditioned = new Set(transitConditionedCenters);
  const transitActivated = new Set(transitActivatedCenters);
  const userGates = new Set(userActivatedGates);

  // Build a set of activated gate numbers from channels if no explicit list is provided.
  // Any gate referenced by an activated channel counts as transit-activated.
  const transitGates = new Set<number>(transitActivatedGates ?? []);
  for (const channel of activatedChannels) {
    addGatesFromChannelId(channel.id, transitGates);
  }
  for (const channel of temporarilyDefinedChannels) {
    addGatesFromChannelId(channel.id, transitGates);
  }
  for (const channel of personalChannels ?? []) {
    addGatesFromChannelId(channel.id, transitGates);
  }

  const activatedChannelIds = new Set([
    ...activatedChannels.map((c) => c.id),
    ...temporarilyDefinedChannels.map((c) => c.id),
    ...(personalChannels ?? []).map((c) => c.id),
  ]);
  const personalChannelIds = new Set((personalChannels ?? []).map((c) => c.id));

  return (
    <svg
      role="img"
      aria-label={ariaLabel ?? "Bodygraph del momento"}
      viewBox={`0 0 ${BODYGRAPH_VIEWBOX.width} ${BODYGRAPH_VIEWBOX.height}`}
      className={`bg-svg bg-svg--${variant}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Inactive channels (background grid) */}
      <g className="bg-channels-inactive">
        {BODYGRAPH_CHANNELS.filter((c) => !activatedChannelIds.has(c.channelId)).map((channel) => (
          <path key={`inactive-${channel.channelId}`} d={channel.d} className="bg-channel bg-channel--inactive" />
        ))}
      </g>

      {/* Centers (under gates) */}
      <g className="bg-centers">
        {BODYGRAPH_CENTERS.map((center) => {
          const isUserDefined = userDefined.has(center.id);
          const isTemp = tempDefined.has(center.id);
          const isConditioned = conditioned.has(center.id);
          const isActivated = transitActivated.has(center.id);

          // Priority: user-defined (your permanent) wins over temp; temp only
          // applies if the center isn't already defined in your design.
          const stateClass = isUserDefined
            ? "is-user-defined"
            : isTemp
              ? "is-temp-defined"
              : isConditioned
                ? "is-conditioned"
                : isActivated
                  ? "is-activated"
                  : "is-neutral";

          return (
            <g key={center.id} className={`bg-center ${stateClass}`}>
              <path d={center.path} />
            </g>
          );
        })}
      </g>

      {/* Active channels (on top of centers) */}
      <g className="bg-channels-active">
        {BODYGRAPH_CHANNELS.filter((c) => activatedChannelIds.has(c.channelId)).map((channel) => {
          const isPersonal = personalChannelIds.has(channel.channelId);
          return (
            <path
              key={`active-${channel.channelId}`}
              d={channel.d}
              className={`bg-channel ${isPersonal ? "bg-channel--personal" : "bg-channel--active"}`}
            />
          );
        })}
      </g>

      {/* Gates (always on top so they stay readable) */}
      {variant === "full" && (
        <g className="bg-gates">
          {BODYGRAPH_GATES.map((gate) => {
            const isUserGate = userGates.has(gate.gate);
            const isTransitGate = transitGates.has(gate.gate);
            const stateClass = isUserGate && isTransitGate
              ? "is-both"
              : isUserGate
                ? "is-user"
                : isTransitGate
                  ? "is-transit"
                  : "is-neutral";
            return (
              <g key={`gate-${gate.gate}`} className={`bg-gate ${stateClass}`}>
                <circle cx={gate.x} cy={gate.y} r={6.8} />
                <text
                  x={gate.x}
                  y={gate.y}
                  className="bg-gate-label"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {gate.gate}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

const CHANNEL_ID_RE = /^(\d+)-(\d+)$/;

function addGatesFromChannelId(channelId: string, set: Set<number>): void {
  const match = CHANNEL_ID_RE.exec(channelId);
  if (!match) return;
  set.add(Number(match[1]));
  set.add(Number(match[2]));
}

export { findChannelPath };
