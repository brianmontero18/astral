/**
 * Cliente Turso para auditorías de prod.
 *
 * Dos modos:
 * - `read` (default): devuelve un wrapper que solo expone execute/batch/close
 *   contra el TURSO_AUTH_TOKEN_READ (read-only en el dashboard de Turso). Como
 *   cinturón, el wrapper inspecciona cada SQL y rechaza UPDATE/DELETE/INSERT/etc.
 *   `transaction()` está bloqueado en read mode (es superficie de escritura).
 * - `write`: devuelve el `Client` directo de @libsql con el TURSO_AUTH_TOKEN_WRITE.
 *   Imprime un banner grande la primera vez que se invoca.
 *
 * Importá `./prod-env.js` ANTES de usar este módulo, sino las env vars no
 * están cargadas.
 */
import {
  createClient,
  type Client,
  type InArgs,
  type InStatement,
  type ResultSet,
} from "@libsql/client";

const WRITE_OP = /^\s*(UPDATE|DELETE|INSERT|DROP|ALTER|CREATE|REPLACE|TRUNCATE|MERGE|UPSERT|PRAGMA\s+writable_schema)/i;

export type ProdMode = "read" | "write";

function guard(sql: string): void {
  if (WRITE_OP.test(sql)) {
    throw new Error(
      `[prod-db read mode] write operation refused. SQL: ${sql.slice(0, 120)}…\n` +
        `If you need to mutate prod, use createProdClient("write") with intent.`,
    );
  }
}

export class ReadOnlyTursoClient {
  constructor(private readonly inner: Client) {}

  async execute(stmt: InStatement, args?: InArgs): Promise<ResultSet> {
    const sql = typeof stmt === "string" ? stmt : stmt.sql;
    guard(sql);
    return this.inner.execute(stmt as InStatement, args as InArgs);
  }

  async batch(stmts: Array<InStatement>): Promise<ResultSet[]> {
    for (const s of stmts) guard(typeof s === "string" ? s : s.sql);
    return this.inner.batch(stmts);
  }

  async close(): Promise<void> {
    await this.inner.close();
  }

  transaction(): never {
    throw new Error(
      "[prod-db read mode] transaction refused — read mode is single-statement only.",
    );
  }
}

let warnedWrite = false;

function readInner(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN_READ;
  if (!url || !token) {
    throw new Error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN_READ missing");
  }
  return createClient({ url, authToken: token });
}

function writeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN_WRITE;
  if (!url || !token) {
    throw new Error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN_WRITE missing");
  }
  if (!warnedWrite) {
    warnedWrite = true;
    console.error(
      "\n" +
        "================================================================\n" +
        "  ⚠  PROD WRITE CLIENT ACTIVE  ⚠\n" +
        "  Any statement executed will hit production. Be sure.\n" +
        "================================================================\n",
    );
  }
  return createClient({ url, authToken: token });
}

// Overloads para que TypeScript sepa que en modo `write` devuelve Client
// completo (con transaction, etc.) y en modo `read` devuelve el wrapper restringido.
export function createProdClient(mode: "write"): Client;
export function createProdClient(mode?: "read"): ReadOnlyTursoClient;
export function createProdClient(mode: ProdMode = "read"): Client | ReadOnlyTursoClient {
  return mode === "write" ? writeClient() : new ReadOnlyTursoClient(readInner());
}
