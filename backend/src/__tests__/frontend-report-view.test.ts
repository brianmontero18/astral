import React from "react";
import { describe, expect, it } from "vitest";

import { ReportView } from "../../../frontend/src/components/ReportView";
import type { DesignReport } from "../../../frontend/src/types";

type RenderNode = React.ReactNode;
type InspectableElement = {
  type: unknown;
  props: { children?: React.ReactNode };
};

function isInspectableElement(node: RenderNode): node is InspectableElement {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

function nodeChildren(node: InspectableElement): React.ReactNode[] {
  const { children } = node.props;
  if (children === undefined || children === null || typeof children === "boolean") return [];
  return Array.isArray(children) ? children.flat() : [children];
}

function textContent(node: RenderNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isInspectableElement(node)) return "";
  return nodeChildren(node).map(textContent).join("");
}

function buildReport(): DesignReport {
  return {
    id: "report-1",
    userId: "user-1",
    tier: "free",
    profileHash: "hash",
    tokensUsed: 0,
    costUsd: 0,
    createdAt: "2026-05-25T00:00:00.000Z",
    sections: [
      {
        id: "mechanical-chart",
        title: "Tu Carta Mecánica",
        icon: "⚙️",
        tier: "free",
        staticContent: "chart",
      },
    ],
  };
}

describe("ReportView", () => {
  it("shows generation errors even when an older report is still visible", () => {
    const tree = ReportView({
      report: buildReport(),
      loading: false,
      errorMessage: "Hubo un error temporal. Intentá en unos minutos.",
      onBack: () => {},
    });

    expect(textContent(tree)).toContain("Hubo un error temporal. Intentá en unos minutos.");
  });
});
