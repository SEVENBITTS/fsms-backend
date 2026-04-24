# NEXT STEP

## Goal
Add a compact operator view of post-operation evidence pack contents before sign-off.

---

## Build

### 1. Workspace visibility
- show report section summaries from the rendered post-operation evidence pack
- surface regulatory amendment review count, conflict acknowledgement count, and safety action closure count together
- keep report/PDF links as the source of full detail

### 2. Operator clarity
- explain what evidence is present before accountable-manager sign-off
- keep missing evidence warnings informational, not automatic rejection
- avoid presenting summaries as formal compliance certification

### 3. Tests
- parse-check the mission workspace script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No automatic sign-off decision
- No legal compliance certification claim
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Operators can see key evidence-pack counts before signing off
- Missing/empty evidence categories are visible but non-authoritative
- Full report/PDF remains available for audit detail
