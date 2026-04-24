# NEXT STEP

## Goal
Store richer live-ops guidance context in acknowledgements.

---

## Build

### 1. API behavior
- keep using the existing conflict-guidance acknowledgement API
- send a richer guidance summary from live ops when recording an acknowledgement
- include recommendation, rationale, prohibited action warning, and pilot-instruction boundary
- keep the acknowledgement action as evidence capture only

### 2. Operator clarity
- preserve what the operator/supervisor actually reviewed
- make the stored summary explicitly say `not_a_pilot_command`
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
- New live-ops acknowledgement summaries include recommendation and rationale
- New live-ops acknowledgement summaries include prohibited action and pilot-instruction boundary
- No operational authority or direct-control behavior changes
