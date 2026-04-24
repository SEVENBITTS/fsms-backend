# NEXT STEP

## Goal
Prevent duplicate conflict-guidance acknowledgement evidence records.

---

## Build

### 1. API behavior
- return 409 when an acknowledgement already exists for the same mission, overlay, guidance action, and evidence action
- keep valid acknowledgement, list, export, report, and PDF paths unchanged
- preserve the decision-support boundary: acknowledge guidance only, do not issue pilot commands

### 2. Database integrity
- add a unique constraint on the stable acknowledgement identity
- prevent direct writes from bypassing the duplicate guard
- keep existing role/evidence and not-pilot-command safeguards intact

### 3. Tests
- API rejects duplicate acknowledgement attempts with a clear conflict response
- database rejects direct duplicate acknowledgement records
- build and focused audit tests pass

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Duplicate acknowledgement attempts cannot create extra audit rows
- The API returns a clear 409 conflict response
- The database enforces the same rule directly
