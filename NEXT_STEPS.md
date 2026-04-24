# NEXT STEP

## Goal
Show secondary advisory decision-support context in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep secondary advisory rendering read-only
- show existing acknowledgement context when a secondary advisory has been recorded

### 2. Operator clarity
- show authority, evidence action, acknowledgement state, and pilot-instruction boundary in secondary advisory rows
- show the recorded guidance summary for acknowledged secondary advisories
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
- Secondary advisory rows display `not_a_pilot_command`
- Secondary acknowledged advisories display the preserved guidance summary
- No operational authority or direct-control behavior changes
