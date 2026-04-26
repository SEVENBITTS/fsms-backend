# OA Renewal Evidence Pack With Explicit Operator Activation

## Purpose

This document defines how VerityATLAS should prepare a renewal support pack for an Operational Authorisation while preserving explicit operator responsibility.

The goal is to avoid the failure mode:

"we thought the system automatically did it"

## Core Principle

VerityATLAS may prepare the pack automatically.

It must not represent the pack as actioned, submitted, or externally progressed until a designated company person explicitly activates it.

## Product Boundary

VerityATLAS should do:

- draft evidence assembly
- evidence completeness checks
- export generation
- acknowledgement capture
- audit logging

VerityATLAS should not imply:

- automatic CAA submission
- automatic renewal filing
- automatic variation filing

unless those integrations explicitly exist.

## State Model

Suggested states:

- `draft`
- `ready_for_internal_review`
- `activated_by_operator`
- `exported`
- `submitted_externally_recorded`
- `closed`

## Draft Pack Generation

The pack may be generated automatically in draft using:

- mission records
- approval and dispatch evidence
- insurance assessment records where relevant
- pilot readiness evidence
- platform maintenance and readiness records
- safety events
- audit snapshots
- post-operation evidence
- SOP amendments and improvement records

The key control:

- draft generation may be automatic
- progression beyond draft requires explicit human action

## Explicit Activation Gate

A designated company individual must activate the pack before it can be exported or treated as ready for renewal support.

Recommended activation roles:

- accountable manager
- compliance lead
- operations manager
- named authorised representative

## Required Activation Record

Capture:

- `activatedByUserId`
- `activatedByName`
- `activatedByRole`
- `organisationId`
- `packId`
- `packVersion`
- `activatedAt`
- acknowledgement text

Suggested acknowledgement text:

"I acknowledge that this renewal support pack has been generated for internal review. Submission to the CAA remains the responsibility of the operator."

## Export Control

Recommended rule:

- no export without activation

Optional stronger rule:

- high-assurance tenants may require dual sign-off before export

## Revision Control

If the underlying evidence changes after activation:

- pack version increments
- prior version remains auditable
- activation may need repeating for the revised version

## Evidence Gaps

If evidence is incomplete, the pack should still be allowed to exist in draft.

But before activation, VerityATLAS should clearly show:

- missing evidence items
- unresolved safety events
- missing readiness records
- incomplete review windows
- missing SOP or change-management records

Suggested readiness indicators:

- `complete`
- `complete_with_warnings`
- `incomplete`

## Audit Trail

Every important action should be logged:

- draft generated
- draft revised
- evidence added or excluded
- activation completed
- export completed
- external submission recorded manually

This log should support later audit and accountability.

## Suggested Data Entities

- `oa_renewal_pack_drafts`
- `oa_renewal_pack_versions`
- `oa_renewal_pack_items`
- `oa_renewal_pack_activation_records`
- `oa_renewal_pack_exports`

## Suggested APIs

- `POST /organisations/:id/oa-renewal-packs/draft`
- `GET /oa-renewal-packs/:id`
- `POST /oa-renewal-packs/:id/activate`
- `POST /oa-renewal-packs/:id/export`
- `POST /oa-renewal-packs/:id/record-external-submission`

## UX Rules

The product should say clearly:

- "VerityATLAS has prepared a renewal support pack."
- "This pack has not been submitted to the CAA."
- "Submission remains the responsibility of the operator."
- "Activation confirms company awareness and review responsibility."
- avoid wording that could be read as "renewal has been handled automatically"

## Suggested UI Flow

1. system assembles draft pack
2. user reviews included evidence and gap list
3. designated representative activates pack
4. pack becomes exportable
5. operator records any external submission manually if needed

## Risks To Avoid

- silent background generation being mistaken for submission
- ambiguous UI language such as "renewal complete"
- missing named accountability
- overwriting prior evidence pack versions without trace

## Success Criteria

VerityATLAS should be able to prove:

- when the pack was generated
- what evidence it contained
- who activated it
- what wording they acknowledged
- whether it was exported
- whether external submission was ever manually recorded

## Positioning Line

VerityATLAS automates renewal readiness and evidence preparation while preserving explicit operator responsibility for review and submission.
