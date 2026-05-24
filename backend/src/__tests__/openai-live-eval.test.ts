import { describe, expect, it } from "vitest";

import {
  buildOpenAiLiveEvalPlan,
  formatConsentRequest,
  requireLiveEvalConsent,
} from "../evals/openai-live-eval.js";

describe("OpenAI live eval plan", () => {
  it("keeps the default run token-safe until explicit consent is provided", () => {
    const plan = buildOpenAiLiveEvalPlan({ includeTranscribe: false });

    expect(plan.maxModelCalls).toBe(67);
    expect(plan.routes).toEqual(["chat_stream", "chat", "mcp_ask", "report", "memory_writer"]);
    expect(plan.modelsByRoute.chat_stream).toEqual(["gpt-4o-mini", "gpt-5.4-mini"]);
    expect(plan.modelsByRoute.report).toEqual(["gpt-4o-mini", "gpt-5.4-mini", "gpt-5.4"]);
    expect(plan.modelsByRoute.memory_writer).toEqual(["gpt-4o-mini", "gpt-5.4-nano"]);
    expect(plan.maxEstimatedCostUsd).toBeGreaterThan(0);
    expect(() => requireLiveEvalConsent(plan, { confirmed: false })).toThrow(/consent/i);
    expect(() => requireLiveEvalConsent(plan, { confirmed: true })).toThrow(/cap/i);
    expect(() => requireLiveEvalConsent(plan, { confirmed: true, maxCostUsd: Number.NaN })).toThrow(/cap/i);
  });

  it("adds transcription calls only when a consented audio fixture is present", () => {
    const plan = buildOpenAiLiveEvalPlan({
      includeTranscribe: true,
      audioFixturePath: "/tmp/consented-audio.webm",
    });

    expect(plan.maxModelCalls).toBe(69);
    expect(plan.routes).toContain("transcribe");
    expect(plan.modelsByRoute.transcribe).toEqual(["whisper-1", "gpt-4o-mini-transcribe"]);
  });

  it("prints the exact approval envelope needed before spending tokens", () => {
    const plan = buildOpenAiLiveEvalPlan({ includeTranscribe: false });
    const request = formatConsentRequest(plan);

    expect(request).toContain("NO ejecutar sin consentimiento explicito");
    expect(request).toContain("gpt-5.4-mini");
    expect(request).toContain("67");
    expect(request).toContain("USD");
  });
});
