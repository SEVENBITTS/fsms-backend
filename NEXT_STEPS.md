# NEXT STEP

## Goal
Add live-ops map view-state metadata for future evidence exports.

---

## Build

### 1. Operator visibility
- summarize the current map view state in a compact metadata block
- include replay cursor, area freshness filter, and visible overlay counts
- prepare the UI for later screenshot/export evidence without creating files yet
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for map view-state metadata
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can see the current map view-state metadata before export work begins
- Replay cursor and area freshness filter are represented consistently
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
