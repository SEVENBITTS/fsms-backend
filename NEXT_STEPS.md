# NEXT STEP

## Goal
Summarize regulatory matrix rows impacted by open amendment alerts.

---

## Build

### 1. API behavior
- add a read-only mission endpoint for regulatory review impact
- compare open regulatory amendment alerts with regulatory requirement mappings
- return impacted matrix rows, open amendment count, and clause-review count
- keep the result advisory/review-only, not approval logic

### 2. Operator clarity
- show which CAA/CAP mappings need attention after an amendment
- link amendment source context to impacted controls and evidence types
- keep unresolved review work explicit before any compliance claim

### 3. Tests
- add API coverage for impacted mappings
- confirm empty impact when no amendment alerts are open
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
- Open regulatory amendments produce an impacted-matrix summary
- Unaffected missions return an empty review-impact summary
- No operational authority, approval, or direct-control behavior changes
