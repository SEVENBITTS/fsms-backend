import { execSync } from "node:child_process";
import fs from "node:fs";

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

function readCurrentSavePoint() {
  try {
    return JSON.parse(fs.readFileSync("fsms-save-point.json", "utf8"));
  } catch {
    return null;
  }
}

function normalize(value) {
  return String(value ?? "").trim();
}

function assessNextBuildStep(step) {
  const value = normalize(step);

  if (!value) {
    return { pass: false, reason: "current `nextBuildStep` is empty" };
  }

  if (value === "TBD") {
    return { pass: false, reason: "`nextBuildStep` cannot be `TBD`" };
  }

  if (value.includes("\n")) {
    return { pass: false, reason: "`nextBuildStep` must be a single action, not multiple lines" };
  }

  if (/[;•]/.test(value)) {
    return { pass: false, reason: "`nextBuildStep` must describe one action, not a list" };
  }

  if (/^(improve|fix things|misc|cleanup|refactor|work on|continue|stuff)$/i.test(value)) {
    return { pass: false, reason: "`nextBuildStep` is too vague" };
  }

  if (/^(investigate|consider|think about|look into|review)\b/i.test(value)) {
    return { pass: false, reason: "`nextBuildStep` is exploratory, not directly executable" };
  }

  if (
    !/^(add|create|implement|wire|split|enforce|build|migrate|connect|write|define|validate|generate|deploy|test|document|remove|replace|introduce|extract|verify|update)\b/i.test(
      value
    )
  ) {
    return { pass: false, reason: "`nextBuildStep` should start with a concrete action verb" };
  }

  return { pass: true, reason: "current `nextBuildStep` looks actionable" };
}

function getChangedAreas(files) {
  const areas = new Set();

  for (const file of files) {
    if (/^src\/missions\//.test(file)) areas.add("missions");
    if (/^src\/services\//.test(file)) areas.add("services");
    if (/^src\/routes\//.test(file)) areas.add("routes");
    if (/^src\/repositories\//.test(file)) areas.add("repositories");
    if (/^src\/validation\//.test(file)) areas.add("validation");
    if (/^src\/migrations\//.test(file)) areas.add("migrations");
    if (/^\.github\/workflows\//.test(file)) areas.add("workflows");
  }

  return [...areas];
}

function getStepSignals(step) {
  const text = normalize(step).toLowerCase();
  const signals = new Set();

  if (/(mission|transition|error-handling|error handling)/.test(text)) signals.add("missions");
  if (/(service|business logic)/.test(text)) signals.add("services");
  if (/(route|request|response|contract|endpoint)/.test(text)) signals.add("routes");
  if (/(repository|persistence|database path|query)/.test(text)) signals.add("repositories");
  if (/(validation|reject|rejection|input rule)/.test(text)) signals.add("validation");
  if (/(migration|schema|postgres|database setup)/.test(text)) signals.add("migrations");
  if (/(ci|workflow|github actions|pipeline)/.test(text)) signals.add("workflows");

  return [...signals];
}

function assessAlignment(step, changedAreas) {
  if (changedAreas.length === 0) {
    return {
      pass: true,
      reason: "no recognized core areas changed in this diff",
      changedAreas,
      matchedAreas: [],
      stepSignals: [],
    };
  }

  const stepSignals = getStepSignals(step);
  const matchedAreas = changedAreas.filter((area) => stepSignals.includes(area));

  if (matchedAreas.length > 0) {
    return {
      pass: true,
      reason: `current \`nextBuildStep\` appears aligned with changed areas: ${matchedAreas.join(", ")}`,
      changedAreas,
      matchedAreas,
      stepSignals,
    };
  }

  return {
    pass: false,
    reason: `current \`nextBuildStep\` does not clearly match changed areas: ${changedAreas.join(", ")}`,
    changedAreas,
    matchedAreas,
    stepSignals,
  };
}

const changedFiles = getChangedFiles(BASE_REF);
const savePoint = readCurrentSavePoint();
const currentNextBuildStep = normalize(savePoint?.nextBuildStep);

const quality = assessNextBuildStep(currentNextBuildStep);
const changedAreas = getChangedAreas(changedFiles);
const alignment = assessAlignment(currentNextBuildStep, changedAreas);

if (!quality.pass) {
  console.error(`nextBuildStep quality check failed: ${quality.reason}`);
  process.exit(1);
}

if (!alignment.pass) {
  console.error(`nextBuildStep alignment check failed: ${alignment.reason}`);
  process.exit(1);
}

console.log("nextBuildStep PR gate passed.");
console.log(`Quality: ${quality.reason}`);
console.log(`Alignment: ${alignment.reason}`);