# NEXT STEP

## Goal
Show area freshness filter context in live-ops status and provenance panels.

---

## Build

### 1. Operator visibility
- show the active area freshness map filter in the status panel
- summarize visible versus total area overlays after filtering
- keep degraded overlay freshness easy to audit without hiding route or traffic context
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for filter context rendering
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can see which area freshness filter is active
- Visible and total area overlay counts remain clear after filtering
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
