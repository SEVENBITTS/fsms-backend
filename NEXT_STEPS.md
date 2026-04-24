# NEXT STEP

## Goal
Create a first regulatory amendment alert hook.

---

## Build

### 1. API behavior
- keep using the existing alerts model
- add a regulatory amendment alert type for affected missions
- capture source document, previous version, current version, published date, summary, impact, affected references, and review action
- prevent duplicate open amendment alerts for the same source document and version
- avoid automatic legal interpretation or dispatch authority changes

### 2. Operator clarity
- show that an amendment has occurred
- explain what changed at summary/impact level
- make the required compliance review action explicit
- keep this as an alert/review workflow, not automatic approval or rejection

### 3. Tests
- add service coverage for regulatory amendment alerts
- confirm duplicate amendment alerts are suppressed
- run focused alert tests
- run build

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet
- No claim that the system has legally interpreted an amendment

---

## Done When
- Regulatory amendment alerts can be created for affected missions
- Alerts include source/version/change-impact/review-action metadata
- Duplicate open alerts are avoided for the same amendment
- No operational authority, approval, or direct-control behavior changes
