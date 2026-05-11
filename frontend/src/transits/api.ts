import type { TransitExperienceResponse, TransitMode } from "./types";

const BASE = "/api";

export interface FetchTransitExperienceInput {
  mode: TransitMode;
  includeTimeline?: boolean;
  selectedAt?: string;
  clientNow?: number;
  timeZone?: string;
}

export async function fetchTransitExperience(
  input: FetchTransitExperienceInput,
): Promise<TransitExperienceResponse> {
  const timeZone = input.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const search = new URLSearchParams();
  search.set("mode", input.mode);
  search.set("timeZone", timeZone);
  search.set("clientNow", String(input.clientNow ?? Date.now()));
  if (input.selectedAt) {
    search.set("selectedAt", String(Date.parse(input.selectedAt)));
  }
  if (input.includeTimeline) {
    search.set("includeTimeline", "true");
  }

  const res = await fetch(`${BASE}/transits/experience?${search.toString()}`);
  if (!res.ok) throw new Error(`Transits error ${res.status}`);
  return res.json() as Promise<TransitExperienceResponse>;
}
