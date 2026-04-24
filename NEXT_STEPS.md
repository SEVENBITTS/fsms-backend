# NEXT STEP

## Goal
Add backend audit snapshot capture for live-ops map view-state metadata.

---

## Build

### 1. Operator visibility
- add a backend endpoint to record live-ops map view-state metadata as audit evidence
- capture mission, replay cursor, area freshness filter, overlay counts, alerts, and conflicts
- keep screenshot/file generation out of scope for this step
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused API tests for live-ops view-state evidence capture
- run audit/live-ops focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can record a map view-state evidence snapshot without creating files
- Evidence includes replay cursor, freshness filter, overlay counts, alerts, and conflicts
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
