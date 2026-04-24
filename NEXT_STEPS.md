# NEXT STEP

## Goal
Surface rendered audit report readiness counts in the mission workspace.

---

## Build

### 1. Operator visibility
- show the rendered report readiness summary section in the mission workspace evidence panel
- keep category counts/status aligned with the backend rendered report
- make the report-readiness view distinct from accountable-manager sign-off

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve review-prompt-only and not-compliance-certificate wording in the workspace UI

### 3. Tests
- add focused mission workspace UI tests for rendered report readiness summary copy
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Mission workspace displays readiness counts from the rendered report
- Workspace still separates evidence category readiness from sign-off state
- Copy remains explicit that readiness is review-prompt-only, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
