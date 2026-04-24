# NEXT STEP

## Goal
Add linked aircraft capability source context to the operator mission workspace.

---

## Build

### 1. UI visibility
- surface the assigned platform's linked aircraft capability spec in the operator mission workspace
- show source reference/version fields so operators can see where the capability data came from
- keep the display informational only

### 2. Safe boundary
- do not make automated weather/environment suitability decisions yet
- do not block approval or dispatch based on aircraft spec limits yet
- do not add external aircraft-spec scraping or live manufacturer sync

### 3. Tests
- add focused workspace bundle/API assertions for the visible aircraft capability source context
- run the mission-planning workspace tests
- run TypeScript build and diff whitespace check

---

## Done When
- A mission with a linked platform spec shows that aircraft capability source context in the operator workspace
- Missions without a linked spec still render cleanly
- The capability display remains advisory/contextual only
