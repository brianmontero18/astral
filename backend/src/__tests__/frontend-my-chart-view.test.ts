import { describe, expect, it } from "vitest";

import { buildMyChartBodygraphSrc } from "../../../frontend/src/components/MyChartView";

describe("MyChartView", () => {
  it("cache-busts the bodygraph image when profile revision changes", () => {
    expect(buildMyChartBodygraphSrc(0)).toBe(
      "/api/me/bodygraph/chart-svg?width=900&revision=0",
    );
    expect(buildMyChartBodygraphSrc(2)).toBe(
      "/api/me/bodygraph/chart-svg?width=900&revision=2",
    );
  });
});
