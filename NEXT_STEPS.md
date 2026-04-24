# NEXT STEP

## Goal
Add conflict-guidance acknowledgement records for live-ops audit evidence.

---

## Build

### 1. Conflict guidance model
- add immutable acknowledgement records linked to mission conflict overlays
- capture the guidance action code and evidence action that was acknowledged
- keep guidance explicitly advisory, not a pilot command

### 2. Live-ops presentation
- expose a backend acknowledgement path that the UI can call next
- keep acknowledgement separate from aircraft or pilot command transmission
- make the recorded audit status explicit

### 3. Tests
- acknowledgement records can be created and listed by mission
- records cannot be created for another mission's overlay
- invalid monitor/no-evidence acknowledgements are rejected
- records remain marked as not pilot commands

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Conflict guidance acknowledgements are stored as auditable evidence
- Acknowledgements are tied to the correct mission overlay
- Guidance remains decision support and cannot be mistaken for pilot command transmission
- Build and focused audit/conflict tests pass
