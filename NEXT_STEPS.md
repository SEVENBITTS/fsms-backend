# NEXT STEP

## Goal
Add schema-backed mission workspace display for SOP recommendation decisions.

---

## Build

### 1. Operator visibility
- load schema-backed accountable review decisions for SOP change recommendations into the mission workspace
- show latest decision state beside each SOP recommendation before accountable-manager sign-off
- keep accepted, rejected, deferred, and closed states visually distinct from open recommendations

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep decisions framed as internal accountable review records, not automatic SOP amendment or regulatory submission

### 3. Tests
- add mission workspace UI tests for SOP recommendation review decision display
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Mission workspace shows latest schema-backed recommendation decision state without implying the SOP has been amended automatically
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
