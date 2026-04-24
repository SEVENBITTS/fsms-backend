# NEXT STEP

## Goal
Show conflict-guidance acknowledgement context in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- show the recorded guidance summary after acknowledgement
- show the recorded pilot instruction boundary after acknowledgement

### 2. Operator clarity
- make the live-ops audit record show what was reviewed, not only who recorded it
- keep `not_a_pilot_command` visible beside the acknowledgement
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
- Recorded acknowledgements in live ops display the guidance summary
- Recorded acknowledgements in live ops display `not_a_pilot_command`
- No operational authority or direct-control behavior changes
