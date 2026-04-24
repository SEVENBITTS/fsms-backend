# NEXT STEP

## Goal
Improve live-ops map evidence history readability.

---

## Build

### 1. Operator visibility
- add age/status cues to recent map view-state evidence snapshots
- make the latest captured metadata snapshot stand out in live ops
- keep replay cursor, freshness filter, overlay counts, alerts, conflicts, and capture boundary visible

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve metadata-only and not-pilot-command wording in the snapshot history

### 3. Tests
- add focused live-ops UI tests for evidence history readability copy
- run live-operations UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Recent map view-state snapshots clearly show latest/older status
- History cards show enough metadata to support post-operation review
- Copy remains explicit that map evidence is metadata-only and not pilot command guidance
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
