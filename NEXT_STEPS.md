# NEXT STEP

## Goal
Add representative airspace and refresh provenance data to the live-ops demo seed.

---

## Build

### 1. Demo data richness
- add area-conflict/airspace overlays to the seeded live-ops demo
- include source refresh run records with fresh, partial, and failed statuses
- keep existing replay, alert, crewed traffic, drone traffic, weather, and conflict data intact

### 2. Product boundary
- use deterministic local demo data only
- do not scrape external feeds or imply live CAA/NOTAM ingestion
- keep provenance review informational and auditable

### 3. Tests
- add focused seed/API assertions for area overlays and refresh provenance
- run live-ops/external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- A freshly seeded live-ops mission has route, alert, traffic, weather, area overlays, and refresh provenance data
- The operator live-ops page can render a richer map closer to the end-state visual
- The demo remains clearly synthetic and safe for local presentation
