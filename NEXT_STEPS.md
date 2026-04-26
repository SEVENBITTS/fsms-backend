# NEXT STEP

## Goal
Add accountable review outcomes for safety and regulatory source records.

---

## Build

### 1. Operator visibility
- add lightweight review outcome controls to safety/SOP and regulatory source-record panels
- capture review state such as noted, needs action, or accepted for evidence pack
- show latest review outcome next to the source record before accountable-manager sign-off

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep review outcomes framed as internal accountable review notes, not compliance certification or regulatory submission

### 3. Tests
- add backend and mission workspace UI tests for source-record review outcomes
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Safety/SOP and regulatory source records can carry an explicit accountable review outcome
- Mission workspace shows latest outcome state without implying certification or automatic closure
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
