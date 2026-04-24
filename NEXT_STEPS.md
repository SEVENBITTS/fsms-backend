# NEXT STEP

## Goal
Align live-ops acknowledgement prompt with required review role.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep sending the acknowledgement role required by the advisory
- default the acknowledgement prompt to the required role
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- make supervisor-required acknowledgements visibly ask for supervisor acknowledgement
- make operator-required acknowledgements visibly ask for operator acknowledgement
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
- Live-ops acknowledgement prompts reflect the required role
- Posted acknowledgements still send the same validated role to the backend
- No operational authority or direct-control behavior changes
