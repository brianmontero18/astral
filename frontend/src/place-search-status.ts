export interface PlaceSearchStatusInput {
  query: string;
  loading: boolean;
  slow: boolean;
  timedOut: boolean;
  error: string | null;
  selected: boolean;
  resultCount: number;
  completed: boolean;
}

export type PlaceSearchStatus =
  | { kind: "idle" }
  | { kind: "loading"; tone: "muted"; message: string }
  | { kind: "slow"; tone: "muted"; message: string }
  | { kind: "timeout"; tone: "error"; message: string }
  | { kind: "error"; tone: "error"; message: string }
  | { kind: "empty"; tone: "muted"; message: string };

export function getPlaceSearchStatus(input: PlaceSearchStatusInput): PlaceSearchStatus {
  if (input.query.trim().length < 2 || input.selected) {
    return { kind: "idle" };
  }

  if (input.loading) {
    return input.slow
      ? {
          kind: "slow",
          tone: "muted",
          message: "Está tardando más de lo normal... seguimos buscando.",
        }
      : {
          kind: "loading",
          tone: "muted",
          message: "Buscando lugares...",
        };
  }

  if (input.timedOut) {
    return {
      kind: "timeout",
      tone: "error",
      message: "La búsqueda tardó demasiado. Probá de nuevo en un momento.",
    };
  }

  if (input.error) {
    return {
      kind: "error",
      tone: "error",
      message: "No pudimos buscar lugares ahora. Intentá de nuevo en un momento.",
    };
  }

  if (input.completed && input.resultCount === 0) {
    return {
      kind: "empty",
      tone: "muted",
      message: "No encontramos ese lugar. Probá con otro nombre u ortografía.",
    };
  }

  return { kind: "idle" };
}
