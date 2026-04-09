#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${1:-origin/main}"

changed_files="$(git diff --name-only "$BASE_REF"...HEAD)"

core_changed="false"
savepoint_changed="false"

while IFS= read -r file; do
  [[ -z "$file" ]] && continue

  # 👇 THIS is your updated rule
  if [[ "$file" =~ ^(src/missions|src/services|src/routes|src/validation|src/repositories)/ ]]; then
    core_changed="true"
  fi

  if [[ "$file" == "fsms-save-point.json" ]]; then
    savepoint_changed="true"
  fi
done <<< "$changed_files"

if [[ "$core_changed" == "true" && "$savepoint_changed" != "true" ]]; then
  echo "❌ Core FSMS files changed, but fsms-save-point.json was not updated."
  echo "Update the save point before merging."
  exit 1
fi

echo "✅ Save point update rule passed."