# NEXT STEP

## Goal
Show secondary advisory source and replay relevance in live operations.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing advisory related-source and replay-relevance data
- enrich secondary advisory rows with source and relevance context
- leave primary advisory rendering unchanged
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- make secondary advisory context traceable back to the source layer
- show whether the advisory is current or near the replay window
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
- Secondary advisory rows include related source
- Secondary advisory rows include replay relevance
- No operational authority or direct-control behavior changes
