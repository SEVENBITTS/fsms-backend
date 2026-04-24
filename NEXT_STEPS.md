# NEXT STEP

## Goal
Add a post-operation evidence readiness endpoint for structured pre-sign-off review.

---

## Build

### 1. Backend summary
- expose a mission/snapshot readiness summary for post-operation evidence packs
- include counts for conflict acknowledgements, safety action closures, regulatory amendment reviews, and sign-off state
- keep the summary read-only and derived from existing audit evidence

### 2. Operator clarity
- describe missing categories as review prompts, not hard failures
- avoid legal compliance certification wording
- keep accountable-manager sign-off separate from evidence readiness

### 3. Tests
- add focused API/service coverage for evidence readiness
- run targeted audit evidence tests
- run TypeScript build and diff whitespace check

---

## Do NOT do
- No automatic sign-off decision
- No legal compliance certification claim
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- API returns structured post-operation evidence readiness for a snapshot
- Empty evidence categories are visible as informational review prompts
- Existing report/PDF exports remain unchanged
