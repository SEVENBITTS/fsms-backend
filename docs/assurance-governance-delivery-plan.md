# Assurance Governance Delivery Plan

## Purpose

This document turns the assurance governance architecture into an implementation plan for the current TypeScript FSMS product core.

It covers:

- proposed tables
- module boundaries
- route list
- phased migration order
- first test cases for OA and insurance assessment
- an early-warning risk map concept for renewals, maintenance, competency, and wider operational threats

It is intended to follow:

- `docs/assurance-governance-architecture.md`
- `docs/operational-authority-sop-assurance.md`
- `docs/operational-authority-lifecycle-renewal-readiness.md`
- `docs/oa-renewal-evidence-pack-explicit-activation.md`
- `docs/insurance-lifecycle-readiness-evidence.md`

## Delivery Principles

- keep the implementation consistent with current repo structure
- use explicit domain modules with repository/service/controller/routes/types/validators/errors
- prefer evidence-linked, auditable assessments over hidden automation
- use compliance-signalling language, not regulator-substitution language
- phase delivery so the system becomes useful early without waiting for full automation

## Current Codebase Fit

The existing codebase already has a strong pattern:

- migrations are additive and sequential
- domains are separated under `src/<domain>`
- `app.ts` wires controllers and routers at the top level
- mission assurance already includes risk, airspace, pilot, platform, audit evidence, safety events, and external overlays

This makes the new work a natural extension rather than a new subsystem.

## Proposed New Modules

Recommended new domains:

- `src/operational-authority`
- `src/insurance`
- `src/governance`
- `src/evidence-packs`
- `src/continuous-improvement`

### 1. `operational-authority`

Responsibility:

- OA document intake
- OA structured profile activation
- OA condition storage
- OA mission assessment
- OA lifecycle and renewal readiness

Expected files:

- `operational-authority.repository.ts`
- `operational-authority.service.ts`
- `operational-authority.controller.ts`
- `operational-authority.routes.ts`
- `operational-authority.types.ts`
- `operational-authority.validators.ts`
- `operational-authority.errors.ts`

### 2. `insurance`

Responsibility:

- insurance document intake
- source policy upload and retention
- structured insurance profile activation
- coverage condition storage
- mission insurance assessment
- renewal readiness and change review signals

Expected files:

- `insurance.repository.ts`
- `insurance.service.ts`
- `insurance.controller.ts`
- `insurance.routes.ts`
- `insurance.types.ts`
- `insurance.validators.ts`
- `insurance.errors.ts`

### 3. `governance`

Responsibility:

- combined mission governance view
- compliance-signalling aggregation
- accountable override recording
- governance summary APIs

Expected files:

- `governance.repository.ts`
- `governance.service.ts`
- `governance.controller.ts`
- `governance.routes.ts`
- `governance.types.ts`

### 4. `evidence-packs`

Responsibility:

- draft OA renewal packs
- draft insurance renewal packs
- pack activation
- export logging
- versioning

Expected files:

- `evidence-pack.repository.ts`
- `evidence-pack.service.ts`
- `evidence-pack.controller.ts`
- `evidence-pack.routes.ts`
- `evidence-pack.types.ts`

### 5. `continuous-improvement`

Responsibility:

- SOP review recommendations
- OA variation review recommendations
- insurance change review recommendations
- evidence-linked decisions and dispositions

Expected files:

- `continuous-improvement.repository.ts`
- `continuous-improvement.service.ts`
- `continuous-improvement.controller.ts`
- `continuous-improvement.routes.ts`
- `continuous-improvement.types.ts`

## Proposed Tables

The current migration sequence ends at `030_...`, so this plan starts at `031`.

### OA Tables

#### `031_create_operational_authority_documents.sql`

Table:

- `operational_authority_documents`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `authority_name text not null`
- `reference_number text`
- `issue_date timestamptz`
- `effective_from timestamptz`
- `expires_at timestamptz`
- `status text not null`
- `uploaded_file_ref text`
- `uploaded_by text`
- `uploaded_at timestamptz not null default now()`
- `file_checksum text`
- `metadata jsonb not null default '{}'::jsonb`

#### `032_create_operational_authority_profiles.sql`

Table:

- `operational_authority_profiles`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `oa_document_id uuid not null references operational_authority_documents(id)`
- `version_number integer not null`
- `review_status text not null`
- `activation_status text not null`
- `activated_by text`
- `activated_at timestamptz`
- `superseded_at timestamptz`
- `created_at timestamptz not null default now()`

#### `033_create_operational_authority_conditions.sql`

Table:

- `operational_authority_conditions`

Suggested columns:

- `id uuid primary key`
- `oa_profile_id uuid not null references operational_authority_profiles(id)`
- `condition_code text not null`
- `condition_type text not null`
- `severity text not null`
- `clause_reference text`
- `condition_title text not null`
- `condition_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

#### `034_create_mission_oa_assessments.sql`

Table:

- `mission_oa_assessments`

Suggested columns:

- `id uuid primary key`
- `mission_id uuid not null references missions(id)`
- `oa_profile_id uuid not null references operational_authority_profiles(id)`
- `result text not null`
- `summary text not null`
- `reason_payload jsonb not null default '[]'::jsonb`
- `assessed_at timestamptz not null default now()`

### Insurance Tables

#### `035_create_insurance_documents.sql`

Table:

- `insurance_documents`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `provider_name text not null`
- `policy_number text`
- `issue_date timestamptz`
- `effective_from timestamptz`
- `expires_at timestamptz`
- `status text not null`
- `uploaded_file_ref text`
- `uploaded_by text`
- `uploaded_at timestamptz not null default now()`
- `metadata jsonb not null default '{}'::jsonb`

#### `036_create_insurance_profiles.sql`

Table:

- `insurance_profiles`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `insurance_document_id uuid not null references insurance_documents(id)`
- `version_number integer not null`
- `review_status text not null`
- `activation_status text not null`
- `activated_by text`
- `activated_at timestamptz`
- `superseded_at timestamptz`
- `created_at timestamptz not null default now()`

#### `037_create_insurance_conditions.sql`

Table:

- `insurance_conditions`

Suggested columns:

- `id uuid primary key`
- `insurance_profile_id uuid not null references insurance_profiles(id)`
- `condition_code text not null`
- `condition_type text not null`
- `severity text not null`
- `clause_reference text`
- `condition_title text not null`
- `condition_payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

#### `038_create_mission_insurance_assessments.sql`

Table:

- `mission_insurance_assessments`

Suggested columns:

- `id uuid primary key`
- `mission_id uuid not null references missions(id)`
- `insurance_profile_id uuid not null references insurance_profiles(id)`
- `result text not null`
- `summary text not null`
- `reason_payload jsonb not null default '[]'::jsonb`
- `assessed_at timestamptz not null default now()`

### Governance Tables

#### `039_create_mission_governance_assessments.sql`

Table:

- `mission_governance_assessments`

Suggested columns:

- `id uuid primary key`
- `mission_id uuid not null references missions(id)`
- `overall_result text not null`
- `governance_summary jsonb not null`
- `assessed_at timestamptz not null default now()`

#### `040_create_mission_governance_overrides.sql`

Table:

- `mission_governance_overrides`

Suggested columns:

- `id uuid primary key`
- `mission_id uuid not null references missions(id)`
- `override_type text not null`
- `condition_source text not null`
- `condition_ref text`
- `reviewed_by text not null`
- `reviewer_role text not null`
- `rationale text not null`
- `temporary_evidence jsonb not null default '{}'::jsonb`
- `resolve_by timestamptz`
- `created_at timestamptz not null default now()`

### Renewal And Evidence Pack Tables

#### `041_create_renewal_readiness_snapshots.sql`

Table:

- `renewal_readiness_snapshots`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `subject_type text not null`
- `subject_id uuid not null`
- `readiness_state text not null`
- `gap_summary jsonb not null`
- `created_at timestamptz not null default now()`

#### `042_create_evidence_pack_drafts.sql`

Table:

- `evidence_pack_drafts`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `subject_type text not null`
- `subject_id uuid not null`
- `pack_type text not null`
- `status text not null`
- `current_version integer not null default 1`
- `created_at timestamptz not null default now()`

#### `043_create_evidence_pack_versions.sql`

Table:

- `evidence_pack_versions`

Suggested columns:

- `id uuid primary key`
- `evidence_pack_draft_id uuid not null references evidence_pack_drafts(id)`
- `version_number integer not null`
- `readiness_state text not null`
- `pack_summary jsonb not null`
- `created_at timestamptz not null default now()`

#### `044_create_evidence_pack_activation_records.sql`

Table:

- `evidence_pack_activation_records`

Suggested columns:

- `id uuid primary key`
- `evidence_pack_version_id uuid not null references evidence_pack_versions(id)`
- `activated_by text not null`
- `activated_role text not null`
- `acknowledgement_text text not null`
- `activated_at timestamptz not null default now()`

#### `045_create_evidence_pack_exports.sql`

Table:

- `evidence_pack_exports`

Suggested columns:

- `id uuid primary key`
- `evidence_pack_version_id uuid not null references evidence_pack_versions(id)`
- `exported_by text not null`
- `exported_at timestamptz not null default now()`
- `export_metadata jsonb not null default '{}'::jsonb`

### Continuous Improvement Tables

#### `046_create_improvement_recommendations.sql`

Table:

- `improvement_recommendations`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `mission_id uuid`
- `recommendation_type text not null`
- `source_type text not null`
- `result_severity text not null`
- `summary text not null`
- `evidence_payload jsonb not null`
- `status text not null`
- `created_at timestamptz not null default now()`

#### `047_create_improvement_decisions.sql`

Table:

- `improvement_decisions`

Suggested columns:

- `id uuid primary key`
- `recommendation_id uuid not null references improvement_recommendations(id)`
- `decision text not null`
- `decided_by text not null`
- `decision_notes text`
- `decided_at timestamptz not null default now()`

### Risk Map Tables

#### `048_create_risk_map_snapshots.sql`

Table:

- `risk_map_snapshots`

Suggested columns:

- `id uuid primary key`
- `organisation_id uuid not null`
- `snapshot_type text not null`
- `summary_state text not null`
- `risk_cells jsonb not null`
- `created_at timestamptz not null default now()`

This table supports an organisation-level early-warning surface.

## Risk Map Concept

The risk map should not be a generic heatmap for decoration.

It should show indicative operating threat across key governance dimensions so issues are identified early and remedied faster.

### Purpose

Help the operator see emerging threats across:

- OA expiry and renewal readiness
- insurance expiry and renewal readiness
- pilot competency/currentness
- platform maintenance and readiness
- mission risk profile trends
- approval/dispatch override frequency
- unresolved safety actions
- evidence gaps

### Suggested Structure

The first version can be a governance matrix rather than a geospatial map.

Rows:

- OA
- insurance
- pilot competency
- platform maintenance
- SOP control
- mission approvals
- safety actions
- evidence readiness

Columns:

- `healthy`
- `watch`
- `at_risk`
- `critical`

Each cell should be evidence-linked and time-aware.

### Early Triggers

Examples:

- OA within 60 days of expiry and readiness incomplete
- insurance within 30 days of expiry
- pilot evidence expiring within 14 days
- maintenance overdue
- repeated override events in the last 30 days
- missing approval evidence links
- unresolved safety actions older than target due date

### Why It Matters

This gives the company an early-warning operations view so threats are identified and remedied faster, supporting more efficient operations.

## Route List

These should follow the current router pattern used in `app.ts`.

### OA Routes

Suggested mount:

- `app.use("/organisations", createOperationalAuthorityRouter(...))`

Suggested routes:

- `POST /organisations/:organisationId/operational-authority-documents`
- `GET /organisations/:organisationId/operational-authority-documents`
- `GET /organisations/:organisationId/operational-authority-profile`
- `POST /operational-authority-profiles/:profileId/activate`
- `GET /missions/:missionId/oa-assessment`
- `GET /organisations/:organisationId/oa-lifecycle`
- `GET /organisations/:organisationId/oa-renewal-readiness`

### Insurance Routes

Suggested mount:

- `app.use("/organisations", createInsuranceRouter(...))`

Suggested routes:

- `POST /organisations/:organisationId/insurance-documents`
- `POST /insurance-documents/:documentId/upload`
- `GET /organisations/:organisationId/insurance-documents`
- `GET /organisations/:organisationId/insurance-profile`
- `POST /insurance-profiles/:profileId/activate`
- `GET /missions/:missionId/insurance-assessment`
- `GET /organisations/:organisationId/insurance-renewal-readiness`

### Governance Routes

Suggested mount:

- `app.use("/missions", createGovernanceRouter(...))`

Suggested routes:

- `GET /missions/:missionId/governance`
- `POST /missions/:missionId/governance-overrides`
- `GET /organisations/:organisationId/governance-status`
- `GET /organisations/:organisationId/risk-map`

### Evidence Pack Routes

Suggested mount:

- `app.use("/organisations", createEvidencePackRouter(...))`

Suggested routes:

- `POST /organisations/:organisationId/evidence-packs/draft`
- `GET /evidence-packs/:packId`
- `POST /evidence-packs/:packId/activate`
- `POST /evidence-packs/:packId/export`
- `POST /evidence-packs/:packId/record-external-submission`

### Continuous Improvement Routes

Suggested mount:

- `app.use("/organisations", createContinuousImprovementRouter(...))`

Suggested routes:

- `GET /organisations/:organisationId/improvement-recommendations`
- `POST /improvement-recommendations/:recommendationId/decisions`

## Phased Migration Order

### Phase 1: Governing Records

Goal:

- create the minimum objects needed to record OA and insurance and assess them at mission level

Migrations:

- `031_create_operational_authority_documents.sql`
- `032_create_operational_authority_profiles.sql`
- `033_create_operational_authority_conditions.sql`
- `034_create_mission_oa_assessments.sql`
- `035_create_insurance_documents.sql`
- `036_create_insurance_profiles.sql`
- `037_create_insurance_conditions.sql`
- `038_create_mission_insurance_assessments.sql`

### Phase 2: Combined Governance And Override

Goal:

- combine separate checks into a mission governance view and record accountable override

Migrations:

- `039_create_mission_governance_assessments.sql`
- `040_create_mission_governance_overrides.sql`

### Phase 3: Renewal Readiness And Packs

Goal:

- support lifecycle warning, readiness, and structured evidence packs

Migrations:

- `041_create_renewal_readiness_snapshots.sql`
- `042_create_evidence_pack_drafts.sql`
- `043_create_evidence_pack_versions.sql`
- `044_create_evidence_pack_activation_records.sql`
- `045_create_evidence_pack_exports.sql`

### Phase 4: Continuous Improvement And Risk Map

Goal:

- expose improvement recommendations and organisation-level early-warning state

Migrations:

- `046_create_improvement_recommendations.sql`
- `047_create_improvement_decisions.sql`
- `048_create_risk_map_snapshots.sql`

## First Test Cases

These should follow the current integration-test style in `src/tests`.

### OA Assessment Tests

Suggested file:

- `src/tests/operational-authority.test.ts`

Initial cases:

1. creates an OA document and activates a profile for an organisation
2. returns a fail assessment when a mission has no recorded active OA
3. returns a fail assessment when the OA is expired
4. returns a fail assessment when the mission method is outside an OA condition
5. returns a warning assessment when additional OA evidence is required but not yet linked
6. returns a pass assessment when the mission is inside the active OA envelope
7. records clause-linked reasons in the assessment payload

### Insurance Assessment Tests

Suggested file:

- `src/tests/insurance.test.ts`

Initial cases:

1. creates an insurance document and activates a profile for an organisation
2. stores an uploaded source policy reference against the insurance document
3. returns a fail assessment when a mission has no recorded active insurance
4. returns a fail assessment when the insurance profile is expired
5. returns a fail assessment when the mission type is outside policy cover
6. returns a fail or warning assessment when a recorded policy exclusion appears to be triggered
7. returns a warning assessment when policy interpretation requires explicit review
8. returns a pass assessment when the mission is inside the active insurance profile
9. records clause-linked reasons in the assessment payload

### Governance Aggregation Tests

Suggested file:

- `src/tests/governance.test.ts`

Initial cases:

1. aggregates OA, insurance, risk, airspace, pilot, and platform assessments into one governance result
2. reports fail when OA fails even if other readiness checks pass
3. reports fail when insurance fails even if OA passes
4. records accountable override against a fail condition
5. preserves mission and evidence state after governance reads

### Evidence Pack Tests

Suggested file:

- `src/tests/evidence-packs.test.ts`

Initial cases:

1. builds a draft OA renewal pack from recorded evidence
2. builds a draft insurance renewal pack from recorded evidence
3. does not allow export before activation
4. captures operator activation acknowledgement
5. versions the pack when underlying evidence changes

### Risk Map Tests

Suggested file:

- `src/tests/risk-map.test.ts`

Initial cases:

1. marks OA as watch when renewal window is open
2. marks insurance as critical when expired
3. marks pilot competency as at-risk when evidence expiry is near
4. marks platform maintenance as critical when overdue
5. marks governance as at-risk when override frequency increases

## Recommended Build Order

Practical implementation order:

1. OA domain
2. insurance domain
3. mission governance aggregation
4. accountable override recording
5. renewal readiness snapshots
6. evidence packs
7. continuous improvement recommendations
8. risk map surface

This sequence gives useful compliance value early without waiting for the whole governance stack.

## Success Criteria

The first release of this work should allow VerityATLAS to:

- record OA and insurance as structured governing objects
- assess missions against both
- present a combined governance view
- support accountable override with audit trail
- show renewal readiness trends
- build draft evidence packs
- surface early governance threat through a risk map
