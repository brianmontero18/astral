/**
 * Cargador del .env.production.
 *
 * Importá este módulo PRIMERO en cualquier script de prod-audits. Lee
 * `backend/.env.production` con node:fs y vuelca cada key=value a
 * process.env. NO usa la librería `dotenv` (no es dependencia del backend)
 * y NO carga el `.env` de desarrollo: es deliberado que apunten a archivos
 * distintos para que no se mezclen credenciales por accidente.
 *
 * Si el archivo no existe → error claro con instrucciones.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../../.env.production");

if (!existsSync(ENV_PATH)) {
  console.error(`Missing ${ENV_PATH}`);
  console.error(`Create it by copying the template at backend/scripts/prod-audits/README.md (section "Setup").`);
  process.exit(1);
}

const raw = readFileSync(ENV_PATH, "utf-8");
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let value = line.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (key && process.env[key] === undefined) {
    process.env[key] = value;
  }
}

const REQUIRED = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN_READ"] as const;
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required keys in .env.production: ${missing.join(", ")}`);
  process.exit(1);
}
