# NEXT STEP

## Goal
Allow regulatory impact alerts to be acknowledged or resolved from the workspace.

---

## Build

### 1. UI behavior
- show acknowledge and resolve buttons for impacted regulatory amendment alerts
- call the mission-scoped alert lifecycle API
- refresh the workspace after alert lifecycle actions
- keep alert closure separate from compliance acceptance

### 2. Operator clarity
- allow operators to record review workflow progress from the matrix panel
- make resolved amendment alerts drop out of the mission-specific impact list
- avoid presenting acknowledgement or resolution as legal compliance certification

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
- Impacted regulatory alerts can be acknowledged from the workspace
- Impacted regulatory alerts can be resolved from the workspace
- No operational authority, approval, or direct-control behavior changes
