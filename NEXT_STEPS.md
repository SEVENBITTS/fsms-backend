# NEXT STEP

## Goal
Show secondary advisory rationale in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing advisory rationale data
- enrich secondary advisory rows with the guidance rationale
- leave primary advisory rendering unchanged
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- show why secondary advisory guidance was generated
- keep the existing summary, role, timing, and audit context visible
- do not add any automated avoidance or direct-control behavior

### 3. Tests
- static live-ops script parses cleanly
- TypeScript build still passes
- no backend API or schema change is introduced

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Secondary advisory rows include rationale text
- Existing secondary acknowledgement/audit context remains visible
- No operational authority or direct-control behavior changes
