# NEXT STEP

## Goal
Wire the live-ops map UI to record backend map view-state audit snapshots.

---

## Build

### 1. Operator visibility
- add a "Record map view-state evidence" action to the live-ops metadata panel
- post replay cursor, area freshness filter, overlay counts, alerts, and conflicts to the backend snapshot endpoint
- show success/failure status without creating screenshots or local files
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep the new UI action labelled as metadata capture only

### 3. Tests
- add static/UI tests for the capture button, request payload, and safe status copy
- run mission-planning/live-ops focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can trigger a map view-state evidence snapshot from the live-ops page
- The UI sends replay cursor, freshness filter, overlay counts, alerts, and conflicts
- Success/failure feedback is visible without implying a screenshot/export happened
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
