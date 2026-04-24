# NEXT STEP

## Goal
Require conflict-guidance acknowledgement summaries for audit integrity.

---

## Build

### 1. API behavior
- require `guidanceSummary` when recording conflict-guidance acknowledgements
- reject missing or blank guidance summaries before writing evidence
- keep valid live-ops acknowledgement flow unchanged

### 2. Database integrity
- backfill any existing blank summaries with a migration-safe placeholder
- enforce non-empty `guidance_summary` at the database layer
- keep the pilot instruction status visible as `not_a_pilot_command`
- do not add any automated avoidance or direct-control behavior

### 3. Tests
- API rejects missing or blank guidance summaries
- database rejects direct blank guidance summaries
- build and focused audit tests pass

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Conflict acknowledgement evidence cannot be created without the reviewed guidance summary
- The API and database enforce the same non-empty summary rule
- No operational authority or direct-control behavior changes
