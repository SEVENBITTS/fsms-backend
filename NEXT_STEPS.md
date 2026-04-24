# NEXT STEP

## Goal
Refresh live-ops acknowledgement state after duplicate conflicts.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- detect duplicate acknowledgement conflict responses in the acknowledgement flow
- reload recorded acknowledgements after a duplicate conflict response
- re-render live operations so the recorded audit state is shown
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- keep the clear "already recorded" message for duplicate attempts
- replace stale buttons with the current recorded acknowledgement state
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
- Duplicate acknowledgement attempts refresh the local acknowledgement list
- The live-ops panel re-renders to show the existing audit record
- No operational authority or direct-control behavior changes
