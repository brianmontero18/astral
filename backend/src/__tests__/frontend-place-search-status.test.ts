import { describe, expect, it } from "vitest";

import {
  getPlaceSearchStatus,
  type PlaceSearchStatusInput,
} from "../../../frontend/src/place-search-status";

function status(overrides: Partial<PlaceSearchStatusInput> = {}) {
  return getPlaceSearchStatus({
    query: "ciudad ojeda",
    loading: false,
    slow: false,
    timedOut: false,
    error: null,
    selected: false,
    resultCount: 0,
    completed: true,
    ...overrides,
  });
}

describe("frontend place search status", () => {
  it("does not show stale empty/error copy while a query is loading", () => {
    expect(status({ loading: true, error: "server error" })).toEqual({
      kind: "loading",
      tone: "muted",
      message: "Buscando lugares...",
    });

    expect(status({ loading: true, slow: true, error: "server error" })).toEqual({
      kind: "slow",
      tone: "muted",
      message: "Está tardando más de lo normal... seguimos buscando.",
    });
  });

  it("prioritizes provider failures over the empty-results state", () => {
    expect(status({ error: "GEONAMES_USERNAME no configurado" })).toEqual({
      kind: "error",
      tone: "error",
      message: "No pudimos buscar lugares ahora. Intentá de nuevo en un momento.",
    });
  });

  it("shows empty-results copy only for completed searches with no selection", () => {
    expect(status({ query: "c" })).toEqual({ kind: "idle" });
    expect(status({ selected: true })).toEqual({ kind: "idle" });
    expect(status({ resultCount: 2 })).toEqual({ kind: "idle" });
    expect(status({ completed: false })).toEqual({ kind: "idle" });

    expect(status()).toEqual({
      kind: "empty",
      tone: "muted",
      message: "No encontramos ese lugar. Probá con otro nombre u ortografía.",
    });
  });
});
