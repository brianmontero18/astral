import {
  getTransitSnapshotCached,
  isValidTimeZone,
  transitSnapshotToWeeklyTransits,
  type TransitSnapshotKind,
  type WeeklyTransits,
} from "../transit-service.js";

export interface TransitChatContext {
  source: "transitScreen";
  mode: "today" | "next7Days";
  snapshotId: string;
  targetAt: string;
  timeZone: string;
}

type TransitChatSnapshotKind = Extract<TransitSnapshotKind, "instant" | "hour" | "panorama">;

export interface ParsedTransitChatContext extends TransitChatContext {
  snapshotKind: TransitChatSnapshotKind;
  targetAtDate: Date;
}

export function parseTransitChatContext(
  context: TransitChatContext | undefined,
): { context?: ParsedTransitChatContext; error?: undefined } | { context?: undefined; error: string } {
  if (!context) {
    return {};
  }

  if (
    context.source !== "transitScreen" ||
    (context.mode !== "today" && context.mode !== "next7Days") ||
    !context.snapshotId ||
    !context.targetAt ||
    !context.timeZone ||
    !isValidTimeZone(context.timeZone)
  ) {
    return { error: "invalid_transit_context" };
  }

  const targetAtDate = parseDate(context.targetAt);
  const snapshot = parseTransitSnapshotId(context.snapshotId);

  if (!targetAtDate || !snapshot) {
    return { error: "invalid_transit_context" };
  }

  if (snapshot.targetAt.getTime() !== targetAtDate.getTime()) {
    return { error: "invalid_transit_context" };
  }

  if (context.mode === "today" && snapshot.kind === "panorama") {
    return { error: "invalid_transit_context" };
  }

  if (context.mode === "next7Days" && snapshot.kind !== "panorama") {
    return { error: "invalid_transit_context" };
  }

  return { context: { ...context, snapshotKind: snapshot.kind, targetAtDate } };
}

export async function getTransitsForChat(
  context?: ParsedTransitChatContext,
): Promise<WeeklyTransits> {
  if (!context) {
    const snapshot = await getTransitSnapshotCached("instant", new Date(), "UTC", "Ahora");
    return transitSnapshotToWeeklyTransits(snapshot);
  }

  const label = context.mode === "next7Days"
    ? "Panorama"
    : context.snapshotKind === "hour"
      ? "Tránsito seleccionado"
      : "Ahora";
  const snapshot = await getTransitSnapshotCached(
    context.snapshotKind,
    context.targetAtDate,
    context.timeZone,
    label,
  );
  return transitSnapshotToWeeklyTransits(snapshot);
}

function parseTransitSnapshotId(
  snapshotId: string,
): { kind: TransitChatSnapshotKind; targetAt: Date } | null {
  const match = /^(instant|hour|panorama):(.+)$/.exec(snapshotId);
  if (!match) return null;

  const targetAt = parseDate(match[2]);
  if (!targetAt) return null;

  return {
    kind: match[1] as TransitChatSnapshotKind,
    targetAt,
  };
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
