# NEXT STEPS

## Current Status

## Last Completed Step
Telemetry system (including error handling + tests) ✅

Telemetry system is complete and tested:
- ✅ Integration tests (HTTP layer)
- ✅ Service tests (business logic)
- ✅ Validation + error handling
- ✅ Latest + history endpoints

---

## 🎯 Next Step (single focus)

### Build Alerts System

Goal:
Trigger alerts based on telemetry data.

Examples:
- Altitude too high
- Speed too high
- Mission enters restricted zone
- Mission inactive but telemetry received

---

## 🧠 Plan

1. Create `alert.types.ts`
2. Create `alert.service.ts`
3. Create `alert.repository.ts`
4. Add DB table `alerts`
5. Write service tests
6. Add integration endpoint (later)

---

## 🚫 Do NOT do yet
- Replay system
- UI/frontend
- Auth
- Performance optimizations

---

## ✅ Definition of Done
- Alerts triggered correctly
- Stored in DB
- Covered by tests