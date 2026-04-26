/**
 * Test Helpers
 *
 * Creates a Fastify app with in-memory SQLite for integration tests.
 * Each test file gets a fresh database.
 */

import { initDb } from "../db.js";
import { buildApp } from "../app.js";
import { __setHandleForTesting } from "../storage/r2.js";
import type { FastifyInstance } from "fastify";

export const TEST_SESSION_HEADER = "x-test-session-subject";

// Ensure OpenAI key is set (routes read it from env, but we mock the LLM calls)
process.env.OPENAI_API_KEY ??= "test-key-not-real";
// Use in-memory SQLite for tests
process.env.TURSO_DATABASE_URL = "file::memory:";

interface StubbedObject {
  body: Buffer;
  contentType: string;
}

/**
 * In-memory stub for the R2 client used during tests. Records every Put,
 * serves Gets back from the in-memory store, and no-ops Deletes. The asset
 * routes treat it as a real bucket for the purposes of contract tests.
 */
function installInMemoryR2Stub(): void {
  const objects = new Map<string, StubbedObject>();
  __setHandleForTesting({
    bucket: "test-bucket",
    client: {
      send: async (command: unknown) => {
        const cmd = command as { constructor?: { name?: string }; input?: { Key?: string; Body?: Buffer; ContentType?: string } };
        const name = cmd.constructor?.name ?? "";
        const key = cmd.input?.Key ?? "";

        if (name === "PutObjectCommand") {
          objects.set(key, {
            body: Buffer.isBuffer(cmd.input?.Body)
              ? cmd.input!.Body
              : Buffer.from((cmd.input?.Body as Uint8Array | undefined) ?? []),
            contentType: cmd.input?.ContentType ?? "application/octet-stream",
          });
          return {};
        }
        if (name === "GetObjectCommand") {
          const stored = objects.get(key);
          if (!stored) {
            throw new Error(`Stubbed R2: object not found at key ${key}`);
          }
          return {
            Body: (async function* () {
              yield new Uint8Array(stored.body);
            })(),
          };
        }
        if (name === "DeleteObjectCommand") {
          objects.delete(key);
          return {};
        }
        return {};
      },
    },
  });
}

export async function createTestApp(): Promise<FastifyInstance> {
  installInMemoryR2Stub();
  await initDb();
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}

export function sessionHeaders(subject: string) {
  return {
    [TEST_SESSION_HEADER]: subject,
  };
}

/** Seed N user messages directly in the DB for a given userId */
export async function seedUserMessages(
  app: FastifyInstance,
  userId: string,
  count: number,
  createdAt?: string,
): Promise<void> {
  const { saveChatMessage } = await import("../db.js");
  for (let i = 0; i < count; i++) {
    await saveChatMessage(userId, "user", `test message ${i + 1}`, createdAt);
    await saveChatMessage(userId, "assistant", `test reply ${i + 1}`, createdAt);
  }
}

/** Create a user and return its ID */
export async function createTestUser(
  _app: FastifyInstance,
  name = "Test User",
  profile: object = {
    humanDesign: {
      type: "Generador Manifestante",
      strategy: "Responder",
      authority: "Emocional (Plexo Solar)",
      profile: "6/2",
      definition: "Definición dividida",
      incarnationCross: "Cruz de Ángulo Izquierdo de Industria 1",
      channels: [
        "Canal de Inspiración",
        "Canal del Pulso",
        "Canal del Despertar",
        "Canal de Carisma",
        "Canal del Reconocimiento",
        "Canal de la Comunidad",
        "Canal de la Exploración",
      ],
      activatedGates: [
        { number: 1 }, { number: 8 },   // Inspiración
        { number: 2 }, { number: 14 },  // Pulso
        { number: 10 }, { number: 20 }, // Despertar
        { number: 34 },                 // Carisma (20-34)
        { number: 30 }, { number: 41 }, // Reconocimiento
        { number: 37 }, { number: 40 }, // Comunidad
        { number: 55 },                 // + Exploración (10-34)
      ],
      definedCenters: ["G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart"],
      undefinedCenters: ["Head", "Ajna", "Spleen"],
    },
  },
  access: {
    email?: string | null;
    plan?: "free" | "basic" | "premium";
    role?: "user" | "admin";
    status?: "active" | "disabled" | "banned";
  } = {},
): Promise<string> {
  const { createUser } = await import("../db.js");

  return createUser(name, profile, access);
}

export async function createLinkedTestUser(
  _app: FastifyInstance,
  sessionSubject: string,
  name = "Linked Test User",
  profile: object = {
    humanDesign: {
      type: "Generador Manifestante",
      strategy: "Responder",
      authority: "Emocional (Plexo Solar)",
      profile: "6/2",
      definition: "Definición dividida",
      incarnationCross: "Cruz de Ángulo Izquierdo de Industria 1",
      channels: [
        "Canal de Inspiración",
        "Canal del Pulso",
        "Canal del Despertar",
        "Canal de Carisma",
        "Canal del Reconocimiento",
        "Canal de la Comunidad",
        "Canal de la Exploración",
      ],
      activatedGates: [
        { number: 1 }, { number: 8 },
        { number: 2 }, { number: 14 },
        { number: 10 }, { number: 20 },
        { number: 34 },
        { number: 30 }, { number: 41 },
        { number: 37 }, { number: 40 },
        { number: 55 },
      ],
      definedCenters: ["G", "Throat", "Sacral", "SolarPlexus", "Root", "Heart"],
      undefinedCenters: ["Head", "Ajna", "Spleen"],
    },
  },
  access: {
    email?: string | null;
    plan?: "free" | "basic" | "premium";
    role?: "user" | "admin";
    status?: "active" | "disabled" | "banned";
  } = {},
): Promise<string> {
  const { createUserWithIdentity } = await import("../db.js");

  return createUserWithIdentity(
    name,
    profile,
    "supertokens",
    sessionSubject,
    access,
  );
}
