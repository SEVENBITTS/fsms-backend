# Insurance Lifecycle, Readiness, And Evidence Support

## Purpose

This document defines how VerityATLAS should manage insurance as a governing compliance and readiness object for regulated commercial drone operations.

Insurance should not be treated as a passive file attachment.

It should be managed as an active control that can:

- start from the uploaded policy as source evidence
- signal planning and dispatch compliance risk where required
- be checked against mission characteristics
- trigger renewal reminders
- support evidence preparation for renewal, amendment, or insurer review

## Strategic Principle

For commercial operators, VerityATLAS should know:

- whether insurance is active
- whether the policy covers the intended operation
- when the policy is approaching renewal
- what operating evidence supports the company's renewal or change request

The platform should support insurance readiness and evidence.

It should not imply that an insurer has approved a renewal, variation, or claim unless that is explicitly recorded.

## Core Requirement

Insurance in VerityATLAS should begin with policy upload.

The platform should not rely only on manually asserted cover status.

The operator should upload the active policy or schedule set so VerityATLAS can:

- retain the policy as source evidence
- extract and structure relevant coverage conditions
- link those conditions back to policy wording or schedule references
- assess the mission against the recorded cover envelope
- indicate when a planned operation appears likely to breach the policy terms

The strongest product model is:

1. upload the policy
2. extract structured conditions
3. require human review before activation
4. assess missions against the activated insurance profile

## Relationship To OA

OA and insurance serve different but related functions.

- OA: authorises the operator to conduct certain operations
- insurance: provides cover for certain operations, aircraft, liabilities, or conditions

VerityATLAS should assess both.

A mission may therefore be:

- inside the OA but outside insurance cover
- inside insurance cover but outside the OA
- inside both and able to proceed within the recorded compliance view

That means insurance should become a peer control alongside:

- OA compliance
- mission risk
- airspace compliance
- pilot readiness
- platform readiness

## Insurance Source Record

The original insurance document should be retained as controlled evidence.

Minimum fields:

- `insuranceDocumentId`
- `organisationId`
- `providerName`
- `policyNumber`
- `issueDate`
- `effectiveFrom`
- `expiresAt`
- `uploadedFileId`
- `uploadedBy`
- `uploadedAt`
- `status`

Recommended additions:

- `sourceDocumentType`
- `policyScheduleRefs`
- `uploadedFileChecksum`
- `documentReviewNotes`

## Insurance Structured Profile

The policy should also be represented as a structured, versioned profile that the platform can assess against.

Minimum fields:

- `insuranceProfileId`
- `insuranceDocumentId`
- `versionNumber`
- `reviewStatus`
- `activatedBy`
- `activatedAt`
- `supersededAt`

Activation should happen only after the uploaded policy has been reviewed and the structured conditions are accepted as an accurate representation of the cover.

## Insurance Coverage Conditions

Coverage conditions should be expressed in machine-readable form where possible.

Examples:

- permitted operation types
- geographic limits
- aircraft or platform classes covered
- payload restrictions
- altitude or method limits
- BVLOS inclusion or exclusion
- public liability limits
- hull cover conditions
- pilot qualification requirements
- maintenance or inspection requirements
- excess / deductible references
- special exclusions

Each condition should ideally carry:

- a structured rule payload
- a policy clause or schedule reference
- an indication of whether continuation requires accountable review

## Insurance Lifecycle States

Suggested states:

- `draft`
- `under_review`
- `active`
- `renewal_due`
- `change_review_recommended`
- `expired`
- `superseded`
- `cancelled`

## Reminder Model

VerityATLAS should issue escalating reminders before expiry.

Suggested reminder stages:

- 180 days
- 90 days
- 60 days
- 30 days
- 14 days
- 7 days

## Mission Insurance Assessment

Each mission should be checked against the active insurance profile.

Suggested questions:

- is there active insurance
- is the mission type covered
- is the platform covered
- is the pilot/crew configuration inside the policy conditions
- is the location or geography covered
- is BVLOS covered if applicable
- are there exclusions triggered by this operation
- does the mission profile appear to breach a recorded policy condition or exclusion

Suggested result model:

- `pass`
- `warning`
- `fail`

These result states should be treated as advisory assurance outputs, not insurer decisions.

In other words:

- `fail` means VerityATLAS has identified a strong indication that the mission may fall outside the recorded policy envelope
- `warning` means accountable review is recommended before continuation
- `pass` means the mission appears aligned with the policy as currently recorded

Every result should cite:

- insurance condition id
- policy clause or schedule reference
- required evidence if applicable

Suggested operator-facing wording:

- "VerityATLAS indicates the operator does not currently have recorded evidence of insurance cover for this operation."
- "VerityATLAS indicates the planned mission may fall outside the recorded insurance policy terms."
- "VerityATLAS indicates the current mission profile may require changes before it sits comfortably inside the recorded policy envelope."
- "Proceeding may place the operator outside its compliance obligations or policy terms."
- "Any continuation should require explicit accountable review and recorded rationale."

Where possible, the platform should also indicate what may need to change to reduce policy risk.

Examples:

- remove BVLOS from the mission profile
- switch to a covered operation type
- assign a covered platform class
- assign a pilot whose evidence satisfies the recorded policy condition
- change the mission geography or altitude profile
- obtain additional cover or explicit insurer confirmation before continuation

## Planning And Dispatch Compliance Signalling

Recommended commercial behaviour:

- no active insurance, VerityATLAS should indicate the operator does not currently have recorded evidence of insurance cover for commercial planning
- insurance expired, VerityATLAS should indicate the operator appears outside its recorded cover period
- mission outside policy coverage, VerityATLAS should surface an advisory fail result and require explicit accountable review before continuation
- mission appears to trigger a policy exclusion, VerityATLAS should surface a fail or warning result with clause-linked rationale and, where possible, indicate what mission changes may bring it back inside the recorded cover
- policy warning condition present, explicit review required

This keeps the platform aligned to real operational accountability without implying the platform itself creates the legal obligation.

## Renewal Readiness

Insurance renewal readiness should be distinct from simple expiry reminder.

Expiry reminder asks:

- when does the policy need attention

Renewal readiness asks:

- do we have the evidence and operating record needed to support a renewal discussion

Suggested readiness indicators:

- active policy exists
- mission history under the policy is attributable
- pilot and platform records are complete
- safety events and corrective actions are recorded
- claims or incidents are recorded where needed
- maintenance history is available
- SOP changes and improvement actions are visible

Suggested readiness states:

- `ready`
- `ready_with_gaps`
- `not_ready`

## Change Review Triggers

The platform should also identify when the current policy may no longer fit how the company operates.

Example triggers:

- new platform type added
- new payload class introduced
- recurring BVLOS or complex-airspace missions outside current cover assumptions
- geographic expansion
- repeated manual workarounds due to coverage ambiguity

Suggested output:

- `insurance_change_review_recommended`

## Evidence Support

Insurance evidence support may include:

- mission counts and categories under the policy period
- platform usage and maintenance records
- pilot currency evidence
- safety events and closures
- readiness assessments
- approval and dispatch records
- post-operation evidence
- SOP amendments and improvement actions

## Insurance Renewal Support Pack

VerityATLAS should be able to prepare a draft insurance renewal support pack.

This is an internal support pack, not an insurer submission unless explicitly recorded.

Pack sections may include:

- policy metadata and active version
- mission summary under the policy
- platform and pilot utilisation summary
- safety event summary
- corrective actions and SOP changes
- maintenance and readiness evidence summary
- known evidence gaps

## Explicit Operator Responsibility

Use the same control pattern as OA renewal packs:

- system can prepare the draft
- named company person must activate it
- export and external progress are explicitly logged
- no implied automatic insurer submission

## Override Principle

VerityATLAS may support accountable continuation in limited cases where:

- cover exists but evidence is not yet fully structured in the platform
- renewal is in progress
- policy interpretation requires manual review

If this occurs, the platform should record:

- who reviewed the condition
- why continuation was allowed
- what temporary evidence was relied upon
- when the condition must be resolved

## Suggested Data Entities

- `insurance_documents`
- `insurance_profiles`
- `insurance_conditions`
- `mission_insurance_assessments`
- `insurance_lifecycle_events`
- `insurance_reminders`
- `insurance_renewal_readiness_snapshots`
- `insurance_change_recommendations`
- `insurance_evidence_pack_drafts`

## Suggested APIs

- `POST /organisations/:id/insurance-documents`
- `POST /insurance-documents/:id/upload`
- `POST /insurance-profiles/:id/activate`
- `GET /organisations/:id/insurance-profile`
- `GET /missions/:id/insurance-assessment`
- `GET /organisations/:id/insurance-renewal-readiness`
- `POST /organisations/:id/insurance-renewal-pack-drafts`

## Phased Delivery

### Phase 1

- insurance upload and retained source policy
- active policy planning gate
- mission insurance assessment

### Phase 2

- structured coverage conditions
- reminder lifecycle
- renewal readiness and evidence-gap reporting

### Phase 3

- draft insurance renewal support packs
- change-review recommendations
- richer insurer-facing evidence support

## Success Criteria

VerityATLAS should be able to answer:

- is the operator currently insured
- does this policy cover the planned mission
- when is insurance due for renewal
- what evidence supports renewal or policy change
- what operating changes suggest the insurance profile needs review
