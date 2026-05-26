import React from "react";
import { describe, expect, it } from "vitest";

import { ReportRenderer } from "../../../frontend/src/components/ReportRenderer";
import { parseReport } from "../../../frontend/src/utils";

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

function collectByType(node: RenderNode, type: string): InspectableElement[] {
  if (!isInspectableElement(node)) return [];
  const current = node.type === type ? [node] : [];
  return current.concat(nodeChildren(node).flatMap((child) => collectByType(child, type)));
}

function textContent(node: RenderNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isInspectableElement(node)) return "";
  return nodeChildren(node).map(textContent).join("");
}

function summarize(node: RenderNode, depth = 0): string[] {
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node).trim();
    return text ? [`${"  ".repeat(depth)}text:${text}`] : [];
  }
  if (!isInspectableElement(node)) return [];

  const label = typeof node.type === "string" ? node.type : "component";
  const lines = [`${"  ".repeat(depth)}${label}`];
  for (const child of nodeChildren(node)) {
    lines.push(...summarize(child, depth + 1));
  }
  return lines;
}

describe("parseReport", () => {
  it("preserves double newlines as paragraph separators", () => {
    const sections = parseReport("Primer párrafo.\n\nSegundo párrafo.");

    expect(sections).toEqual([
      { icon: null, body: "Primer párrafo.\n\nSegundo párrafo." },
    ]);
  });

  it("does not treat inline section emojis as report headers", () => {
    const sections = parseReport("Esto me abrió el corazón ❤️ de una forma clara.\n\nSigo leyendo.");

    expect(sections).toEqual([
      {
        icon: null,
        body: "Esto me abrió el corazón ❤️ de una forma clara.\n\nSigo leyendo.",
      },
    ]);
  });

  it("does not treat words that merely start with a section label as headers", () => {
    const sections = parseReport("🔭 Panorama generalizado de la situación.\n\nSigue como texto.");

    expect(sections).toEqual([
      {
        icon: null,
        body: "🔭 Panorama generalizado de la situación.\n\nSigue como texto.",
      },
    ]);
  });

  it("keeps legacy section headers compatible without forcing them elsewhere", () => {
    const sections = parseReport("🔭 PANORAMA GENERAL\nUno.\n\nDos.");

    expect(sections).toEqual([
      { icon: "🔭", body: "Uno.\n\nDos." },
    ]);
  });
});

describe("ReportRenderer", () => {
  it("keeps default report typography editorial and exposes a readable chat variant", () => {
    const defaultTree = ReportRenderer({ text: "Texto del informe." });
    const chatTree = ReportRenderer({ text: "Texto del oráculo.", variant: "chat" });

    const defaultParagraph = collectByType(defaultTree, "p")[0];
    const chatParagraph = collectByType(chatTree, "p")[0];

    expect(defaultParagraph.props.style).toMatchObject({
      fontFamily: "var(--font-serif)",
      fontSize: "15px",
    });
    expect(chatParagraph.props.style).toMatchObject({
      fontFamily: "var(--font-sans)",
      fontSize: "16px",
      lineHeight: 1.7,
    });
  });

  it("renders paragraphs, bullets, bold and italic markdown light", () => {
    const tree = ReportRenderer({
      text: [
        "Primer párrafo con **énfasis fuerte**.",
        "",
        "Segundo párrafo con *énfasis suave*.",
        "",
        "- Acción concreta",
        "- Otra acción",
      ].join("\n"),
    });

    const paragraphs = collectByType(tree, "p");
    const strong = collectByType(tree, "strong");
    const emphasis = collectByType(tree, "em");
    const lists = collectByType(tree, "ul");
    const items = collectByType(tree, "li");

    expect(paragraphs.map(textContent)).toEqual([
      "Primer párrafo con énfasis fuerte.",
      "Segundo párrafo con énfasis suave.",
    ]);
    expect(strong.map(textContent)).toEqual(["énfasis fuerte"]);
    expect(emphasis.map(textContent)).toEqual(["énfasis suave"]);
    expect(lists).toHaveLength(1);
    expect(items.map(textContent)).toEqual(["Acción concreta", "Otra acción"]);
  });

  it("renders a long legacy report as separate paragraphs inside section cards", () => {
    const tree = ReportRenderer({
      text: [
        "🔭 PANORAMA GENERAL",
        "Párrafo uno con **dato clave**.",
        "",
        "Párrafo dos mantiene su aire.",
        "",
        "Párrafo tres no se pega.",
        "",
        "Párrafo cuatro con *matiz*.",
        "",
        "- Acción una",
        "- Acción dos",
        "",
        "⚡ ENERGÍA & CUERPO",
        "Otro bloque uno.",
        "",
        "Otro bloque dos.",
        "",
        "Otro bloque tres.",
        "",
        "Otro bloque cuatro.",
      ].join("\n"),
    });

    expect(summarize(tree).join("\n")).toMatchInlineSnapshot(`
      "div
        div
          div
            span
              component
            span
              text:Panorama General
          p
            text:Párrafo uno con
            strong
              text:dato clave
            text:.
          p
            text:Párrafo dos mantiene su aire.
          p
            text:Párrafo tres no se pega.
          p
            text:Párrafo cuatro con
            em
              text:matiz
            text:.
          ul
            li
              text:Acción una
            li
              text:Acción dos
        div
          div
            span
              component
            span
              text:Energía & Cuerpo
          p
            text:Otro bloque uno.
          p
            text:Otro bloque dos.
          p
            text:Otro bloque tres.
          p
            text:Otro bloque cuatro."
    `);
  });
});
