import type { KeyboardEvent } from "react";
import {
  BODYGRAPH_CENTERS,
  BODYGRAPH_CHANNELS,
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
  ariaLabel?: string;
  onCenterTap?: (centerId: string) => void;
}

export function BodygraphLive({
  variant,
  userDefinedCenters,
  transitActivatedCenters,
  transitConditionedCenters,
  temporarilyDefinedCenters,
  activatedChannels,
  temporarilyDefinedChannels,
  personalChannels,
  ariaLabel,
  onCenterTap,
}: BodygraphLiveProps) {
  const userDefined = new Set(userDefinedCenters);
  const tempDefined = new Set(temporarilyDefinedCenters);
  const conditioned = new Set(transitConditionedCenters);
  const activated = new Set(transitActivatedCenters);

  const channelIds = new Set([
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
      <g className="bg-channels">
        {BODYGRAPH_CHANNELS.map((channel) => {
          const isActive = channelIds.has(channel.channelId);
          if (!isActive) return null;
          const isPersonal = personalChannelIds.has(channel.channelId);
          return (
            <path
              key={channel.channelId}
              d={channel.d}
              className={`bg-channel${isPersonal ? " bg-channel--personal" : " bg-channel--active"}`}
            />
          );
        })}
      </g>
      <g className="bg-channels-inactive">
        {BODYGRAPH_CHANNELS.filter((channel) => !channelIds.has(channel.channelId)).map(
          (channel) => (
            <path key={`inactive-${channel.channelId}`} d={channel.d} className="bg-channel bg-channel--inactive" />
          ),
        )}
      </g>
      <g className="bg-centers">
        {BODYGRAPH_CENTERS.map((center) => {
          const isUserDefined = userDefined.has(center.id);
          const isTemp = tempDefined.has(center.id);
          const isConditioned = conditioned.has(center.id);
          const isActivated = activated.has(center.id);

          const stateClass = isTemp
            ? "is-temp-defined"
            : isUserDefined
              ? "is-user-defined"
              : isConditioned
                ? "is-conditioned"
                : isActivated
                  ? "is-activated"
                  : "is-neutral";

          const interactive = onCenterTap && variant === "full";

          return (
            <g
              key={center.id}
              className={`bg-center ${stateClass}`}
              {...(interactive
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onCenterTap?.(center.id),
                    onKeyDown: (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onCenterTap?.(center.id);
                      }
                    },
                    "aria-label": `${center.displayName}, ${describeState(stateClass)}`,
                  }
                : {})}
            >
              <path d={center.path} />
              {variant === "full" && (
                <text
                  x={center.cx}
                  y={center.cy + (center.labelOffsetY ?? 0)}
                  className="bg-center-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {center.shortLabel}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

function describeState(stateClass: string): string {
  switch (stateClass) {
    case "is-user-defined":
      return "definido permanente";
    case "is-temp-defined":
      return "definido temporalmente por tránsito";
    case "is-conditioned":
      return "condicionado por tránsito";
    case "is-activated":
      return "activado por tránsito";
    default:
      return "neutral";
  }
}

export { findChannelPath };
