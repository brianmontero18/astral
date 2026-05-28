import { existsSync, readFileSync } from "node:fs";

const lockFiles = [
  "package-lock.json",
  "backend/package-lock.json",
  "frontend/package-lock.json",
];

const blockedPatterns = [
  /furycloud/i,
  /artifacts\.fury/i,
  /registry\..*\.mercadolibre/i,
];

const offenders = [];

for (const file of lockFiles) {
  if (!existsSync(file)) {
    continue;
  }

  const content = readFileSync(file, "utf8");
  for (const pattern of blockedPatterns) {
    if (pattern.test(content)) {
      offenders.push({ file, pattern: pattern.source });
      break;
    }
  }
}

if (offenders.length > 0) {
  console.error("");
  console.error("ERROR: package-lock contains private/internal registry URLs.");
  for (const offender of offenders) {
    console.error(`- ${offender.file} matched /${offender.pattern}/`);
  }
  console.error("");
  console.error("Fix: regenerate or edit the affected lock file so resolved URLs use https://registry.npmjs.org.");
  process.exit(1);
}

console.log("Lock files clean (public npm only)");
