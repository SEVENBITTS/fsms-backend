# NEXT STEP

## Goal
Add OA amendment acceptance and SOP change communication tracking.

---

## Build

### 1. Operator visibility
- add schema-backed state for SOP recommendation progression through OA amendment acceptance
- record controlling-authority acceptance before a recommended SOP change can be marked implemented
- add accountable-manager communication evidence for notifying affected parties and drawing attention to accepted OA/SOP changes

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep recommendations framed as internal accountable review records until the OA amendment is accepted by the controlling authority
- do not treat draft SOP recommendations as operating instructions or implemented procedures

### 3. Tests
- add backend and mission workspace tests for OA amendment acceptance and accountable-manager notification evidence
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- SOP recommendation implementation state cannot move past pending until controlling-authority OA amendment acceptance is recorded
- Accountable managers can record communication evidence for affected parties after acceptance
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
