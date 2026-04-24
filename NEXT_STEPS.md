# NEXT STEP

## Goal
Let operators create the post-operation evidence snapshot from the workspace after mission completion.

---

## Build

### 1. Workspace action
- add a post-operation snapshot helper for completed missions
- call the existing `POST /missions/:missionId/post-operation/evidence-snapshots` endpoint
- refresh the evidence pack links after snapshot creation

### 2. Operator clarity
- show the action only as evidence capture, not sign-off or certification
- keep accountable-manager sign-off as a separate workflow
- explain that the snapshot freezes current post-operation evidence for later audit review

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No automated accountable-manager sign-off
- No legal compliance certification claim
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Completed missions can capture a post-operation evidence snapshot from the workspace
- The workspace refreshes and exposes report/PDF links for the new snapshot
- Evidence capture remains separate from sign-off and compliance acceptance
