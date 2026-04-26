# NEXT STEP

## Goal
Validate the recovered migration chain against a clean Postgres test database.

---

## Build

### 1. Migration validation
- Run the full migration chain from an empty test database.
- Confirm recovered migrations `007` through `047` apply in order.
- Confirm seed/reference data is present after migration.

### 2. Guardrails
- Capture any ordering assumptions between mission, governance, OA, insurance, stored-file, auth, and membership tables.
- Add or update a lightweight validation script/test if a gap is found.

### 3. Tests
- Keep `npm test` green.
- Keep `npm run build` green.

---

## Do NOT do
- No feature expansion.
- No schema redesign unless validation exposes a real defect.
- No production data migration.

---

## Done When
- A clean database migration run is verified.
- Any migration assumptions are documented.
- Build and full test suite remain green.
