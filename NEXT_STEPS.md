# NEXT STEP

## Goal
Guard live-ops acknowledgement capture when guidance summary is missing.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- only post acknowledgements when guidance summary evidence is present
- show a clear local error before posting if the summary is missing
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- prevent confusing backend validation failures for missing summary evidence
- keep the operator in the same live-ops view when evidence capture is incomplete
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
- Live ops does not submit acknowledgement requests without guidance summary evidence
- Missing summary evidence produces a visible local error
- No operational authority or direct-control behavior changes
