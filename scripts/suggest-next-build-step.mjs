import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE_REF = process.argv[2] || "origin/main";
const OUTPUT_FILE = process.argv[3] || "";

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
    return {
      pass: false,
      reason: "current `nextBuildStep` is empty",
    };
  }

  if (value === "TBD") {
    return {
      pass: false,
      reason: "`nextBuildStep` cannot be `TBD`",
    };
  }

  if (value.includes("\n")) {
    return {
      pass: false,
      reason: "`nextBuildStep` must be a single action, not multiple lines",
    };
  }

  if (/[;•]/.test(value)) {
    return {
      pass: false,
      reason: "`nextBuildStep` must describe one action, not a list",
    };
  }

  if (/^(improve|fix things|misc|cleanup|refactor|work on|continue|stuff)$/i.test(value)) {
    return {
      pass: false,
      reason: "`nextBuildStep` is too vague",
    };
  }

  if (/^(investigate|consider|think about|look into|review)\b/i.test(value)) {
    return {
      pass: false,
      reason: "`nextBuildStep` is exploratory, not directly executable",
    };
  }

  if (
    !/^(add|create|implement|wire|split|enforce|build|migrate|connect|write|define|validate|generate|deploy|test|document|remove|replace|introduce|extract|verify|update)\b/i.test(
      value
    )
  ) {
    return {
      pass: false,
      reason: "`nextBuildStep` should start with a concrete action verb",
    };
  }

  return {
    pass: true,
    reason: "current `nextBuildStep` looks actionable",
  };
}

const changedFiles = getChangedFiles(BASE_REF);
const suggestions = [];
const has = (pattern) => changedFiles.some((f) => pattern.test(f));

if (has(/^src\/missions\//)) {
  suggestions.push("Add integration coverage for the changed mission transition or error-handling path");
}

if (has(/^src\/services\//)) {
  suggestions.push("Add service-layer validation or integration coverage for the changed business logic");
}

if (has(/^src\/routes\//)) {
  suggestions.push("Add request and response contract coverage for the changed route behavior");
}

if (has(/^src\/repositories\//)) {
  suggestions.push("Add repository-level verification for the changed persistence path");
}

if (has(/^src\/validation\//)) {
  suggestions.push("Wire the changed validation rule into the execution path and verify rejection behavior");
}

if (has(/^src\/migrations\//)) {
  suggestions.push("Validate the changed migration path against a clean Postgres test database");
}

if (has(/^\.github\/workflows\//)) {
  suggestions.push("Verify CI behavior for the updated workflow on a fresh pull request run");
}

if (suggestions.length === 0) {
  suggestions.push("Define the next executable system change based on the current diff");
}

const savePoint = readCurrentSavePoint();
const currentNextBuildStep = normalize(savePoint?.nextBuildStep);
const assessment = assessNextBuildStep(currentNextBuildStep);
const suggestedReplacement = suggestions[0];

const statusLine = assessment.pass
  ? `✅ Pass — ${assessment.reason}.`
  : `❌ Fail — ${assessment.reason}.`;

const body = [
  "### Suggested `nextBuildStep` review",
  "",
  "**Current `nextBuildStep`**",
  "",
  currentNextBuildStep ? `> ${currentNextBuildStep}` : "> _(missing)_",
  "",
  "**Assessment**",
  "",
  statusLine,
  "",
  "**Suggested replacement**",
  "",
  `> ${suggestedReplacement}`,
  "",
  "**Other candidate suggestions**",
  "",
  ...suggestions.map((s) => `- ${s}`),
].join("\n");

console.log(body);

if (OUTPUT_FILE) {
  fs.writeFileSync(OUTPUT_FILE, body, "utf8");
}