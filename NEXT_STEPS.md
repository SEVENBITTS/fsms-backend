# NEXT STEP

## Goal
Add post-operation evidence readiness counts to audit report render output.

---

## Build

### 1. Operator visibility
- include readiness category counts in rendered post-operation evidence reports
- show present/not-recorded status for map view-state, conflict acknowledgement, safety closure, and amendment review categories
- keep sign-off readiness context visible alongside the report

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve review-prompt-only and not-compliance-certificate wording in report output

### 3. Tests
- add focused audit render/PDF tests for readiness category counts
- run audit-evidence focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Rendered report includes evidence readiness category counts/status
- PDF/plain text include review-prompt-only wording
- Sign-off state remains separate from evidence category readiness
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
