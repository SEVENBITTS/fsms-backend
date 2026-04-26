# Assurance Governance Architecture

## Purpose

This document is the top-level architecture summary for how VerityATLAS should govern commercial drone operations through:

- Operational Authorisation
- insurance
- SOP assurance
- renewal readiness
- evidence packs
- accountable override

It is intended to be the primary reference note that ties together the more detailed design documents in this repository.

This note assumes:

- company: `VerityAir Systems Ltd`
- platform: `VerityATLAS`
- initial market focus: regulated commercial drone operators

## Strategic Position

VerityATLAS should not start with a mission.

It should start with the operator's authority, cover, and procedures for conducting one.

The platform does not create the compliance obligation.

It surfaces the recorded compliance state, checks the mission against that state, and records the operator's response.

That means VerityATLAS should act as:

- an assurance system
- a compliance-signalling system
- an evidence system
- a continuous-improvement system

It should not present itself as:

- the regulator
- the insurer
- an automatic filing or submission service unless that integration explicitly exists

## Core Principle

For commercial operations, VerityATLAS should always be able to answer:

- does the operator have recorded evidence of an active OA
- does the operator have recorded evidence of current insurance
- is the mission inside the authorised and insured operating envelope
- which SOPs govern the mission
- what evidence supports the decision to proceed
- what happened during and after the mission
- what needs review, renewal, amendment, or improvement

## Operating Hierarchy

The governing hierarchy should be:

1. organisation
2. Operational Authorisation
3. insurance profile
4. authorised and insured operating envelope
5. SOP library and versioned procedures
6. mission planning and mission execution
7. post-mission evidence and review
8. renewal readiness and support packs
9. continuous improvement and change control

## Architecture Domains

Recommended domain boundaries:

- `operational-authority`
- `insurance`
- `sop-assurance`
- `mission-governance`
- `audit-evidence`
- `renewal-readiness`
- `evidence-packs`
- `continuous-improvement`

These should integrate with existing domains such as:

- `mission-risk`
- `airspace-compliance`
- `pilots`
- `platforms`
- `missions`
- `safety-events`
- `air-safety-meetings`
- `sms-framework`

## Governing Objects

### Operational Authorisation

OA is the root regulatory object for commercial mission conduct.

It should exist as:

- source document
- structured profile
- versioned condition set
- lifecycle object

Key function:

- determines whether the company is recorded as authorised for the type of operation being planned

### Insurance

Insurance is a peer governing object to the OA.

It should exist as:

- source document
- structured coverage profile
- versioned condition set
- lifecycle object

Key function:

- determines whether the company is recorded as covered for the type of operation being planned
- begins with uploaded policy evidence and structured clause-linked conditions, not just a manually asserted insurance status

### SOPs

SOPs define how the company intends to operate inside its authorised and insured envelope.

They should exist as:

- versioned procedures
- mission-linked procedure sets
- change-controlled operational methods

Key function:

- determines whether the mission is being prepared and conducted in line with the operator's declared methods

## Mission Assurance Model

Each commercial mission should be assessed against multiple layers:

- OA assessment
- insurance assessment
- mission risk assessment
- airspace compliance assessment
- pilot readiness
- platform readiness
- SOP assurance
- approval and dispatch evidence

These assessments should produce a structured mission governance view rather than isolated pass/fail widgets.

## Compliance Signalling Model

VerityATLAS should use compliance-signalling language rather than overreaching enforcement language.

Good examples:

- "VerityATLAS indicates the operator does not currently have recorded evidence of an active OA for this operation."
- "VerityATLAS indicates the operator does not currently have recorded evidence of insurance cover for this operation."
- "Proceeding may place the operator outside its compliance obligations or policy terms."
- "Any continuation should require explicit accountable review and recorded rationale."

The platform may still support tenant-configurable restriction behaviour, but the architectural language should remain:

- compliance-aware
- advisory
- accountable
- auditable

## Accountable Override Model

There will be cases where:

- valid evidence exists but is not yet structured in the platform
- renewal is in progress
- policy interpretation requires human review
- an exceptional but defensible operational decision is needed

The platform should therefore support accountable override, not silent bypass.

Minimum override record:

- who reviewed the issue
- what condition was overridden
- why continuation was allowed
- what temporary evidence was relied upon
- when the issue must be resolved
- who approved the rationale

Override should be:

- explicit
- role-controlled
- auditable
- time-bounded where appropriate

## Renewal Readiness

Renewal readiness is separate from expiry reminder.

Reminder asks:

- when does the OA or insurance need attention

Readiness asks:

- do we have the evidence and control state needed to support renewal or change

Renewal readiness should be modelled for:

- OA
- insurance

Inputs may include:

- mission history
- approval and dispatch evidence
- pilot and platform readiness history
- safety events and corrective actions
- post-mission evidence
- SOP changes
- improvement actions

## Evidence Pack Model

Evidence packs should be treated as structured internal support bundles.

They should support:

- OA renewal
- OA variation review
- insurance renewal
- insurance change review

Pack characteristics:

- draft generation can be automated
- content must be versioned
- missing evidence must be visible
- export must be controlled
- submission must not be implied

## Explicit Activation Model

Evidence packs must not be treated as actioned until a named company person explicitly activates them.

This avoids the failure mode:

"we thought the system automatically did it"

Activation should capture:

- name
- role
- organisation
- pack version
- timestamp
- acknowledgement wording

Suggested acknowledgement principle:

- the platform prepared the pack
- the operator remains responsible for review and submission

## Continuous Improvement

VerityATLAS should use mission results to identify:

- where SOPs may need amendment
- where a new SOP may be required
- where the OA may no longer fit operations
- where insurance cover may no longer fit operations

Typical triggers:

- repeated warnings
- repeated overrides
- repeated missing evidence
- repeated operational deviations
- new mission types or platforms
- recurring ambiguity in procedure or cover

Outputs should be evidence-linked recommendations, not silent changes.

## Recommended State Philosophy

Across governing domains, the platform should favour:

- `pass`
- `warning`
- `fail`
- `override_under_accountable_review` where required

This is better than binary lock/unlock thinking.

It keeps the system operationally realistic while preserving auditability.

## Suggested Shared Data Objects

- `organisation_regulatory_profiles`
- `oa_documents`
- `oa_profiles`
- `oa_conditions`
- `insurance_documents`
- `insurance_profiles`
- `insurance_conditions`
- `sops`
- `sop_versions`
- `mission_governance_assessments`
- `mission_oa_assessments`
- `mission_insurance_assessments`
- `mission_sop_assessments`
- `renewal_readiness_snapshots`
- `evidence_pack_drafts`
- `evidence_pack_versions`
- `activation_records`
- `override_records`
- `improvement_recommendations`
- `improvement_decisions`

## Suggested Top-Level API Concepts

- `GET /organisations/:id/governance-status`
- `GET /missions/:id/governance`
- `POST /missions/:id/governance-overrides`
- `GET /organisations/:id/renewal-readiness`
- `POST /organisations/:id/evidence-packs/draft`
- `POST /evidence-packs/:id/activate`

## Phased Delivery

### Phase 1

- OA upload and structured activation
- insurance upload and structured activation
- mission OA and insurance assessment
- operator-facing compliance signalling

### Phase 2

- SOP registry and SOP assurance
- accountable override model
- renewal reminder lifecycle

### Phase 3

- renewal readiness views
- draft OA and insurance evidence packs
- explicit activation workflow

### Phase 4

- continuous improvement recommendations
- OA variation review recommendations
- insurance change review recommendations
- deeper SMS linkage

## Success Criteria

VerityATLAS should be able to prove:

- what the operator was recorded as authorised and insured to do
- what uploaded source records and clause-linked conditions that view was derived from
- how that was checked before the mission
- what evidence supported continuation
- who accepted any exception or override
- what evidence was gathered under the governing profile
- what needs renewal, amendment, or improvement

## Related Documents

- `docs/operational-authority-sop-assurance.md`
- `docs/operational-authority-lifecycle-renewal-readiness.md`
- `docs/oa-renewal-evidence-pack-explicit-activation.md`
- `docs/insurance-lifecycle-readiness-evidence.md`

## Positioning Line

VerityATLAS is designed to surface the operator's recorded compliance state, support accountable operational decisions, and turn that operating history into renewal, assurance, and improvement evidence.
