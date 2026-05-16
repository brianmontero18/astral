/**
 * R2 access for prod audits.
 *
 * Reusa el adapter R2 del backend (`src/storage/r2.ts`) que ya maneja
 * credenciales vía R2_* env vars. La única razón por la que este helper
 * existe es para que los scripts de auditoría llamen `getProdObject(key)`
 * en lugar de importar directamente desde `src/storage/r2.ts` — eso
 * mantiene el contrato "scripts de auditoría usan la lib de prod-audits"
 * uniforme y permite futura instrumentación (logging, cache, etc.) en un
 * solo lugar sin tocar el código del backend.
 *
 * Importá `./prod-env.js` ANTES de usar este módulo.
 */
import { getObject } from "../../../src/storage/r2.js";

export async function getProdObject(storageKey: string): Promise<Buffer> {
  return getObject(storageKey);
}
