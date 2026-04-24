# NEXT STEP

## Goal
Add live-ops access to area refresh chronology review.

---

## Build

### 1. Operator visibility
- show the ordered area refresh run chronology from the live-ops page
- expose transition/artifact review links for fresh, partial, and failed refreshes
- keep the chronology read-only and separate from pilot command guidance

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep provenance review informational and auditable

### 3. Tests
- add focused API/UI assertions for refresh-run chronology access
- run live-ops and external-overlay focused tests
- run TypeScript build and diff whitespace check

---

## Done When
- Operators can open or review refresh chronology from live ops
- Fresh, partial, and failed refresh transitions remain auditable
- The demo remains clearly synthetic and safe for local presentation
