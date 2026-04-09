import fs from "node:fs";
import { execSync } from "node:child_process";

const BASE_REF = process.argv[2] || "origin/main";

function getChangedFiles(baseRef) {
  const output = execSync(`git diff --name-only ${baseRef}...HEAD`, {
    encoding: "utf8",
  });
  return output
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function readJsonAtRef(ref, filePath) {
  try {
    const content = execSync(`git show ${ref}:${filePath}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readWorkingTreeJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stableString(value) {
  return JSON.stringify(value ?? null);
}

const changedFiles = getChangedFiles(BASE_REF);

const coreChanged = changedFiles.some((file) =>
  /^(src\/missions|src\/services|src\/routes|src\/validation|src\/repositories)\//.test(file)
);

if (!coreChanged) {
  console.log("No core FSMS files changed. Semantic save-point rule not required.");
  process.exit(0);
}

const savepointChanged = changedFiles.includes("fsms-save-point.json");

if (!savepointChanged) {
  console.error("Core FSMS files changed, but fsms-save-point.json was not updated.");
  process.exit(1);
}

const previous = readJsonAtRef(BASE_REF, "fsms-save-point.json");
const current = readWorkingTreeJson("fsms-save-point.json");

if (!previous) {
  console.log("No prior fsms-save-point.json found on base ref. Semantic rule skipped.");
  process.exit(0);
}

const checks = [
  {
    name: "nextBuildStep",
    before: previous.nextBuildStep,
    after: current.nextBuildStep,
  },
  {
    name: "decisionsMade.architectural",
    before: previous.decisionsMade?.architectural,
    after: current.decisionsMade?.architectural,
  },
  {
    name: "decisionsMade.tradeoffsAccepted",
    before: previous.decisionsMade?.tradeoffsAccepted,
    after: current.decisionsMade?.tradeoffsAccepted,
  },
  {
    name: "decisionsMade.deferredDecisions",
    before: previous.decisionsMade?.deferredDecisions,
    after: current.decisionsMade?.deferredDecisions,
  },
];

const changedSemanticFields = checks
  .filter((item) => stableString(item.before) !== stableString(item.after))
  .map((item) => item.name);

if (changedSemanticFields.length === 0) {
  console.error("Core FSMS files changed, but no required semantic save-point fields changed.");
  console.error("Update at least one of:");
  console.error("- nextBuildStep");
  console.error("- decisionsMade.architectural");
  console.error("- decisionsMade.tradeoffsAccepted");
  console.error("- decisionsMade.deferredDecisions");
  process.exit(1);
}

console.log("Semantic save-point rule passed.");
console.log(`Changed semantic fields: ${changedSemanticFields.join(", ")}`);