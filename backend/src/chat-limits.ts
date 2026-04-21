import type { AppUserPlan } from "./db.js";

export const CHAT_USAGE_TIME_ZONE = "America/Argentina/Buenos_Aires";
const CHAT_USAGE_UTC_OFFSET = "-03:00";

export interface ChatUsageCycle {
  cycle: string;
  resetsAt: string;
  windowStartUtc: string;
  nextWindowStartUtc: string;
}

export interface ChatUsageSnapshot {
  plan: AppUserPlan;
  used: number;
  limit: number | null;
  cycle: string;
  resetsAt: string;
}

const PLAN_MESSAGE_LIMITS: Record<AppUserPlan, number | null> = {
  free: 20,
  basic: 120,
  premium: 300,
};

export function getMessageLimitForPlan(plan: AppUserPlan): number | null {
  return PLAN_MESSAGE_LIMITS[plan];
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOffsetIso(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${pad(month)}-${pad(day)}T00:00:00${CHAT_USAGE_UTC_OFFSET}`;
}

function toSqliteUtcTimestamp(value: string): string {
  const date = new Date(value);

  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join(" ");
}

export function getCurrentChatUsageCycle(now = new Date()): ChatUsageCycle {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CHAT_USAGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  const windowStartIso = formatOffsetIso(year, month, 1);
  const resetsAt = formatOffsetIso(nextYear, nextMonth, 1);

  return {
    cycle: `${year}-${pad(month)}`,
    resetsAt,
    windowStartUtc: toSqliteUtcTimestamp(windowStartIso),
    nextWindowStartUtc: toSqliteUtcTimestamp(resetsAt),
  };
}

export function buildChatUsageSnapshot(
  plan: AppUserPlan,
  used: number,
  now = new Date(),
): ChatUsageSnapshot {
  const { cycle, resetsAt } = getCurrentChatUsageCycle(now);

  return {
    plan,
    used,
    limit: getMessageLimitForPlan(plan),
    cycle,
    resetsAt,
  };
}
