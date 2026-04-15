# NEXT STEPS

## Current Status
Telemetry system is complete and tested:
- ✅ Integration tests (HTTP layer)
- ✅ Service tests (business logic)
- ✅ Validation + error handling
- ✅ Latest + history endpoints

Alerts system foundation is complete and tested:
- ✅ Alerts table migration
- ✅ Alert repository
- ✅ Alert repository tests
- ✅ Alert service
- ✅ Alert service tests
- ✅ Threshold creation / dedupe / resolution behavior

---

## Next Step

### Wire Alerts into Telemetry Ingestion

Goal:
Evaluate alert conditions automatically when telemetry is recorded.

---

## Plan

1. Decide integration point inside telemetry flow
2. Call `AlertService` after telemetry persistence succeeds
3. Keep telemetry write and alert evaluation behavior consistent
4. Add integration tests covering telemetry → alert creation
5. Add integration tests covering telemetry normalization → alert resolution

---

## Do Not Do Yet
- Replay system
- UI/frontend
- Auth
- Performance optimizations

---

## Definition of Done
- Recording telemetry automatically evaluates alerts
- Alert lifecycle is triggered by real telemetry writes
- Covered by integration tests