import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(import.meta.dirname, "../../../frontend/src/index.css"),
  "utf8",
);

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("dark-card readability typography", () => {
  it("uses readable sans typography for Mi Carta supporting captions", () => {
    expect(cssBlock(".mychart-side-caption")).toContain(
      "font-family: var(--font-sans)",
    );
    expect(cssBlock(".mychart-side-caption")).toContain("font-style: normal");
  });

  it("keeps Mi Carta variable section titles subordinate to dense content", () => {
    expect(cssBlock(".mychart-variables-title")).toContain("font-size: 16px");
  });

  it("keeps profile popover metadata readable on dark cards", () => {
    expect(cssBlock(".profile-panel .profile-value")).toContain(
      "font-family: var(--font-sans)",
    );
  });
});
