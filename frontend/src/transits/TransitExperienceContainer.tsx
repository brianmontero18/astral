import { useEffect, useMemo, useRef, useState } from "react";
import { TransitViewer } from "../components/TransitViewer";
import { TransitMapView } from "../components/TransitMapView";
import { getTransitFailureMessage } from "../transit-errors";
import { buildTransitScreenModel } from "./adapter";
import { fetchTransitExperience } from "./api";
import type {
  TransitAskAgentPayload,
  TransitExperienceResponse,
  TransitMode,
} from "./types";
import type { UserProfile } from "../types";

type ViewLevel = "ritual" | "map";

interface Props {
  profile?: UserProfile;
  onAskAgent?: (payload: TransitAskAgentPayload) => void;
}

export function TransitExperienceContainer({ profile, onAskAgent }: Props) {
  const [mode, setMode] = useState<TransitMode>("today");
  const [response, setResponse] = useState<TransitExperienceResponse | null>(null);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<"ready" | "refreshing" | "timelineLoading" | "error">("refreshing");
  const [error, setError] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("ritual");
  const initialLoadStartedRef = useRef(false);
  const latestRequestIdRef = useRef(0);
  const mountedRef = useRef(false);

  const loadExperience = async (
    nextMode: TransitMode,
    nextState: typeof loadingState = "refreshing",
  ) => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setLoadingState(nextState);
    setError(null);

    try {
      const data = await fetchTransitExperience({
        mode: nextMode,
        includeTimeline: nextMode === "today",
      });
      if (!mountedRef.current || latestRequestIdRef.current !== requestId) {
        return;
      }
      setMode(nextMode);
      setResponse(data);
      setSelectedSnapshotId(data.selectedSnapshotId);
      setLoadingState("ready");
    } catch (err) {
      if (!mountedRef.current || latestRequestIdRef.current !== requestId) {
        return;
      }
      setError(getTransitFailureMessage(err));
      setLoadingState("error");
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!initialLoadStartedRef.current) {
      initialLoadStartedRef.current = true;
      void loadExperience("today");
    }

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const model = useMemo(() => {
    if (!response) {
      return null;
    }

    return buildTransitScreenModel(
      response,
      selectedSnapshotId ?? response.selectedSnapshotId,
      loadingState,
      profile,
    );
  }, [response, selectedSnapshotId, loadingState, profile]);

  if (loadingState === "refreshing" && !model) {
    return (
      <div style={{ textAlign: "center", marginTop: 60, color: "var(--text-on-light-muted)", fontSize: 13 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(33, 41, 30, 0.12)",
            borderTopColor: "var(--color-gold-deep)",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px",
          }}
        />
        Cargando tránsitos...
      </div>
    );
  }

  if (error && !model) {
    return (
      <div style={{ margin: "40px auto", maxWidth: 600, padding: "24px", textAlign: "center" }} className="glass-panel">
        <div style={{ color: "#f3c2c2", fontSize: "14px", fontFamily: "var(--font-sans)" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!model) return null;

  if (viewLevel === "map") {
    return (
      <TransitMapView
        model={model}
        onBack={() => setViewLevel("ritual")}
        onAskAgent={onAskAgent}
        onRefresh={() => void loadExperience(mode)}
      />
    );
  }

  return (
    <TransitViewer
      model={model}
      error={error}
      onModeChange={(nextMode) => {
        if (nextMode !== mode) {
          void loadExperience(nextMode);
        }
      }}
      onTimeSelect={(snapshotId) => setSelectedSnapshotId(snapshotId)}
      onTimeNow={() => void loadExperience("today")}
      onRefresh={() => void loadExperience(mode)}
      onAskAgent={onAskAgent}
      onOpenMap={() => setViewLevel("map")}
    />
  );
}
