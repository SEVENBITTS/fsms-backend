# NEXT STEP

## Goal
Connect live-ops conflict advisory acknowledgement to audit evidence.

---

## Build

### 1. Conflict guidance model
- load existing acknowledgement records into the live-ops view
- match acknowledgement status by stable overlay/action/evidence context
- keep guidance explicitly advisory, not a pilot command

### 2. Live-ops presentation
- show acknowledgement status on the primary advisory
- allow recording acknowledgement evidence from the primary advisory
- keep acknowledgement separate from aircraft or pilot command transmission
- make the audit record ID visible after acknowledgement

### 3. Tests
- live-ops bundle compiles with acknowledgement loading
- audit evidence endpoint remains covered by focused tests
- conflict guidance remains marked as not a pilot command

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Live ops can display existing acknowledgement status
- Live ops can record acknowledgement evidence for the primary advisory
- Guidance remains decision support and cannot be mistaken for pilot command transmission
- Build and focused audit/mission tests pass
