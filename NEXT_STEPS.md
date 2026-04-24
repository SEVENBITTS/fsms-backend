# NEXT STEP

## Goal
Carry live-ops conflict acknowledgements into post-operation audit exports.

---

## Build

### 1. Conflict guidance model
- include conflict guidance acknowledgements in post-operation evidence exports
- preserve conflict ID, overlay ID, action code, evidence action, role, actor, note, and timestamp
- keep guidance explicitly advisory, not a pilot command

### 2. Live-ops presentation
- render acknowledgement evidence in the post-operation report
- include acknowledgement evidence in the PDF export
- keep the pilot instruction status visible in the exported audit trail

### 3. Tests
- post-operation JSON export includes live conflict acknowledgements
- rendered report includes acknowledgement evidence
- PDF export includes acknowledgement evidence

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Post-operation evidence exports include live conflict acknowledgement records
- Rendered reports and PDFs include the acknowledgement audit trail
- Guidance remains decision support and cannot be mistaken for pilot command transmission
- Build and focused audit tests pass
