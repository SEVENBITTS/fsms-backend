# NEXT STEP

## Goal
Show secondary advisory prohibited-action context in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing advisory prohibited-action data
- enrich secondary advisory rows with the "do not" context
- leave primary advisory rendering unchanged
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- show what operators should not treat the secondary advisory as authorising
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
- Secondary advisory rows include prohibited-action context
- Existing secondary acknowledgement/audit context remains visible
- No operational authority or direct-control behavior changes
