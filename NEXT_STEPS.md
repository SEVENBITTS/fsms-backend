# NEXT STEP

## Goal
Show mission-specific regulatory review impact in the workspace.

---

## Build

### 1. UI behavior
- fetch regulatory review impact for the selected mission
- summarize open amendment alerts, impacted matrix rows, and clause-review count
- mark impacted regulatory matrix rows ahead of non-impacted rows
- show review reason and alert IDs for impacted mappings

### 2. Operator clarity
- connect amendment alerts to the rows they affect
- make mission-specific review workload visible beside the global matrix
- avoid presenting the matrix as a legal compliance certification

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No legal compliance certification claim
- No direct aircraft control
- No automated dispatch approval
- No BVLOS command authority yet

---

## Done When
- Operator workspace displays mission-specific regulatory review impact
- Impacted matrix rows are highlighted with review reason and alert IDs
- No operational authority, approval, or direct-control behavior changes
