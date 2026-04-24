# NEXT STEP

## Goal
Surface seeded airspace refresh provenance in the live-ops UI.

---

## Build

### 1. Operator visibility
- show airspace source refresh status in the live-ops side panel
- highlight carried-forward area overlays after partial or failed refreshes
- keep the map focused on operational awareness without adding pilot commands

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused UI/static assertions for refresh provenance rendering
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can see whether area overlays are fresh, partial, failed, or carried forward
- Failed or partial refresh state is visible without blocking the local demo
- The demo remains clearly synthetic and safe for local presentation
