# NEXT STEP

## 🎯 Goal
Wire Alerts into telemetry ingestion.

When telemetry is recorded → alerts should be evaluated automatically.

---

## 🔧 Implementation

### 1. Locate integration point
Inside:
- `MissionTelemetryService.recordTelemetry`

---

### 2. After successful DB commit
Call:

```ts
await alertService.evaluateTelemetry(missionId, record)