# NEXT STEP

## Goal
Show regulatory amendment review context in live operations.

---

## Build

### 1. UI behavior
- recognize open regulatory amendment alerts in live operations
- show source document, version change, summary, impact, affected references, effective date, and review action
- keep existing mission alert loading unchanged
- keep regulatory context read-only for operators

### 2. Operator clarity
- make regulatory amendments visible beside operational alerts
- distinguish review-required compliance alerts from telemetry threshold alerts
- avoid automatic legal interpretation, dispatch approval, or direct-control behavior

### 3. Tests
- parse-check the live-ops static script
- run TypeScript build
- run diff whitespace check

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet
- No claim that the system has legally interpreted an amendment

---

## Done When
- Live operations can display regulatory amendment alert details
- Alert status panels include amendment impact and review action
- No operational authority, approval, or direct-control behavior changes
