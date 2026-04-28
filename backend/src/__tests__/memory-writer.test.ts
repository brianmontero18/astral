/**
 * Memory Writer — Unit tests
 *
 * Mocks `globalThis.fetch` to simulate the OpenAI response. We avoid mocking
 * the writer module itself because the LOGIC under test (NOOP detection,
 * code-fence stripping, hard cap, identical-output collapse, telemetry meta
 * shape) lives in the module — mocking it would test nothing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MEMORY_WRITER_MODEL,
  runMemoryWriter,
  shouldTriggerMemoryWriter,
} from "../memory-writer.js";
import type { ChatMessage } from "../agent-service.js";

const realFetch = globalThis.fetch;

function mockOpenAIChat(content: string, usage = { prompt_tokens: 120, completion_tokens: 40 }) {
  return vi.fn(async () => ({
    ok: true,
    text: async () => "",
    json: async () => ({
      choices: [{ message: { content } }],
      usage,
    }),
  }) as unknown as Response);
}

const SAMPLE_MESSAGES: ChatMessage[] = [
  { role: "user", content: "Hola, soy Camila, soy coach somática para mujeres emprendedoras." },
  { role: "assistant", content: "Hola Camila, ¿qué te gustaría explorar hoy?" },
  { role: "user", content: "Lanzo un programa premium en mayo y me siento drenada creando contenido." },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = realFetch;
});

describe("runMemoryWriter — NOOP detection", () => {
  it("returns noop=true when the LLM responds with literal 'NOOP'", async () => {
    globalThis.fetch = mockOpenAIChat("NOOP");
    const result = await runMemoryWriter("## Identidad\n- Existing fact", SAMPLE_MESSAGES, "fake-key");
    expect(result.noop).toBe(true);
    expect(result.memory).toBe("## Identidad\n- Existing fact");
  });

  it("returns noop=true when the LLM responds with empty content", async () => {
    globalThis.fetch = mockOpenAIChat("");
    const result = await runMemoryWriter("## Identidad\n- Existing fact", SAMPLE_MESSAGES, "fake-key");
    expect(result.noop).toBe(true);
    expect(result.memory).toBe("## Identidad\n- Existing fact");
  });

  it("collapses to noop=true when the new markdown is byte-identical to the input (after trim)", async () => {
    const memory = "## Identidad\n- Coach somática";
    // Mock returns the same content (with trailing whitespace the writer
    // should trim before comparing).
    globalThis.fetch = mockOpenAIChat(memory + "\n");
    const result = await runMemoryWriter(memory, SAMPLE_MESSAGES, "fake-key");
    expect(result.noop).toBe(true);
    expect(result.memory).toBe(memory);
  });
});

describe("runMemoryWriter — merge output", () => {
  it("returns noop=false and the new markdown when content differs", async () => {
    const newMemory = `## Identidad
- Coach somática para mujeres emprendedoras

## Negocio
- Programa premium lanza en mayo
- Se siente drenada creando contenido (patrón a observar)`;
    globalThis.fetch = mockOpenAIChat(newMemory);
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.noop).toBe(false);
    expect(result.memory).toContain("Coach somática");
    expect(result.memory).toContain("Programa premium lanza en mayo");
  });

  it("strips a stray ```markdown code fence if the LLM wraps the output", async () => {
    const fenced = "```markdown\n## Identidad\n- Coach somática\n```";
    globalThis.fetch = mockOpenAIChat(fenced);
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.memory).toBe("## Identidad\n- Coach somática");
    expect(result.memory).not.toContain("```");
  });

  it("strips a stray ```md code fence too", async () => {
    const fenced = "```md\n## A\n- b\n```";
    globalThis.fetch = mockOpenAIChat(fenced);
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.memory).toBe("## A\n- b");
  });

  it("hard-caps the persisted markdown at MEMORY_MAX_CHARS to prevent runaway growth", async () => {
    const huge = "## Spam\n" + "- Foo bar baz\n".repeat(2000);
    globalThis.fetch = mockOpenAIChat(huge);
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    // Cap is 4000 chars (private to the module). Asserting strictly < 4001
    // also catches an off-by-one if the cap is moved.
    expect(result.memory.length).toBeLessThanOrEqual(4000);
    expect(result.noop).toBe(false);
  });
});

describe("runMemoryWriter — telemetry meta", () => {
  it("populates AgentCallMeta with token usage from the response", async () => {
    globalThis.fetch = mockOpenAIChat("NOOP", { prompt_tokens: 250, completion_tokens: 80 });
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.meta.usage).toEqual({ promptTokens: 250, completionTokens: 80 });
  });

  it("uses defaults (0/0) when usage is missing from the response", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => "",
      json: async () => ({
        choices: [{ message: { content: "NOOP" } }],
        // no usage field
      }),
    }) as unknown as Response);
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.meta.usage).toEqual({ promptTokens: 0, completionTokens: 0 });
  });

  it("captures latencyMs as a non-negative number", async () => {
    globalThis.fetch = mockOpenAIChat("NOOP");
    vi.useRealTimers();
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns the writer's own systemPrompt for hashing/audit (not the chat prompt)", async () => {
    globalThis.fetch = mockOpenAIChat("NOOP");
    const result = await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    // The writer prompt mentions its own role + the operations vocabulary —
    // the chat prompt mentions HD / tránsitos. Disambiguate by content.
    expect(result.meta.systemPrompt).toContain("componente de memoria");
    expect(result.meta.systemPrompt).toContain("ADD");
    expect(result.meta.systemPrompt).not.toContain("Diseño Humano");
  });
});

describe("runMemoryWriter — error propagation", () => {
  it("throws when the OpenAI API returns a non-OK status", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => "rate limited",
      json: async () => ({}),
    }) as unknown as Response);

    await expect(
      runMemoryWriter("", SAMPLE_MESSAGES, "fake-key"),
    ).rejects.toThrow(/Memory writer API error 429/);
  });
});

describe("runMemoryWriter — request shape", () => {
  it("passes both <current_memory> and <recent_messages> to the LLM as user content", async () => {
    const fetchSpy = mockOpenAIChat("NOOP");
    globalThis.fetch = fetchSpy;

    await runMemoryWriter("## Identidad\n- Coach", SAMPLE_MESSAGES, "fake-key");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    const body = JSON.parse(call[1]?.body as string);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("<current_memory>");
    expect(userMessage.content).toContain("## Identidad");
    expect(userMessage.content).toContain("<recent_messages>");
    expect(userMessage.content).toContain("USUARIO: Hola, soy Camila");
    expect(userMessage.content).toContain("ASISTENTE: Hola Camila");
  });

  it("uses MEMORY_WRITER_MODEL (gpt-4o-mini) regardless of input", async () => {
    const fetchSpy = mockOpenAIChat("NOOP");
    globalThis.fetch = fetchSpy;
    await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body.model).toBe(MEMORY_WRITER_MODEL);
    expect(MEMORY_WRITER_MODEL).toBe("gpt-4o-mini");
  });

  it("renders an explicit '(vacía)' marker when current_memory is empty", async () => {
    const fetchSpy = mockOpenAIChat("NOOP");
    globalThis.fetch = fetchSpy;
    await runMemoryWriter("", SAMPLE_MESSAGES, "fake-key");
    const userMessage = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string).messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toContain("(vacía");
  });
});

describe("shouldTriggerMemoryWriter — cadence policy", () => {
  it("never fires for count < 1", () => {
    expect(shouldTriggerMemoryWriter(0)).toBe(false);
    expect(shouldTriggerMemoryWriter(-1)).toBe(false);
  });

  it("fires on the very first user message so memory starts populating immediately", () => {
    expect(shouldTriggerMemoryWriter(1)).toBe(true);
  });

  it("does NOT fire on counts 2 between window boundaries", () => {
    expect(shouldTriggerMemoryWriter(2)).toBe(false);
  });

  it("fires every Nth turn (N=3 by default)", () => {
    expect(shouldTriggerMemoryWriter(3)).toBe(true);
    expect(shouldTriggerMemoryWriter(4)).toBe(false);
    expect(shouldTriggerMemoryWriter(5)).toBe(false);
    expect(shouldTriggerMemoryWriter(6)).toBe(true);
    expect(shouldTriggerMemoryWriter(9)).toBe(true);
  });
});
