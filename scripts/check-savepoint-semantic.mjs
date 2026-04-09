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

function normalizeString(value) {
  return String(value ?? "").trim();
}

const changedFiles = getChangedFiles(BASE_REF);

const coreChanged = changedFiles.some((file) =>
  /^(src\/missions|src\/services|src\/routes|src\/validation|src\/repositories)\//.test(file)
);

if (!coreChanged) {
  console.log("No core FSMS files changed. nextBuildStep rule not required.");
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
  console.log("No prior fsms-save-point.json found on base ref. nextBuildStep rule skipped.");
  process.exit(0);
}

const previousNextBuildStep = normalizeString(previous.nextBuildStep);
const currentNextBuildStep = normalizeString(current.nextBuildStep);

if (previousNextBuildStep === currentNextBuildStep) {
  console.error("Core FSMS files changed, but nextBuildStep did not change.");
  console.error("Update fsms-save-point.json with a new immediate next development action.");
  process.exit(1);
}

if (currentNextBuildStep.length === 0 || currentNextBuildStep === "TBD") {
  console.error("nextBuildStep must be a real, non-empty action and cannot be 'TBD'.");
  process.exit(1);
}

console.log("nextBuildStep enforcement passed.");
console.log(`Previous: ${previousNextBuildStep}`);
console.log(`Current: ${currentNextBuildStep}`);