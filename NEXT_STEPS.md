# Next Build Step

## Fix error handling
- Map MissionNotActiveError → 409
- Map MissionTelemetryValidationError → 400
- Map unknown mission → 404
- Remove fallback 500s from expected flows

## Then:
- Tighten tests to exact status codes (no arrays)