# NEXT STEP

## Goal
Add an operator path from post-operation readiness to live-ops map evidence capture.

---

## Build

### 1. Operator visibility
- add a clear mission workspace link to open the live-ops map evidence capture/history view
- show the link near the map view-state readiness prompt when map evidence is missing or present
- keep the operator action path explicit: capture metadata in live ops, review it in post-operation evidence

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- preserve metadata-only and not-pilot-command wording for the capture link and readiness prompt

### 3. Tests
- add focused mission workspace UI tests for live-ops evidence capture links
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operator workspace provides a direct live-ops map evidence capture/history link
- Link points at the currently loaded mission live-operations page
- Copy remains explicit that map evidence is metadata-only and not pilot command guidance
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
