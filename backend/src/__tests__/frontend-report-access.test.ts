import { describe, expect, it } from "vitest";

import { getAccessibleReportTier } from "../../../frontend/src/report-access";

describe("frontend report access", () => {
  it("keeps free/basic on the base report tier and unlocks premium in place", () => {
    expect(getAccessibleReportTier("free")).toBe("free");
    expect(getAccessibleReportTier("basic")).toBe("free");
    expect(getAccessibleReportTier("premium")).toBe("premium");
  });
});
