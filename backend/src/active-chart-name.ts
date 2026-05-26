export const ACTIVE_CHART_NAME_MAX_LENGTH = 60;

export type ActiveChartNameParse =
  | { ok: true; name: string }
  | { ok: false; status: number; error: string; message: string };

export function parseActiveChartName(value: unknown): ActiveChartNameParse {
  if (typeof value !== "string") {
    return { ok: false, status: 400, error: "invalid_name", message: "name must be a non-empty string" };
  }

  const name = value.trim().replace(/\s+/g, " ");
  if (!name) {
    return { ok: false, status: 400, error: "invalid_name", message: "name must be a non-empty string" };
  }
  if (name.length > ACTIVE_CHART_NAME_MAX_LENGTH) {
    return { ok: false, status: 400, error: "invalid_name", message: "name must be 60 characters or fewer" };
  }
  if (/\p{C}/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    return { ok: false, status: 400, error: "invalid_name", message: "name contains unsupported characters" };
  }

  return { ok: true, name };
}
