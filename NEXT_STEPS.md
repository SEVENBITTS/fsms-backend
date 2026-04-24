# NEXT STEP

## Goal
Use the structured post-operation evidence readiness endpoint in the operator workspace.

---

## Build

### 1. Workspace integration
- load `/missions/:missionId/post-operation/evidence-snapshots/:snapshotId/readiness`
- replace browser-derived evidence counts with backend readiness categories
- keep report/PDF links as the source of full audit detail

### 2. Operator clarity
- display readiness category messages as review prompts
- keep accountable-manager sign-off separate from readiness
- avoid legal compliance certification wording

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No automatic sign-off decision
- No legal compliance certification claim
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Workspace uses backend readiness for pre-sign-off evidence counts
- Empty evidence categories remain informational prompts
- Existing report/PDF export links still work
