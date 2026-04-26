# NEXT STEP

## Goal
Build replay on top of telemetry history.

---

## Build

### 1. Replay service
- read telemetry history for mission
- return ordered records for time-window replay

### 2. Replay endpoint
- `GET /missions/:id/replay?from=...&to=...`

### 3. Tests
- respects ordering
- respects mission isolation
- respects requested time range

---

## Do NOT do
- No UI
- No auth
- No performance optimization yet

---

## Done When
- Replay data can be fetched for a mission and range
- Covered by integration tests