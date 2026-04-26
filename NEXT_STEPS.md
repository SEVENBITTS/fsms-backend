# NEXT STEP

## Goal
Add accountable-manager controls for recording SOP recommendation decisions from the workspace.

---

## Build

### 1. Operator visibility
- add a role-controlled accountable-manager action path from the mission workspace SOP decision summary
- record accepted, rejected, deferred, or closed decisions without treating draft recommendations as operating instructions
- keep decision controls separate from post-operation evidence sign-off

### 2. Product boundary
- continue to label demo airspace data as synthetic/local
- do not imply live CAA, NOTAM, or manufacturer feed connectivity
- keep decisions framed as internal accountable review records, not automatic SOP amendment, operational authorisation, or regulatory submission

### 3. Tests
- add mission workspace UI tests for role-controlled SOP recommendation decision recording controls
- run mission-planning UI tests
- run TypeScript build and diff whitespace check

---

## Done When
- Accountable managers can initiate SOP recommendation review decisions from the workspace without exposing draft SOP changes as operating instructions
- Copy remains explicit that links support audit review, not compliance certification
- Degraded or carried-forward overlays remain visually distinguishable
- The demo remains clearly synthetic and safe for local presentation
