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

const changedFiles = getChangedFiles(BASE_REF);

const suggestions = [];
const has = (pattern) => changedFiles.some((f) => pattern.test(f));

if (has(/^src\/missions\//)) {
  suggestions.push("Add mission transition validation for the changed mission flow");
}

if (has(/^src\/services\//)) {
  suggestions.push("Add integration coverage for the changed service-layer business logic");
}

if (has(/^src\/routes\//)) {
  suggestions.push("Add request and response validation for the changed route contract");
}

if (has(/^src\/repositories\//)) {
  suggestions.push("Add repository-level coverage for the changed persistence path");
}

if (has(/^src\/validation\//)) {
  suggestions.push("Wire changed validation logic into the execution path");
}

if (has(/^src\/migrations\//)) {
  suggestions.push("Validate migration behavior against a clean Postgres test database");
}

if (has(/^\.github\/workflows\//)) {
  suggestions.push("Verify CI behavior for the updated workflow on a fresh push");
}

if (suggestions.length === 0) {
  suggestions.push("Define the next executable system change based on the current diff");
}

console.log("Suggested nextBuildStep candidates:\n");
for (const s of suggestions) {
  console.log(`- ${s}`);
}