# NEXT STEP

## Goal
Show the regulatory requirement matrix in the operator mission workspace.

---

## Build

### 1. UI behavior
- add a read-only regulatory requirement matrix panel
- fetch the existing SMS regulatory mapping endpoint
- summarize mapped requirements, source-mapped count, and clause-review count
- show source, requirement summary, platform control, evidence type, assurance owner, and review status

### 2. Operator clarity
- make CAA/CAP traceability visible without leaving the workspace
- keep unresolved clause review explicit
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
- Operator workspace displays the regulatory matrix
- Review status and evidence type are visible per mapped requirement
- No operational authority, approval, or direct-control behavior changes
