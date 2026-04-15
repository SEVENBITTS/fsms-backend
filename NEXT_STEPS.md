# NEXT STEP

## Goal
Prove telemetry-to-alert behavior end-to-end.

---

## Implementation

### Add integration tests in `src/tests/telemetry.test.ts`

1. POST telemetry with altitude above threshold
   - assert ALTITUDE_HIGH alert created

2. POST telemetry with normalized altitude
   - assert ALTITUDE_HIGH alert resolved

---

## Do NOT do
- No new alert types
- No alert endpoints yet
- No replay system yet

---

## Done When
- Real telemetry writes create alerts
- Real telemetry normalization resolves alerts
- Covered by integration tests