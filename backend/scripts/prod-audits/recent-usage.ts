/**
 * Quick read-only usage audit.
 *
 * Uso:
 *   ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts
 *   ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts --days 14
 *   ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts --since 2026-05-28
 *   ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts --json
 */
import "./lib/prod-env.js";
import { createProdClient } from "./lib/prod-db.js";

interface Options {
  days: number;
  since?: string;
  json: boolean;
  help: boolean;
  messageLimit: number;
}

interface DayUserKey {
  day: string;
  userId: string;
}

interface DayUserUsage {
  day: string;
  userId: string;
  name: string | null;
  email: string | null;
  firstAt: string | null;
  lastAt: string | null;
  chat: {
    userMessages: number;
    assistantMessages: number;
  };
  llm: {
    calls: number;
    tokensIn: number;
    tokensOut: number;
    cachedTokens: number;
    toolCalls: number;
    zeroToolCalls: number;
    routes: Record<string, number>;
    models: Record<string, number>;
  };
  mcp: {
    events: number;
    tools: Record<string, number>;
    failures: number;
  };
  assets: {
    created: number;
    fileTypes: Record<string, number>;
  };
}

interface RecentMessage {
  createdAt: string;
  name: string | null;
  email: string | null;
  preview: string;
}

interface Report {
  generatedAt: string;
  since: string;
  dailyUsage: DayUserUsage[];
  recentUserMessages: RecentMessage[];
}

type Value = string | number | bigint | null;

const DEFAULT_DAYS = 7;
const DEFAULT_MESSAGE_LIMIT = 20;

function parseArgs(argv: string[]): Options {
  const options: Options = {
    days: DEFAULT_DAYS,
    json: false,
    help: false,
    messageLimit: DEFAULT_MESSAGE_LIMIT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--days") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--days must be a positive number");
      }
      options.days = value;
      i += 1;
    } else if (arg === "--since") {
      const value = argv[i + 1];
      if (!value) throw new Error("--since requires YYYY-MM-DD or timestamp");
      options.since = value;
      i += 1;
    } else if (arg === "--message-limit") {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value < 0) {
        throw new Error("--message-limit must be a non-negative number");
      }
      options.messageLimit = value;
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`Usage:
  ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts [options]

Options:
  --days <n>             Look back n days. Default: ${DEFAULT_DAYS}
  --since <date>         Start at YYYY-MM-DD or timestamp. Overrides --days.
  --message-limit <n>    Number of recent user-message previews. Default: ${DEFAULT_MESSAGE_LIMIT}
  --json                 Print structured JSON.
  --help, -h             Show this help.

Examples:
  ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts --days 7
  ./node_modules/.bin/tsx scripts/prod-audits/recent-usage.ts --since 2026-05-28 --json
`);
}

function sinceExpression(options: Options): { sql: string; args: Value[]; label: string } {
  if (options.since) {
    return { sql: "?", args: [options.since], label: options.since };
  }
  return {
    sql: "datetime('now', ?)",
    args: [`-${options.days} days`],
    label: `last ${options.days} day(s)`,
  };
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function keyFor(key: DayUserKey): string {
  return `${key.day}::${key.userId}`;
}

function preview(content: string | null): string {
  if (!content) return "";
  return content.replace(/\s+/g, " ").trim().slice(0, 220);
}

function addCount(target: Record<string, number>, key: string | null, count: number): void {
  const normalized = key && key.length > 0 ? key : "unknown";
  target[normalized] = (target[normalized] ?? 0) + count;
}

function ensureUsage(
  usageByKey: Map<string, DayUserUsage>,
  input: {
    day: string;
    userId: string;
    name: string | null;
    email: string | null;
    firstAt: string | null;
    lastAt: string | null;
  },
): DayUserUsage {
  const mapKey = keyFor({ day: input.day, userId: input.userId });
  const existing = usageByKey.get(mapKey);
  if (existing) {
    existing.firstAt = earlier(existing.firstAt, input.firstAt);
    existing.lastAt = later(existing.lastAt, input.lastAt);
    return existing;
  }

  const created: DayUserUsage = {
    day: input.day,
    userId: input.userId,
    name: input.name,
    email: input.email,
    firstAt: input.firstAt,
    lastAt: input.lastAt,
    chat: {
      userMessages: 0,
      assistantMessages: 0,
    },
    llm: {
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      cachedTokens: 0,
      toolCalls: 0,
      zeroToolCalls: 0,
      routes: {},
      models: {},
    },
    mcp: {
      events: 0,
      tools: {},
      failures: 0,
    },
    assets: {
      created: 0,
      fileTypes: {},
    },
  };
  usageByKey.set(mapKey, created);
  return created;
}

function earlier(current: string | null, candidate: string | null): string | null {
  if (!current) return candidate;
  if (!candidate) return current;
  return candidate < current ? candidate : current;
}

function later(current: string | null, candidate: string | null): string | null {
  if (!current) return candidate;
  if (!candidate) return current;
  return candidate > current ? candidate : current;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "-";
  return entries.map(([key, count]) => `${key}:${count}`).join(", ");
}

async function buildReport(options: Options): Promise<Report> {
  const client = createProdClient("read");
  const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  const tables = new Set(tablesResult.rows.map((row) => String(row.name)));
  const since = sinceExpression(options);
  const usageByKey = new Map<string, DayUserUsage>();

  if (tables.has("chat_messages")) {
    const result = await client.execute({
      sql: `
        SELECT
          substr(cm.created_at, 1, 10) AS day,
          cm.user_id,
          u.name,
          u.email,
          min(cm.created_at) AS first_at,
          max(cm.created_at) AS last_at,
          sum(CASE WHEN cm.role = 'user' THEN 1 ELSE 0 END) AS user_messages,
          sum(CASE WHEN cm.role = 'assistant' THEN 1 ELSE 0 END) AS assistant_messages
        FROM chat_messages cm
        LEFT JOIN users u ON u.id = cm.user_id
        WHERE cm.created_at >= ${since.sql}
        GROUP BY day, cm.user_id, u.name, u.email
      `,
      args: since.args,
    });

    for (const row of result.rows) {
      const usage = ensureUsage(usageByKey, {
        day: String(row.day),
        userId: String(row.user_id),
        name: asString(row.name),
        email: asString(row.email),
        firstAt: asString(row.first_at),
        lastAt: asString(row.last_at),
      });
      usage.chat.userMessages += asNumber(row.user_messages);
      usage.chat.assistantMessages += asNumber(row.assistant_messages);
    }
  }

  if (tables.has("llm_calls")) {
    const result = await client.execute({
      sql: `
        SELECT
          substr(lc.created_at, 1, 10) AS day,
          lc.user_id,
          u.name,
          u.email,
          lc.route,
          lc.model,
          count(*) AS calls,
          min(lc.created_at) AS first_at,
          max(lc.created_at) AS last_at,
          sum(coalesce(lc.tokens_in, 0)) AS tokens_in,
          sum(coalesce(lc.tokens_out, 0)) AS tokens_out,
          sum(coalesce(lc.cached_tokens, 0)) AS cached_tokens,
          sum(coalesce(lc.tool_calls_count, 0)) AS tool_calls,
          sum(CASE WHEN coalesce(lc.tool_calls_count, 0) = 0 THEN 1 ELSE 0 END) AS zero_tool_calls
        FROM llm_calls lc
        LEFT JOIN users u ON u.id = lc.user_id
        WHERE lc.created_at >= ${since.sql}
        GROUP BY day, lc.user_id, u.name, u.email, lc.route, lc.model
      `,
      args: since.args,
    });

    for (const row of result.rows) {
      const calls = asNumber(row.calls);
      const usage = ensureUsage(usageByKey, {
        day: String(row.day),
        userId: String(row.user_id),
        name: asString(row.name),
        email: asString(row.email),
        firstAt: asString(row.first_at),
        lastAt: asString(row.last_at),
      });
      usage.llm.calls += calls;
      usage.llm.tokensIn += asNumber(row.tokens_in);
      usage.llm.tokensOut += asNumber(row.tokens_out);
      usage.llm.cachedTokens += asNumber(row.cached_tokens);
      usage.llm.toolCalls += asNumber(row.tool_calls);
      usage.llm.zeroToolCalls += asNumber(row.zero_tool_calls);
      addCount(usage.llm.routes, asString(row.route), calls);
      addCount(usage.llm.models, asString(row.model), calls);
    }
  }

  if (tables.has("mcp_audit_events")) {
    const result = await client.execute({
      sql: `
        SELECT
          substr(mae.created_at, 1, 10) AS day,
          mae.user_id,
          u.name,
          u.email,
          mae.tool_name,
          mae.status,
          count(*) AS events,
          min(mae.created_at) AS first_at,
          max(mae.created_at) AS last_at
        FROM mcp_audit_events mae
        LEFT JOIN users u ON u.id = mae.user_id
        WHERE mae.created_at >= ${since.sql}
        GROUP BY day, mae.user_id, u.name, u.email, mae.tool_name, mae.status
      `,
      args: since.args,
    });

    for (const row of result.rows) {
      const events = asNumber(row.events);
      const usage = ensureUsage(usageByKey, {
        day: String(row.day),
        userId: String(row.user_id),
        name: asString(row.name),
        email: asString(row.email),
        firstAt: asString(row.first_at),
        lastAt: asString(row.last_at),
      });
      usage.mcp.events += events;
      addCount(usage.mcp.tools, asString(row.tool_name), events);
      if (asString(row.status) !== "success") usage.mcp.failures += events;
    }
  }

  if (tables.has("assets")) {
    const result = await client.execute({
      sql: `
        SELECT
          substr(a.created_at, 1, 10) AS day,
          a.user_id,
          u.name,
          u.email,
          a.file_type,
          count(*) AS assets_created,
          min(a.created_at) AS first_at,
          max(a.created_at) AS last_at
        FROM assets a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.created_at >= ${since.sql}
        GROUP BY day, a.user_id, u.name, u.email, a.file_type
      `,
      args: since.args,
    });

    for (const row of result.rows) {
      const assetsCreated = asNumber(row.assets_created);
      const usage = ensureUsage(usageByKey, {
        day: String(row.day),
        userId: String(row.user_id),
        name: asString(row.name),
        email: asString(row.email),
        firstAt: asString(row.first_at),
        lastAt: asString(row.last_at),
      });
      usage.assets.created += assetsCreated;
      addCount(usage.assets.fileTypes, asString(row.file_type), assetsCreated);
    }
  }

  const recentUserMessages: RecentMessage[] = [];
  if (tables.has("chat_messages") && options.messageLimit > 0) {
    const result = await client.execute({
      sql: `
        SELECT cm.created_at, u.name, u.email, cm.content
        FROM chat_messages cm
        LEFT JOIN users u ON u.id = cm.user_id
        WHERE cm.created_at >= ${since.sql}
          AND cm.role = 'user'
        ORDER BY cm.created_at DESC
        LIMIT ?
      `,
      args: [...since.args, options.messageLimit],
    });

    for (const row of result.rows) {
      recentUserMessages.push({
        createdAt: String(row.created_at),
        name: asString(row.name),
        email: asString(row.email),
        preview: preview(asString(row.content)),
      });
    }
  }

  await client.close();

  return {
    generatedAt: new Date().toISOString(),
    since: since.label,
    dailyUsage: [...usageByKey.values()].sort((a, b) => {
      const byDay = b.day.localeCompare(a.day);
      if (byDay !== 0) return byDay;
      return String(b.lastAt).localeCompare(String(a.lastAt));
    }),
    recentUserMessages,
  };
}

function printHuman(report: Report): void {
  console.log(`=== Astral prod usage · ${report.since} ===`);
  console.log(`Generated at: ${report.generatedAt}`);
  console.log("");

  if (report.dailyUsage.length === 0) {
    console.log("No usage found.");
  } else {
    for (const row of report.dailyUsage) {
      console.log(`${row.day} · ${row.name ?? "Unknown"} <${row.email ?? "no-email"}>`);
      console.log(`  window: ${row.firstAt ?? "-"} → ${row.lastAt ?? "-"}`);
      console.log(
        `  chat: user=${row.chat.userMessages}, assistant=${row.chat.assistantMessages}`,
      );
      console.log(
        `  llm: calls=${row.llm.calls}, tokens_in=${row.llm.tokensIn}, ` +
          `tokens_out=${row.llm.tokensOut}, cached=${row.llm.cachedTokens}, ` +
          `tools=${row.llm.toolCalls}, zero_tool_calls=${row.llm.zeroToolCalls}`,
      );
      console.log(`  llm routes: ${formatCounts(row.llm.routes)}`);
      console.log(`  llm models: ${formatCounts(row.llm.models)}`);
      console.log(
        `  mcp: events=${row.mcp.events}, failures=${row.mcp.failures}, tools=${formatCounts(row.mcp.tools)}`,
      );
      console.log(
        `  assets: created=${row.assets.created}, file_types=${formatCounts(row.assets.fileTypes)}`,
      );
      console.log("");
    }
  }

  if (report.recentUserMessages.length > 0) {
    console.log("Recent user messages:");
    for (const message of report.recentUserMessages) {
      console.log(
        `- ${message.createdAt} · ${message.name ?? "Unknown"} ` +
          `<${message.email ?? "no-email"}>: ${message.preview}`,
      );
    }
  }
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}
const report = await buildReport(options);

if (options.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printHuman(report);
}
