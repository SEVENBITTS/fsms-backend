# Operational Authority Lifecycle, Renewal Readiness, And Evidence Support

## Purpose

This document defines how VerityATLAS should manage the lifecycle of a company's Operational Authorisation after initial activation.

The OA should not be treated as a static uploaded file.

It should be a managed regulatory lifecycle object with:

- renewal reminders
- expiry controls
- variation readiness
- evidence support

## Strategic Principle

VerityATLAS should help the operator:

- operate under the OA
- remain inside the OA
- recognise when the OA is approaching expiry or no longer fits operations
- prepare the evidence needed for renewal or variation

VerityATLAS should not imply that the CAA renewal or variation is automatically submitted unless that integration actually exists.

## Lifecycle States

Suggested OA lifecycle states:

- `draft`
- `under_review`
- `active`
- `renewal_due`
- `variation_review_recommended`
- `expired`
- `superseded`
- `revoked`

## Core Lifecycle Dates

Minimum date fields:

- `issueDate`
- `effectiveFrom`
- `expiresAt`
- `reviewWindowStart`
- `renewalReminderStart`
- `finalReminderAt`

## Reminder Model

VerityATLAS should generate escalating reminders before OA expiry.

Suggested stages:

- 180 days
- 90 days
- 60 days
- 30 days
- 14 days
- 7 days

Reminder output may include:

- notification in product
- email
- dashboard warning
- planning and dispatch warnings where appropriate

## Renewal Readiness

Renewal readiness is not the same as expiry reminder.

Expiry reminder asks:

- when does the OA need attention

Renewal readiness asks:

- do we have the evidence and control state needed to support renewal

Suggested readiness indicators:

- current OA active
- active insurance profile current for the review period
- evidence coverage complete for review period
- pilot readiness records available
- platform maintenance history complete
- mission approval and dispatch evidence present
- safety events recorded and closed appropriately
- SOP changes documented
- improvement actions tracked

Suggested readiness states:

- `ready`
- `ready_with_gaps`
- `not_ready`

## Variation Readiness

VerityATLAS should also detect when the current OA may no longer fit actual operations.

Example triggers:

- missions repeatedly planned near existing operational limits
- introduction of new platform types
- new mission methods
- new geography or airspace conditions
- repeated operator workarounds or overrides

Suggested output:

- `variation_review_recommended`

This should be advisory, evidence-linked, and auditable.

## Evidence Support

The OA should act as an anchor for evidence generated while operating under it.

Relevant evidence classes:

- mission planning approvals
- dispatch evidence
- insurance assessment outcomes
- airspace and mission risk assessments
- pilot readiness evidence
- platform readiness and maintenance records
- mission outcomes
- safety events
- post-operation evidence and sign-off
- SOP amendments and improvement actions

This evidence should be grouped by:

- OA profile
- date range
- mission type
- operating area
- platform
- pilot/crew

## Renewal Support Pack

VerityATLAS should be able to prepare a structured renewal support pack.

This pack is not the same as regulator submission.

It is an internal support bundle that helps the operator:

- review operational evidence
- identify missing items
- export relevant supporting material

Pack sections may include:

- OA metadata and active version
- linked insurance profile summary where relevant
- operational summary under the OA
- mission statistics
- safety events and closures
- pilot and platform readiness history
- approval and dispatch evidence summaries
- post-operation evidence summaries
- SOP and continuous improvement changes
- known evidence gaps

## Planning And Compliance Signalling Near Renewal

Recommended behaviour:

- before expiry: warnings only
- after expiry: VerityATLAS should indicate that the operator no longer has recorded current OA evidence for commercial planning unless a newer OA has been activated
- during severe readiness gap: warning or controlled restriction depending on tenant policy and accountability model

## Suggested Data Entities

- `oa_lifecycle_events`
- `oa_reminders`
- `oa_renewal_readiness_snapshots`
- `oa_variation_recommendations`
- `oa_evidence_pack_drafts`

## Suggested APIs

- `GET /organisations/:id/oa-lifecycle`
- `GET /organisations/:id/oa-renewal-readiness`
- `GET /organisations/:id/oa-variation-recommendations`
- `POST /organisations/:id/oa-renewal-pack-drafts`
- `GET /oa-renewal-pack-drafts/:id`

## UX Rules

- make expiry visible
- separate reminder from readiness
- separate readiness from submission
- always show responsibility remains with the operator
- avoid wording that suggests VerityATLAS itself is the regulator

## Phased Delivery

### Phase 1

- OA dates
- expiry reminders
- expiry signalling and operator review workflow on expiry

### Phase 2

- renewal readiness model
- evidence-gap reporting
- variation recommendation triggers

### Phase 3

- draft renewal support pack
- export support
- internal review workflows

## Success Criteria

VerityATLAS should be able to answer:

- when is this OA due for renewal
- is the operator ready to support renewal
- what evidence exists under this OA
- what gaps remain
- does current operating behaviour suggest variation is needed
