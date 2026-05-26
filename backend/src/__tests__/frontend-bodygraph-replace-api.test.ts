import { afterEach, describe, expect, it, vi } from "vitest";

import {
  replaceBodygraphConfirmed,
  replaceBodygraphFromBirthConfirmed,
} from "../../../frontend/src/api";

describe("frontend bodygraph replace API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the active chart display name with PDF replace requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const file = new File(["%PDF"], "chart.pdf", { type: "application/pdf" });
    await replaceBodygraphConfirmed(file, "Carta Nueva");

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(body).toBeInstanceOf(FormData);
    if (!(body instanceof FormData)) {
      throw new Error("Expected PDF replace request body to be FormData");
    }
    expect(body.get("confirmReplace")).toBe("true");
    expect(body.get("name")).toBe("Carta Nueva");
    expect(body.get("file")).toBe(file);
  });

  it("sends the active chart display name with birth-data replace requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    await replaceBodygraphFromBirthConfirmed({
      name: "Carta Nueva",
      date: "1991-03-04",
      time: "11:22",
      place: {
        lat: -34.61,
        lon: -58.38,
        label: "Buenos Aires, Argentina",
      },
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      confirmReplace: true,
      name: "Carta Nueva",
      date: "1991-03-04",
      time: "11:22",
    });
  });
});
