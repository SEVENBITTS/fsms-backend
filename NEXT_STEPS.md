# NEXT STEP

## Goal
Add post-operation readiness prompts for live-ops map view-state evidence.

---

## Build

### 1. Operator visibility
- add a readiness category for live-ops map view-state snapshots
- show whether recent map evidence exists before accountable-manager review
- keep this as a review prompt only, not an automatic rejection or compliance certificate

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve the metadata-only and not-pilot-command wording in readiness summaries

### 3. Tests
- add focused readiness tests for present and missing map view-state evidence
- run audit-evidence focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Post-operation readiness includes a live-ops map view-state category
- Readiness output clearly distinguishes missing map evidence from hard failure
- Readiness summary preserves metadata-only, not-pilot-command boundaries
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
