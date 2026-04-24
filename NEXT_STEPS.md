# NEXT STEP

## Goal
Show secondary advisory audit record IDs in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing acknowledgement ID data
- enrich secondary advisory rows with the recorded audit record ID
- leave primary acknowledgement rendering unchanged
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- make secondary acknowledged advisories traceable to the evidence record
- keep the existing summary, role, and timing context visible
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
- Secondary acknowledged advisories show their audit record ID
- Unacknowledged secondary advisory rows remain unchanged
- Unacknowledged advisory status remains unchanged
- No operational authority or direct-control behavior changes
