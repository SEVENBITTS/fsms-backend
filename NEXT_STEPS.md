# NEXT STEP

## Goal
Add schema-backed SOP-linked change recommendations to mission evidence.

---

## Build

### 1. Operator visibility
- add migration-backed draft change recommendation records against linked SOP documents
- show which SOP code, SOP clause, and parent OA condition a recommendation relates to
- keep the recommendation visible in the post-operation review flow before accountable-manager sign-off

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep recommendations framed as accountable review prompts, not automatic SOP amendment or regulatory submission

### 3. Tests
- add backend, migration, and mission workspace UI tests for SOP-linked recommendation records
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Post-operation review can show draft recommendations linked to a specific SOP and parent OA condition
- Mission workspace shows recommendation state without implying the SOP has been amended automatically
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
