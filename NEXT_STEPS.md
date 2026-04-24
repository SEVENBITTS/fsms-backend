# NEXT STEP

## Goal
Start the aircraft capability specification registry foundation.

---

## Build

### 1. Data model
- create an aircraft type/specification table for UAV capability limits
- include source/evidence metadata for manufacturer or curated specs
- keep platform instances separate from aircraft type specifications

### 2. Future analysis path
- prepare fields for weather, environment, payload, endurance, and GNSS capability checks
- do not yet automate suitability decisions
- plan to connect platform selection to aircraft specs in a later UI step

### 3. Tests
- add migration/validation coverage where appropriate
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
- Repository has a safe aircraft spec registry foundation
- Specs can preserve source/version evidence
- Platform selection remains unchanged until the next UI/data-link step
