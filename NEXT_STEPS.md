# NEXT STEP

## Goal
Expose controlled alert acknowledgement and resolution.

---

## Build

### 1. API behavior
- add mission-scoped alert acknowledgement and resolve endpoints
- require the alert to belong to the mission in the route
- validate optional acknowledgement and resolution timestamps
- preserve existing alert list and regulatory review impact behavior

### 2. Operator clarity
- allow amendment-review alerts to move from open to acknowledged to resolved
- keep alert closure as evidence workflow, not compliance certification
- prevent one mission from changing another mission's alert state

### 3. Tests
- add API coverage for acknowledgement and resolution
- confirm mission mismatch is rejected
- confirm invalid timestamps fail safely
- run focused alert API tests
- run build

---

## Do NOT do
- No legal compliance certification claim
- No direct aircraft control
- No automated dispatch approval
- No BVLOS command authority yet

---

## Done When
- Alerts can be acknowledged and resolved through mission-scoped endpoints
- Cross-mission alert actions fail safely
- No operational authority, approval, or direct-control behavior changes
