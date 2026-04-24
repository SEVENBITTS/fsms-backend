# NEXT STEP

## Goal
Centralize live-ops prohibited-action wording.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- keep using existing advisory prohibited-action data
- use one formatter for "do not" text across primary, secondary, and audit summary displays
- preserve existing rendered wording
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- keep prohibited-action wording consistent wherever advisory context is shown
- avoid drift between displayed advisory warnings and stored audit summaries
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
- Primary advisory, secondary advisory, and audit summary use the same prohibited-action formatter
- Existing live-ops advisory wording remains parse-safe
- No operational authority or direct-control behavior changes
