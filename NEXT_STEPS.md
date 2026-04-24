# NEXT STEP

## Goal
Link platform instances to curated aircraft capability specifications.

---

## Build

### 1. Data link
- add an optional aircraft type/specification reference to platforms
- expose the linked spec when reading platform records
- keep existing platform creation working without a spec reference

### 2. Future analysis path
- prepare mission planning to select a platform with known capability limits
- do not yet automate weather/environment suitability decisions
- keep aircraft spec source evidence visible for later audit review

### 3. Tests
- add focused platform tests for linked/unlinked specs
- run targeted platform tests
- run TypeScript build and diff whitespace check

---

## Do NOT do
- No external scraping or unlicensed spec ingestion
- No automated aircraft suitability decision yet
- No direct aircraft control
- No BVLOS command authority yet

---

## Done When
- Platforms can optionally reference a curated aircraft capability spec
- Existing platform flows remain backwards compatible
- Mission/platform UI can use this link in a later select-box step
