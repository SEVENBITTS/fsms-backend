# NEXT STEP

## Goal
Separate traffic bearing and CPA conflict labels in live operations.

---

## Build

### 1. Operator visibility
- label ownship mission heading separately from relative traffic bearing
- make range/bearing read as current relative position from mission aircraft to traffic or boundary
- make CPA read as a future closest-approach calculation, not a range/bearing line

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep conflict guidance framed as advisory situational awareness, not pilot command authority
- keep map annotations clear about whether they are current telemetry, relative position, or predicted future CPA

### 3. Tests
- add live-ops UI bundle tests for heading, relative bearing, and CPA wording
- run mission-planning/live-ops UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Mission heading is displayed or toggleable in the telemetry/status surface
- Traffic range/bearing labels explicitly identify the reference point
- CPA labels explicitly describe predicted closest approach and time/separation
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
