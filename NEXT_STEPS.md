# NEXT STEP

## Goal
Add schema-backed SOP recommendation review decisions to mission evidence.

---

## Build

### 1. Operator visibility
- add migration-backed accountable review decisions for SOP change recommendations
- capture decision state such as accepted for action, rejected, deferred, or closed
- show latest decision state beside the SOP recommendation before accountable-manager sign-off

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep decisions framed as internal accountable review records, not automatic SOP amendment or regulatory submission

### 3. Tests
- add backend, migration, and mission workspace UI tests for SOP recommendation review decisions
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- SOP recommendations can carry explicit accountable review decisions
- Mission workspace shows recommendation decision state without implying the SOP has been amended automatically
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
