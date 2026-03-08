import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGeneticMatrixPdf } from "./genetic-matrix.js";
import { parseMyHumanDesignPdf } from "./myhumandesign.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

function fixturePath(filename: string): string {
  return path.join(repoRoot, "test-assets", "bodygraph-sources", filename);
}

test("MyHumanDesign PDF fixture parses and validates", async () => {
  const buffer = await readFile(fixturePath("myhumandesign-chart.pdf"));
  const gates = await parseMyHumanDesignPdf(buffer);
  assert.equal(gates.length, 26);
});

test("Genetic Matrix PDF fixture parses and validates", async () => {
  const buffer = await readFile(fixturePath("chart1773003080.pdf"));
  const gates = await parseGeneticMatrixPdf(buffer);
  assert.equal(gates.length, 26);
});
