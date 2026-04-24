# NEXT STEP

## Goal
Add the first read-only regulatory requirement matrix.

---

## Build

### 1. API behavior
- add a regulatory requirement mapping endpoint under the SMS framework
- seed source-level CAA/CAP rows for CAP 722, CAP 722A, and UK UAS regulatory context
- map each source-level requirement to an existing platform control and evidence type
- mark mappings as source-level or needing clause review rather than accepted compliance

### 2. Operator clarity
- make CAA/CAP traceability visible before claiming formal compliance
- show assurance owner, evidence type, review status, and platform control per requirement
- keep the matrix read-only until formal clause-level review exists

### 3. Tests
- add API coverage for regulatory requirement mappings
- confirm broken control links are rejected by database constraints
- run focused SMS framework tests
- run build

---

## Do NOT do
- No legal compliance certification claim
- No direct aircraft control
- No automated dispatch approval
- No BVLOS command authority yet

---

## Done When
- Regulatory source mappings can be listed through the API
- CAP/CAA rows are tied to existing controls and evidence types
- Review status makes unresolved clause-level work explicit
- No operational authority, approval, or direct-control behavior changes
