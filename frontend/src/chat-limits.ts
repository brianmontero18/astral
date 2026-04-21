import type { AppUserPlan } from "./types";

export interface ChatUsageSnapshot {
  plan: AppUserPlan;
  used: number;
  limit: number | null;
  cycle: string;
  resetsAt: string;
}

export interface ChatLimitExperience {
  title: string;
  body: string;
  ctaLabel: string | null;
}

const PLAN_MESSAGE_LIMITS: Record<AppUserPlan, number | null> = {
  free: 20,
  basic: 120,
  premium: 300,
};

export function getMessageLimitForPlan(plan: AppUserPlan): number | null {
  return PLAN_MESSAGE_LIMITS[plan];
}

export function isChatLimitReached(
  usage: ChatUsageSnapshot | null,
): boolean {
  return usage !== null && usage.limit !== null && usage.used >= usage.limit;
}

export function getChatLimitExperience(
  usage: ChatUsageSnapshot,
  resetDateLabel: string | null,
): ChatLimitExperience {
  if (usage.plan === "premium") {
    return {
      title: "Tu cuota mensual ya está completa",
      body: `Ya usaste tus ${usage.limit ?? 0} mensajes de este mes. Tu cupo se renueva${resetDateLabel ? ` el ${resetDateLabel}` : " el próximo mes"}.`,
      ctaLabel: null,
    };
  }

  if (usage.plan === "basic") {
    return {
      title: "Tu ventana al cosmos de este mes se ha completado",
      body: `Ya usaste tus ${usage.limit ?? 0} mensajes de este mes. Si necesitás seguir hoy, podés pasar a Premium.${resetDateLabel ? ` Si no, tu cupo se renueva el ${resetDateLabel}.` : ""}`,
      ctaLabel: "Pasarte a Premium ✦",
    };
  }

  return {
    title: "Tu ventana al cosmos de este mes se ha completado",
    body: `Ya usaste tus ${usage.limit ?? 0} mensajes de exploración de este mes. Para seguir recibiendo guía estelar personalizada, elegí un plan superior.`,
    ctaLabel: "Ver planes Astral ✦",
  };
}
