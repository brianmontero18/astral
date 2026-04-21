import { describe, expect, it } from "vitest";

import {
  getChatLimitExperience,
  getMessageLimitForPlan,
  isChatLimitReached,
} from "../../../frontend/src/chat-limits";

describe("frontend chat limit helpers", () => {
  it("maps support plans to the same visible limit semantics as the backend", () => {
    expect(getMessageLimitForPlan("free")).toBe(20);
    expect(getMessageLimitForPlan("basic")).toBe(120);
    expect(getMessageLimitForPlan("premium")).toBe(300);
  });

  it("only trips when the finite limit is actually reached", () => {
    expect(isChatLimitReached({
      plan: "free",
      used: 19,
      limit: 20,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    })).toBe(false);
    expect(isChatLimitReached({
      plan: "free",
      used: 20,
      limit: 20,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    })).toBe(true);
  });

  it("returns plan-specific limit experience copy for free, basic and premium", () => {
    expect(getChatLimitExperience({
      plan: "free",
      used: 20,
      limit: 20,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    }, "1 de mayo de 2026")).toEqual({
      title: "Tu ventana al cosmos de este mes se ha completado",
      body: "Ya usaste tus 20 mensajes de exploración de este mes. Para seguir recibiendo guía estelar personalizada, elegí un plan superior.",
      ctaLabel: "Ver planes Astral ✦",
    });

    expect(getChatLimitExperience({
      plan: "basic",
      used: 120,
      limit: 120,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    }, "1 de mayo de 2026")).toEqual({
      title: "Tu ventana al cosmos de este mes se ha completado",
      body: "Ya usaste tus 120 mensajes de este mes. Si necesitás seguir hoy, podés pasar a Premium. Si no, tu cupo se renueva el 1 de mayo de 2026.",
      ctaLabel: "Pasarte a Premium ✦",
    });

    expect(getChatLimitExperience({
      plan: "premium",
      used: 300,
      limit: 300,
      cycle: "2026-04",
      resetsAt: "2026-05-01T00:00:00-03:00",
    }, "1 de mayo de 2026")).toEqual({
      title: "Tu cuota mensual ya está completa",
      body: "Ya usaste tus 300 mensajes de este mes. Tu cupo se renueva el 1 de mayo de 2026.",
      ctaLabel: null,
    });
  });
});
