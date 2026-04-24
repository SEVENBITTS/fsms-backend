# NEXT STEP

## Goal
Expose regulatory amendment alerts through the mission API.

---

## Build

### 1. API behavior
- add a mission endpoint for regulatory amendment alerts
- validate source document, versions, dates, change summary, impact, affected references, and review action
- return duplicate status when the same open amendment alert already exists
- return clear validation and mission-not-found errors
- keep the existing alert list endpoint unchanged

### 2. Operator clarity
- make amendment alerts usable by future regulatory-monitoring automation
- keep the payload explicit about what changed and what needs review
- avoid any automatic legal interpretation, dispatch approval, or direct-control behavior

### 3. Tests
- add API coverage for create, duplicate suppression, validation, and missing mission
- run focused alert API tests
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
- Regulatory amendment alerts can be created through the API
- Invalid amendment requests fail safely
- Duplicate open amendment alerts are suppressed through the API
- No operational authority, approval, or direct-control behavior changes
