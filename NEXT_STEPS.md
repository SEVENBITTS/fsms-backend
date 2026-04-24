# NEXT STEP

## Goal
Surface conflict-guidance summaries in post-operation audit outputs.

---

## Build

### 1. API behavior
- keep storing guidance summaries on conflict acknowledgement records
- include the stored guidance summary in post-operation rendered reports
- include the stored guidance summary in post-operation audit PDFs

### 2. Audit clarity
- make the audit pack show what was acknowledged, not only who acknowledged it
- keep the pilot instruction status visible as `not_a_pilot_command`
- do not add any automated avoidance or direct-control behavior

### 3. Tests
- rendered report includes conflict acknowledgement guidance summary
- PDF export includes conflict acknowledgement guidance summary
- build and focused audit tests pass

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Post-operation reports explain the conflict guidance summary that was acknowledged
- Post-operation PDFs preserve the same summary for audit review
- No operational authority or direct-control behavior changes
