import type { FastifyInstance } from "fastify";

const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

export async function transcribeRoutes(app: FastifyInstance) {
  app.post("/transcribe", async (req, reply) => {
    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: "No audio file provided" });
    }

    const buffer = await file.toBuffer();
    const filename = file.filename || "voice.webm";
    const mimetype = file.mimetype || "audio/webm";

    const formData = new FormData();
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    formData.append("file", new Blob([arrayBuf], { type: mimetype }), filename);
    formData.append("model", "whisper-1");

    try {
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        app.log.error(`Whisper API error ${response.status}: ${errText}`);
        return reply.status(502).send({ error: "Transcription failed" });
      }

      const result = (await response.json()) as { text: string };
      return reply.send({ text: result.text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      app.log.error(`Transcription error: ${msg}`);
      return reply.status(502).send({ error: msg });
    }
  });
}
