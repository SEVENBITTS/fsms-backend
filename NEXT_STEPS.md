# NEXT STEP

## Goal
Show acknowledgement review role in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing acknowledgement `acknowledgementRole` data
- enrich live-ops acknowledgement status text with review role
- show the review role in the recorded audit block
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- show who recorded the acknowledgement, in what role, and when
- keep the same status text available in primary and secondary advisory summaries
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
- Acknowledged advisories show recorded actor, role, and timestamp in status text
- Recorded primary acknowledgement blocks show the stored review role
- Unacknowledged advisory status remains unchanged
- No operational authority or direct-control behavior changes
