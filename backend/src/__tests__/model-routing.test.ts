import { describe, expect, it } from "vitest";

import {
  selectChatModel,
  selectMemoryWriterModel,
  selectReportModel,
} from "../llm/model-routing.js";

describe("model routing policy", () => {
  it("keeps simple chat on the configured default model", () => {
    const decision = selectChatModel({
      route: "chat",
      messages: [{ role: "user", content: "Hola, ¿qué significa mi tipo?" }],
      defaultModel: "gpt-4o-mini",
      simpleModel: "gpt-4o-mini",
      complexModel: "gpt-5.4-mini",
    });

    expect(decision).toMatchObject({
      model: "gpt-4o-mini",
      reason: "chat_simple_default",
      complexity: "simple",
    });
  });

  it("routes complex multi-step chat to the opt-in complex model", () => {
    const decision = selectChatModel({
      route: "chat_stream",
      messages: [{
        role: "user",
        content: "Analizá mi diseño, mis tránsitos y mi negocio. Compará patrones, dame riesgos y próximos pasos.",
      }],
      defaultModel: "gpt-4o-mini",
      simpleModel: "gpt-4o-mini",
      complexModel: "gpt-5.4-mini",
    });

    expect(decision).toMatchObject({
      route: "chat_stream",
      model: "gpt-5.4-mini",
      reason: "chat_complex_opt_in",
      complexity: "complex",
    });
    expect(decision.signals).toContain("multi_step");
    expect(decision.signals).toContain("cross_domain");
  });

  it("does not promote complex chat when no complex model is configured", () => {
    const decision = selectChatModel({
      route: "mcp_ask",
      messages: [{ role: "user", content: "Compará mi autoridad emocional con mis tránsitos y explicame riesgos." }],
      defaultModel: "gpt-4o-mini",
      simpleModel: "gpt-4o-mini",
      complexModel: "gpt-4o-mini",
    });

    expect(decision).toMatchObject({
      model: "gpt-4o-mini",
      reason: "chat_complex_no_upgrade_configured",
      complexity: "complex",
    });
  });

  it("routes premium reports only when a premium report model is explicitly configured", () => {
    expect(selectReportModel({
      tier: "premium",
      defaultModel: "gpt-4o-mini",
      premiumModel: "gpt-5.4-mini",
    })).toMatchObject({
      route: "report",
      model: "gpt-5.4-mini",
      reason: "report_premium_opt_in",
    });

    expect(selectReportModel({
      tier: "free",
      defaultModel: "gpt-4o-mini",
      premiumModel: "gpt-5.4-mini",
    })).toMatchObject({
      model: "gpt-4o-mini",
      reason: "report_default",
    });
  });

  it("keeps memory writer on its configured model with an explicit reason", () => {
    expect(selectMemoryWriterModel({
      defaultModel: "gpt-4o-mini",
      configuredModel: "gpt-5.4-nano",
    })).toMatchObject({
      route: "memory_writer",
      model: "gpt-5.4-nano",
      reason: "memory_writer_configured",
    });
  });
});
