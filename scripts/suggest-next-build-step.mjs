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

const body = [
  "### Suggested `nextBuildStep`",
  "",
  ...suggestions.map((s) => `- ${s}`),
].join("\n");

console.log(body);

if (OUTPUT_FILE) {
  fs.writeFileSync(OUTPUT_FILE, body, "utf8");
}