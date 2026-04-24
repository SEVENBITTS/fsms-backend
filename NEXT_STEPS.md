# NEXT STEP

## Goal
Add live-ops visual indicators for area overlay freshness on the map.

---

## Build

### 1. Operator visibility
- draw or label area overlays with fresh, partial, failed, or carried-forward status
- make degraded overlay freshness visible without hiding the route or traffic picture
- keep the map read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for map freshness indicators
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can see area overlay freshness directly on the map surface
- Degraded or carried-forward overlays are visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
