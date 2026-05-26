export const ACTIVE_CHART_NAME_MAX_LENGTH = 60;

export function normalizeActiveChartName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getActiveChartNameError(value: string): string | null {
  const name = normalizeActiveChartName(value);
  if (!name) {
    return "Ingresá un nombre para esta carta.";
  }
  if (name.length > ACTIVE_CHART_NAME_MAX_LENGTH) {
    return "Usá un nombre más corto.";
  }
  if (/\p{C}/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) {
    return "Usá letras o números visibles.";
  }
  return null;
}
