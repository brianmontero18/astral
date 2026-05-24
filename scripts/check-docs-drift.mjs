#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const currentStateDocs = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/INDEX.md",
  "docs/architecture/project-overview.md",
  "docs/architecture/bug-investigation-daniela-2026-05.md",
  "docs/architecture/chat-llm-system.md",
  "docs/architecture/bodygraph-render.md",
  "docs/admin-auth-invite-handoff.md",
  "docs/chat-v2-rollout.md",
  "docs/uat-coverage-audit.md",
];

const obsoleteStrings = [
  "backend/src/report-service.ts",
  "report-service.test.ts",
  "api-extract.test.ts",
  "passwordless-email.test.ts",
  "backend/src/auth/passwordless-email.ts",
  "BodygraphPoc.tsx",
  "frontend/src/components/admin/",
  "Vision fallback gated",
  "extraction Vision",
  "Fallback Vision only",
  "Extrae profile con GPT-4o Vision",
  "rasteriza el SVG completo a PNG con `sharp`",
];

const pathPattern =
  /\b(?:backend|frontend|e2e|docs|scripts)\/[A-Za-z0-9._~+@:/-]+/g;

function readDoc(file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    return { file, missing: true, text: "" };
  }
  return { file, missing: false, text: fs.readFileSync(abs, "utf8") };
}

function normalizeCandidate(candidate) {
  return candidate
    .replace(/[),.;:'"`\]]+$/g, "")
    .replace(/#.*$/g, "");
}

function shouldSkipCandidate(candidate, nextChar = "") {
  return (
    nextChar === "*" ||
    candidate.includes("*") ||
    candidate.includes("...") ||
    candidate.endsWith("/") ||
    candidate.endsWith("-") ||
    candidate.startsWith("docs/research/2026-05-")
  );
}

const failures = [];

for (const doc of currentStateDocs.map(readDoc)) {
  if (doc.missing) {
    failures.push(`${doc.file}: current-state doc is missing`);
    continue;
  }

  for (const stale of obsoleteStrings) {
    if (doc.text.includes(stale)) {
      failures.push(`${doc.file}: obsolete reference found: ${stale}`);
    }
  }

  for (const raw of doc.text.matchAll(pathPattern)) {
    const candidate = normalizeCandidate(raw[0]);
    const nextChar = doc.text[raw.index + raw[0].length] ?? "";
    if (shouldSkipCandidate(candidate, nextChar)) continue;

    const abs = path.join(root, candidate);
    if (!fs.existsSync(abs)) {
      failures.push(`${doc.file}: referenced path does not exist: ${candidate}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation drift check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Documentation drift check passed.");
