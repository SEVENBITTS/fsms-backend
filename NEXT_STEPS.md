# NEXT STEP

## Goal
Show friendly duplicate acknowledgement errors in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- preserve backend error type/status in the live-ops fetch helper
- detect duplicate acknowledgement conflict responses in the acknowledgement flow
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- show a clear "already recorded" message for duplicate acknowledgement attempts
- avoid exposing raw backend conflict wording to operators
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
- Duplicate acknowledgement attempts display a clear live-ops message
- Other fetch failures still show their original messages
- No operational authority or direct-control behavior changes
