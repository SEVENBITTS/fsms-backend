# Operational Authority, SOP Assurance, And Continuous Improvement

## Purpose

This document defines how VerityATLAS should treat a company's CAA Operational Authorisation (OA) as the root compliance object for regulated commercial drone operations.

It also defines how:

- SOPs should be linked to that authorisation
- missions should be checked against both OA and SOP expectations
- post-mission results should drive continuous improvement

This note assumes:

- company: `VerityAir Systems Ltd`
- platform: `VerityATLAS`
- initial regulatory focus: UK CAA commercial operations

## Strategic Position

For the commercial target market, VerityATLAS should not begin with a mission.

It should begin with the operator's authority to conduct one.

Working principle:

- no recorded active OA means VerityATLAS should indicate the operator appears outside its recorded commercial compliance envelope

This keeps the platform aligned to real operator accountability and helps prevent planning from drifting outside the authorised envelope.

## Scope

This document covers:

- OA ingestion and activation
- OA-derived authorised envelope
- SOP linkage and mission assurance
- post-mission variance handling
- continuous improvement triggers

This document does not define:

- CAA submission integrations
- automated legal interpretation without human review
- open-category product strategy beyond boundary notes

## Product Boundary

### Commercial Focus

The primary target remains regulated commercial operators.

For those tenants:

- OA is treated as mandatory evidence for commercial mission planning
- mission planning, approval, and dispatch should be assessed against the active OA profile

### Open Category Caveat

Open-category support may be possible later, but it should not shape the v1 architecture.

Recommended rule:

- v1: OA-based commercial tenants only
- later: separate open-category operating profile if strategically needed

This prevents dilution of the commercial story.

## Core Operating Model

The hierarchy should be:

1. organisation
2. operational authorisation
3. insurance profile
4. OA-derived authorised envelope
5. SOP library and versioned procedures
6. mission planning and mission execution
7. post-mission evidence and review
8. continuous improvement actions

## Key Concepts

### 1. OA Source Record

The original OA remains a controlled evidence object.

Minimum fields:

- `id`
- `organisationId`
- `authorityName`
- `referenceNumber`
- `issueDate`
- `effectiveFrom`
- `expiresAt`
- `status`
- `uploadedFileId`
- `uploadedBy`
- `uploadedAt`

### 2. OA Structured Profile

The OA must be converted into a structured, versioned profile that VerityATLAS can assess against.

Minimum fields:

- `oaProfileId`
- `oaDocumentId`
- `versionNumber`
- `reviewStatus`
- `activatedBy`
- `activatedAt`
- `supersededAt`

### 3. OA Conditions

Conditions should be stored as machine-readable controls linked back to the source clause.

Examples:

- approved operating categories
- allowed mission methods
- VLOS/BVLOS permissions
- geographic and airspace restrictions
- altitude limits
- platform restrictions
- pilot competency requirements
- crew composition requirements
- maintenance conditions
- evidence retention obligations
- incident reporting obligations
- special limitations and prohibitions

### 4. SOP Records

SOPs are separate from the OA but must be linked to it.

SOPs define how the company intends to operate inside its authorised envelope.

Minimum fields:

- `sopId`
- `organisationId`
- `title`
- `code`
- `version`
- `status`
- `effectiveFrom`
- `supersededBy`
- `owner`
- `approvalRecord`

### 5. Mission Assurance Against OA And SOP

Each mission should be checked against:

- the active OA profile
- the relevant SOP set
- existing readiness domains

That means OA compliance should become another assurance layer alongside:

- mission risk
- airspace compliance
- pilot readiness
- platform readiness
- approval evidence
- dispatch evidence

## Domain Design

Recommended new domain modules:

- `operational-authority`
- `sop-assurance`
- `continuous-improvement`

Suggested internal components:

- `oa-document.repository.ts`
- `oa-profile.repository.ts`
- `oa-condition.repository.ts`
- `oa-compliance.service.ts`
- `oa-lifecycle.service.ts`
- `sop.repository.ts`
- `sop-assurance.service.ts`
- `improvement-recommendation.service.ts`

## OA Ingestion Model

### Step 1. Upload

User uploads the OA document.

The platform stores:

- raw file
- metadata
- organisation ownership
- issue and expiry fields

### Step 2. Assisted Extraction

VerityATLAS can extract candidate conditions from the OA, but these should remain draft until reviewed.

Important rule:

- the system may assist extraction
- the system must not silently assert legal meaning without review

### Step 3. Human Review

A designated company role or authorised internal reviewer confirms:

- extracted conditions
- clause links
- activation readiness

### Step 4. Activation

Only an activated OA profile should govern the platform's recorded OA assessment for mission planning.

Recommended states:

- `draft_uploaded`
- `draft_extracted`
- `under_review`
- `active`
- `superseded`
- `expired`
- `revoked`

## Planning And Compliance Signalling

For commercial tenants:

- if no active OA exists, VerityATLAS should clearly indicate the operator does not currently have recorded evidence of an active OA for commercial planning
- if OA is expired or revoked, VerityATLAS should clearly indicate the operator appears outside its recorded authorised envelope
- if mission falls outside the OA, VerityATLAS should surface a fail result, identify the relevant condition, and require explicit accountable review before continuation

Permitted UI behaviour:

- browse non-mission admin areas without OA if needed
- allow product teams to decide whether commercial planning is warned, restricted, or hard-stopped, but always record the compliance state and any override rationale

## Mission Assessment Logic

VerityATLAS should assess:

- is the mission type permitted under the OA
- is the geography allowed
- is the airspace condition satisfied
- is the altitude/method allowed
- are the platform and pilot inside authorised constraints
- are any additional conditions or evidence items mandatory

Suggested result model:

- `pass`
- `warning`
- `fail`

Every result should cite:

- OA condition id
- source clause reference
- evidence requirement if any

Suggested operator-facing wording:

- "VerityATLAS indicates the operator does not currently have recorded evidence of an active OA for this operation."
- "Proceeding may place the operator outside its compliance obligations."
- "Any continuation should require explicit accountable review and recorded rationale."

## SOP Assurance Model

SOP assurance asks a different question from OA assurance.

- OA assurance: are we authorised to do this
- SOP assurance: are we following our declared method for doing this safely

Mission checks may therefore include:

- active insurance present
- mission inside insurance cover
- required SOPs acknowledged
- required SOP-controlled steps completed
- required briefing/checklist/handoff evidence present
- required contingency procedure references present

## Continuous Improvement Loop

VerityATLAS should use mission results to identify when SOPs may need:

- amendment
- clarification
- expansion
- creation from scratch

### Example Triggers

- repeated warning outcomes in the same operational condition
- frequent approval overrides
- repeated missing readiness evidence
- repeated replay-detected deviation near operational boundaries
- repeated post-mission findings with no matching SOP coverage
- new mission type recurring without an applicable procedure

### Output Types

- `sop_review_recommended`
- `sop_amendment_recommended`
- `new_sop_required`
- `oa_variation_review_recommended`

## Evidence Model

All improvement recommendations should be evidence-linked.

Evidence sources may include:

- mission events
- audit evidence snapshots
- approval and dispatch links
- telemetry replay findings
- alerts
- safety events
- post-operation evidence snapshots
- sign-off records

That keeps change-management rooted in observed operations rather than opinion alone.

## Human Accountability Boundary

VerityATLAS should recommend and evidence change.

It should not silently amend live SOPs or OA interpretations on behalf of the operator.

Required human actions:

- approve OA rule activation
- approve SOP changes
- confirm change implementation
- record rationale for acceptance or rejection
- record accountable review if the organisation proceeds despite a warning or fail state

## Suggested Data Entities

- `oa_documents`
- `oa_profiles`
- `oa_conditions`
- `oa_condition_mappings`
- `organisation_regulatory_profiles`
- `sops`
- `sop_versions`
- `sop_mission_links`
- `mission_oa_assessments`
- `mission_sop_assessments`
- `improvement_recommendations`
- `improvement_decisions`

## Suggested API Boundaries

- `POST /organisations/:id/oa-documents`
- `POST /oa-documents/:id/extract`
- `POST /oa-profiles/:id/activate`
- `GET /organisations/:id/oa-profile`
- `GET /missions/:id/oa-assessment`
- `GET /missions/:id/sop-assessment`
- `GET /missions/:id/improvement-recommendations`
- `POST /improvement-recommendations/:id/decisions`

## Phased Delivery

### Phase 1

- OA upload and metadata
- OA manual structured entry
- OA mandatory planning gate
- mission OA assessment

### Phase 2

- assisted extraction from OA documents
- SOP registry and mission linkage
- SOP assurance checks

### Phase 3

- continuous improvement recommendations
- evidence-linked SOP review workflow
- OA variation recommendation logic

## Success Criteria

VerityATLAS should be able to answer:

- does this operator have an active OA
- is this mission inside the authorised envelope
- which SOPs govern this mission
- what happened on the mission that suggests procedure change
- what evidence supports the recommendation

## Product Positioning

Strong positioning line:

VerityATLAS starts with the operator's authority to conduct the mission, then maintains assurance from planning through review and improvement.
