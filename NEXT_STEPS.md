# NEXT STEP

## Goal
Constrain conflict acknowledgement evidence roles for audit integrity.

---

## Build

### 1. API validation
- require operator review evidence to be acknowledged by an operator
- require supervisor review evidence to be acknowledged by a supervisor
- reject mismatched evidence-action/role combinations before writing records

### 2. Database constraint
- add a check constraint so direct writes cannot bypass the role/evidence rule
- keep existing acknowledgement records and pilot-command guard intact

### 3. Tests
- API rejects mismatched supervisor/operator acknowledgement roles
- database rejects direct mismatched acknowledgement records
- valid acknowledgement and export paths continue to work

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Conflict acknowledgement evidence action and role cannot disagree
- The rule is enforced in both validation and database constraints
- Build and focused audit tests pass
