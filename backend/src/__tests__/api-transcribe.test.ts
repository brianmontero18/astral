import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";

import { createTestApp } from "./helpers.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function multipartAudioPayload({
  filename = "voice.webm",
  content = "fake-audio",
  mimeType = "audio/webm",
  includeFile = true,
}: {
  filename?: string;
  content?: Buffer | string;
  mimeType?: string;
  includeFile?: boolean;
} = {}) {
  const boundary = `----AstralTranscribeBoundary${Date.now()}`;
  const chunks: Buffer[] = [];

  if (includeFile) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      ),
    );
    chunks.push(Buffer.isBuffer(content) ? content : Buffer.from(content));
    chunks.push(Buffer.from("\r\n"));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(chunks),
  };
}

describe("POST /api/transcribe", () => {
  it("rejects multipart requests without an audio file", async () => {
    const { headers, body } = multipartAudioPayload({ includeFile: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/transcribe",
      headers,
      body,
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "No audio file provided",
    });
  });

  it("returns long transcription text from the upstream provider", async () => {
    const longText = Array.from(
      { length: 12 },
      (_, index) => `Frase extendida ${index + 1} para validar transcripcion larga.`,
    ).join(" ");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: longText }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { headers, body } = multipartAudioPayload();
    const response = await app.inject({
      method: "POST",
      url: "/api/transcribe",
      headers,
      body,
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ text: longText });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bearer\b/),
        }),
        body: expect.any(FormData),
      }),
    );
  });

  it("maps upstream timeout-style failures to a sanitized 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("upstream timeout", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const { headers, body } = multipartAudioPayload();
    const response = await app.inject({
      method: "POST",
      url: "/api/transcribe",
      headers,
      body,
    });

    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toEqual({
      error: "Transcription failed",
    });
  });
});
