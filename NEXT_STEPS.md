# NEXT STEP

## Goal
Show post-operation readiness prompts in the operator mission workspace.

---

## Build

### 1. Operator visibility
- fetch post-operation readiness for the selected evidence snapshot in the mission workspace
- render readiness categories, sign-off status, and advisory review prompts
- make missing evidence categories visible without presenting them as automatic failures

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve metadata-only and not-pilot-command wording for map view-state evidence

### 3. Tests
- add focused mission workspace UI tests for readiness output
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operator workspace shows post-operation evidence readiness categories
- Missing readiness categories are labelled as review prompts, not hard failures
- Sign-off state is visible beside the evidence snapshot
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
