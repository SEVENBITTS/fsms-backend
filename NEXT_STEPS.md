# NEXT STEP

## Goal
Add live-ops map controls for filtering area freshness overlays.

---

## Build

### 1. Operator visibility
- add a simple read-only control to show all, degraded-only, or hide area freshness overlays
- keep degraded overlay freshness easy to find without hiding the route or traffic picture
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for map freshness filter controls
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can filter area freshness overlays on the map surface
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
