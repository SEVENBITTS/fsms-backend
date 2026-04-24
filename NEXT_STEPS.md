# NEXT STEP

## Goal
Persist the live-ops area freshness map filter in the URL.

---

## Build

### 1. Operator visibility
- store the active area freshness map filter in the live-ops query string
- restore all, degraded-only, or hidden filter state on reload
- keep shared demo links deterministic without changing backend mission state
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for URL filter persistence helpers
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can refresh or share the live-ops page with the same area freshness filter
- Invalid filter values safely fall back to the default all-overlays view
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
