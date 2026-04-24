# NEXT STEP

## Goal
Add operator-facing Q-line index summary context for normalized NOTAM overlays.

---

## Build

### 1. Normalized overlay metadata
- derive a Q-line index summary during area-source normalization
- mark Q-line data as coarse index metadata only
- preserve the normalized geometry as the operational review source

### 2. Live-ops presentation
- show Q-line center and radius as an operator-facing summary
- show the coarse-index warning beside NOTAM geometry context
- keep Q-line fallback distinct from E-field/provided geometry

### 3. Tests
- normalized NOTAM overlays include Q-line summary metadata
- Q-line fallback overlays keep the same summary context
- live-ops bundle parses after the display update

---

## Do NOT do
- No direct aircraft control
- No automated avoidance execution
- No pilot command transmission
- No BVLOS command authority yet

---

## Done When
- Normalized area overlays expose Q-line index summary context
- Live ops displays the Q-line summary clearly
- Q-line data is clearly labelled as coarse index metadata only
- Build and focused external-overlay tests pass
