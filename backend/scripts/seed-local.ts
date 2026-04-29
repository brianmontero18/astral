import { createClient, type Client } from "@libsql/client";

import { getCurrentChatUsageCycle } from "../src/chat-limits.js";
import { initDb } from "../src/db.js";
import { SECTION_META, type DesignReport, type ReportTier } from "../src/report/types.js";

type Plan = "free" | "basic" | "premium";
type Role = "user" | "admin";
type Status = "active" | "disabled" | "banned";

interface SeedUser {
  id: string;
  name: string;
  email: string | null;
  plan: Plan;
  role?: Role;
  status?: Status;
  linked?: boolean;
  identitySubject?: string;
  intake?: Record<string, unknown> | null;
  memoryMd?: string | null;
  userMessagesThisCycle?: number;
  assistantMessages?: number;
  reports?: ReportTier[];
  llmCalls?: number;
}

const DB_URL = process.env.TURSO_DATABASE_URL ?? "file:./astral.db";
const DB_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const SHOULD_RESET = !process.argv.includes("--no-reset");

const PROFILE = {
  name: "Seed User",
  humanDesign: {
    type: "Generador",
    strategy: "Esperar para responder",
    authority: "Emocional",
    profile: "6/2",
    definition: "Simple",
    incarnationCross: "Cruz del Angulo Derecho del Eden",
    notSelfTheme: "Frustracion",
    variable: "PRR DRR",
    digestion: "Paz y quietud",
    environment: "Mercados",
    strongestSense: "Tacto",
    channels: [{ id: "20-34", name: "Canal de Carisma", circuit: "Integracion" }],
    activatedGates: [{ number: 34, line: 2, planet: "Sol", isPersonality: true }],
    definedCenters: ["Sacral", "Throat"],
    undefinedCenters: ["Head", "Ajna", "G", "Heart", "Spleen", "SolarPlexus", "Root"],
  },
};

const BUSINESS_INTAKE = {
  actividad: "Mentora de negocios digitales",
  desafio_actual: "Ordenar la oferta sin sobreactuar visibilidad",
  tipo_de_negocio: "mentora",
  objetivo_12m: "Lanzar un programa premium con 20 clientas",
  voz_marca: "Calida, directa y estrategica",
};

const SEED_USERS: SeedUser[] = [
  {
    id: "seed-free-new",
    name: "Free Nueva",
    email: "free.nueva@astral.local",
    plan: "free",
    linked: true,
    identitySubject: "st-seed-free-new",
    intake: null,
  },
  {
    id: "seed-free-limit",
    name: "Free Limite",
    email: "free.limite@astral.local",
    plan: "free",
    linked: true,
    identitySubject: "st-seed-free-limit",
    intake: BUSINESS_INTAKE,
    userMessagesThisCycle: 20,
    assistantMessages: 4,
    reports: ["free"],
    llmCalls: 3,
  },
  {
    id: "seed-basic-active",
    name: "Basic Activa",
    email: "basic.activa@astral.local",
    plan: "basic",
    linked: true,
    identitySubject: "st-seed-basic-active",
    intake: { ...BUSINESS_INTAKE, tipo_de_negocio: "coach" },
    userMessagesThisCycle: 12,
    assistantMessages: 6,
    reports: ["free"],
    llmCalls: 5,
  },
  {
    id: "seed-premium-active",
    name: "Premium Activa",
    email: "premium.activa@astral.local",
    plan: "premium",
    linked: true,
    identitySubject: "st-seed-premium-active",
    intake: { ...BUSINESS_INTAKE, tipo_de_negocio: "servicios_premium" },
    memoryMd: "- Prefiere decisiones despues de dormirlas.\n- Esta preparando una oferta high-ticket.",
    userMessagesThisCycle: 42,
    assistantMessages: 10,
    reports: ["free", "premium"],
    llmCalls: 8,
  },
  {
    id: "seed-admin",
    name: "Admin Local",
    email: "admin@astral.local",
    plan: "premium",
    role: "admin",
    linked: true,
    identitySubject: "st-seed-admin",
    userMessagesThisCycle: 2,
  },
  {
    id: "seed-disabled",
    name: "Usuario Disabled",
    email: "disabled@astral.local",
    plan: "basic",
    status: "disabled",
    linked: true,
    identitySubject: "st-seed-disabled",
  },
  {
    id: "seed-banned",
    name: "Usuario Banned",
    email: "banned@astral.local",
    plan: "free",
    status: "banned",
    linked: true,
    identitySubject: "st-seed-banned",
  },
  {
    id: "seed-unlinked",
    name: "Sin Identidad",
    email: "unlinked@astral.local",
    plan: "free",
    linked: false,
    intake: BUSINESS_INTAKE,
  },
];

function client(): Client {
  return createClient({
    url: DB_URL,
    ...(DB_AUTH_TOKEN && { authToken: DB_AUTH_TOKEN }),
  });
}

async function resetData(db: Client) {
  await db.batch(
    [
      "PRAGMA foreign_keys = ON",
      "DELETE FROM report_shares",
      "DELETE FROM hd_reports",
      "DELETE FROM assets",
      "DELETE FROM chat_messages",
      "DELETE FROM llm_calls",
      "DELETE FROM user_identities",
      "DELETE FROM users",
      "DELETE FROM transit_cache",
      "DELETE FROM sqlite_sequence WHERE name IN ('chat_messages','llm_calls')",
    ],
    "write",
  );
}

function sqliteTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join(" ");
}

function cycleTimestamp(offsetMinutes: number): string {
  const { windowStartUtc } = getCurrentChatUsageCycle();
  const base = new Date(`${windowStartUtc.replace(" ", "T")}Z`);
  base.setUTCMinutes(base.getUTCMinutes() + offsetMinutes);
  return sqliteTimestamp(base);
}

function buildReport(user: SeedUser, tier: ReportTier): DesignReport {
  return {
    id: `${user.id}-report-${tier}`,
    userId: user.id,
    tier,
    profileHash: `${user.id}-${tier}-profile-hash`,
    sections: SECTION_META.map((section) => ({
      id: section.id,
      title: section.title,
      icon: section.icon,
      tier: section.tier,
      staticContent: section.tier === "free" ? `${section.title} seed para ${user.name}.` : "",
      llmContent:
        tier === "premium" || section.tier === "free"
          ? `Lectura aplicada seed de ${section.title.toLowerCase()} para ${user.name}.`
          : undefined,
      previewContent: tier === "free" ? section.previewContent : undefined,
      teaser: section.teaser,
    })),
    tokensUsed: tier === "premium" ? 4200 : 1200,
    costUsd: tier === "premium" ? 0.012 : 0.003,
    createdAt: new Date().toISOString(),
  };
}

async function insertUser(db: Client, user: SeedUser) {
  await db.execute({
    sql: `
      INSERT INTO users (id, name, email, profile, intake, plan, role, status, memory_md, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
    args: [
      user.id,
      user.name,
      user.email,
      JSON.stringify({ ...PROFILE, name: user.name }),
      user.intake ? JSON.stringify(user.intake) : null,
      user.plan,
      user.role ?? "user",
      user.status ?? "active",
      user.memoryMd ?? null,
    ],
  });

  if (user.linked !== false) {
    await db.execute({
      sql: "INSERT INTO user_identities (id, user_id, provider, provider_user_id) VALUES (?, ?, ?, ?)",
      args: [`identity-${user.id}`, user.id, "supertokens", user.identitySubject ?? `st-${user.id}`],
    });
  }
}

async function insertMessages(db: Client, user: SeedUser) {
  const userCount = user.userMessagesThisCycle ?? 0;
  const assistantCount = user.assistantMessages ?? 0;

  for (let index = 0; index < userCount; index += 1) {
    await db.execute({
      sql: "INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, 'user', ?, ?)",
      args: [user.id, `Mensaje seed ${index + 1} de ${user.name}`, cycleTimestamp(index + 1)],
    });
  }

  for (let index = 0; index < assistantCount; index += 1) {
    await db.execute({
      sql: "INSERT INTO chat_messages (user_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)",
      args: [user.id, `Respuesta seed ${index + 1} para ${user.name}`, cycleTimestamp(200 + index)],
    });
  }
}

async function insertReports(db: Client, user: SeedUser) {
  for (const tier of user.reports ?? []) {
    const report = buildReport(user, tier);
    await db.execute({
      sql: `
        INSERT INTO hd_reports (id, user_id, tier, profile_hash, content, tokens_used, cost_usd, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      args: [
        report.id,
        user.id,
        tier,
        report.profileHash,
        JSON.stringify(report),
        report.tokensUsed,
        report.costUsd,
      ],
    });
  }
}

async function insertLlmCalls(db: Client, user: SeedUser) {
  for (let index = 0; index < (user.llmCalls ?? 0); index += 1) {
    await db.execute({
      sql: `
        INSERT INTO llm_calls (user_id, route, model, tokens_in, tokens_out, cost_usd, latency_ms, prompt_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        user.id,
        index % 3 === 0 ? "report" : "chat",
        index % 2 === 0 ? "gpt-4o-mini" : "gpt-4o",
        900 + index * 20,
        350 + index * 10,
        0.001 + index * 0.0005,
        1200 + index * 100,
        `seed-hash-${user.id}-${index}`,
        cycleTimestamp(400 + index),
      ],
    });
  }
}

async function seed() {
  await initDb();
  const db = client();

  if (SHOULD_RESET) {
    await resetData(db);
  } else {
    for (const user of SEED_USERS) {
      await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [user.id] });
    }
  }

  for (const user of SEED_USERS) {
    await insertUser(db, user);
    await insertMessages(db, user);
    await insertReports(db, user);
    await insertLlmCalls(db, user);
  }

  const counts = await db.execute({
    sql: `
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM user_identities) AS identities,
        (SELECT COUNT(*) FROM chat_messages WHERE role = 'user') AS user_messages,
        (SELECT COUNT(*) FROM hd_reports) AS reports,
        (SELECT COUNT(*) FROM llm_calls) AS llm_calls
    `,
    args: [],
  });

  const row = counts.rows[0] ?? {};
  console.log(`Seed local listo (${SHOULD_RESET ? "reset + seed" : "seed sin reset"}):`);
  console.log(`- users: ${row.users}`);
  console.log(`- identities: ${row.identities}`);
  console.log(`- user messages: ${row.user_messages}`);
  console.log(`- reports: ${row.reports}`);
  console.log(`- llm calls: ${row.llm_calls}`);
  console.log("");
  console.log("Usuarios principales:");
  for (const user of SEED_USERS) {
    console.log(`- ${user.email ?? "sin email"} | ${user.plan} | ${user.role ?? "user"} | ${user.status ?? "active"} | ${user.id}`);
  }
}

seed().catch((error) => {
  console.error("Seed local fallo:", error);
  process.exitCode = 1;
});
