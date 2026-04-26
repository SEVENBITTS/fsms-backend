# NEXT STEP

## Goal
Add visual focus handling for source-record drill-down targets.

---

## Build

### 1. Operator visibility
- read drill-down query parameters such as map evidence ID and conflict acknowledgement ID
- highlight the matching source record in live-ops evidence history or conflict review context
- highlight timeline/regulatory sections when opened from the mission workspace drill-down cards

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep visual focus framed as audit review support, not compliance certification or automated closure

### 3. Tests
- add focused live-ops and mission workspace UI tests for drill-down focus state
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Source-record drill-down links visually focus the relevant record or review section
- Focus state remains shareable by URL and safe when the referenced record is missing
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
