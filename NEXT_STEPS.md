# NEXT STEP

## Goal
Include live-ops map view-state snapshots in post-operation evidence exports.

---

## Build

### 1. Operator visibility
- add recent map view-state snapshot summaries to the post-operation evidence export package
- render a concise report section with replay cursor, area freshness filter, overlay counts, alerts, conflicts, and capture scope
- keep the report wording explicit that this is metadata-only evidence, not screenshot/file evidence

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep map snapshot evidence separate from pilot command guidance

### 3. Tests
- add focused audit export/render tests for map view-state snapshot inclusion
- run audit-evidence focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Post-operation export JSON includes live-ops map view-state snapshots
- Rendered post-operation reports include a concise map view-state evidence section
- PDF/text output preserves metadata-only, not-pilot-command boundaries
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
