# NEXT STEP

## Goal
Expose accountable-manager sign-off status and creation from the post-operation evidence workspace.

---

## Build

### 1. Workspace action
- add a sign-off helper beside the post-operation evidence pack
- call the existing `POST /missions/:missionId/post-operation/evidence-snapshots/:snapshotId/signoffs` endpoint
- disable sign-off until a post-operation evidence snapshot exists

### 2. Operator clarity
- keep sign-off separate from evidence capture
- make clear that sign-off records internal review acceptance, not legal certification
- show the latest sign-off state after the workspace refreshes

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No legal compliance certification claim
- No automatic approval/signature generation
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Operators can create one accountable-manager sign-off for a captured post-operation snapshot
- Duplicate sign-off attempts remain blocked by the backend
- Evidence capture, sign-off, and compliance acceptance stay visibly separate
