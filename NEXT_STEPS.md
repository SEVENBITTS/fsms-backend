# NEXT STEP

## Goal
Show post-operation readiness context in live-ops map evidence capture.

---

## Build

### 1. Operator visibility
- show whether map view-state evidence is currently present for post-operation review
- surface the latest snapshot ID/count near the live-ops evidence capture control
- add a direct return link from live ops back to the mission workspace evidence summary

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve metadata-only and not-pilot-command wording in the capture readiness context

### 3. Tests
- add focused live-ops UI tests for readiness context and return link copy
- run live-operations UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Live-ops evidence capture shows whether metadata exists for post-operation review
- Operators can return from live ops to the mission workspace evidence summary
- Copy remains explicit that map evidence is metadata-only and not pilot command guidance
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
