# NEXT STEP

## Goal
Show recent live-ops map view-state audit snapshots in the operator UI.

---

## Build

### 1. Operator visibility
- fetch recent map view-state evidence snapshots after loading live ops
- show the latest recorded snapshot ID, timestamp, replay cursor, area freshness filter, overlay counts, alerts, and conflicts
- refresh the recent snapshot list after the operator records a new snapshot
- keep the display as audit metadata only, not screenshot/export evidence

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep snapshot history separate from pilot command guidance

### 3. Tests
- add focused API/static tests for listing map view-state snapshot history in live ops
- run mission-planning and audit-evidence focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can see the most recent backend-recorded map view-state evidence snapshots
- Recording a new snapshot updates the visible recent snapshot history
- Snapshot history shows metadata fields without implying screenshot/file capture
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
