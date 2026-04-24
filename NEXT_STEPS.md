# NEXT STEP

## Goal
Make the post-operation evidence pack easier to retrieve from the operator workspace.

---

## Build

### 1. Workspace access
- show a post-operation evidence export area for completed missions
- link to the rendered audit report and PDF export endpoints
- keep export access read-only and separate from mission approval or sign-off

### 2. Operator clarity
- explain that the export is an evidence pack, not a compliance certificate
- surface whether accountable-manager sign-off is pending or recorded
- make regulatory amendment review records visible as part of the export context

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No legal compliance certification claim
- No automated accountable-manager sign-off
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Completed missions expose report/PDF evidence pack links in the workspace
- Pending vs recorded sign-off state is clear to the operator
- Regulatory amendment review evidence remains audit/export-only
