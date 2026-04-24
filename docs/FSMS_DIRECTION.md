# VerityAtlas Product Direction

## Purpose

The end product is VerityAtlas, a UAV operations platform that supports safety assurance from planning through live operations and post-operation review.

VerityAtlas should be sharper and more specialised than a generic all-in-one drone business tool. The company ethos is to build an audit-ready operational assurance and BVLOS-readiness platform for serious UAV operators.

The system should help answer:

- Is this mission safe and authorised to proceed?
- Is the UAV fit to fly?
- Is the pilot or operator fit and current?
- Is the mission being operated inside its approved envelope?
- Can the organisation prove what happened, who decided what, and why?

Future work should stay focused on safety, compliance, operational assurance, and audit evidence.

## Company Ethos

VerityAir Systems Ltd should be positioned around operational assurance rather than broad drone administration.

VerityAtlas should therefore prioritise:

- evidence-led operational planning
- risk, compliance, and assurance traceability
- CAA-first regulatory clarity, including CAP 722 alignment where applicable
- auditable records that show what changed, who reviewed it, and why
- live-operations awareness that supports safe operator decisions without pretending to replace pilot accountability
- BVLOS-readiness foundations that can be proven incrementally before higher-risk operating models are added

VerityAtlas should avoid becoming:

- a generic CRM, invoicing, or job-booking product
- a loose document store without assurance logic
- a consumer-style flight app
- an automated legal sign-off engine
- a system that gives definite pilot commands without approved authority, integration, and safety case coverage

The practical product test is: if a feature does not improve operational planning, safety assurance, compliance evidence, live operational awareness, or auditability, it should be treated as secondary until the core assurance platform is stronger.

## Active Product Core

The TypeScript backend is the active VerityAtlas product core.

It owns the long-term direction for:

- missions and lifecycle state
- telemetry ingestion and telemetry history
- mission replay from telemetry
- alerts and running assurance checks
- audit-relevant mission events
- future platform, pilot, risk, regulatory, and reporting domains

New durable backend features should normally be added to the TypeScript system unless there is a deliberate migration or prototype reason not to.

## Python Replay Prototype

The Python replay system remains a prototype and reference implementation.

It was built first to prove:

- flight replay behaviour
- HUD concepts
- early airspace display
- early compliance evaluation
- prediction and risk display ideas

The Python replay should not be treated as the long-term source of truth for mission assurance data. It is valuable as a working reference while replay, compliance, and assurance capabilities move into the TypeScript product core.

## Concept-Test Assumptions

Some current behaviour is intentionally simplified for early system-building.

Known prototype assumptions:

- Terrain elevation is fixed at `20.0 m` because terrain maps have not yet been integrated.
- A single airspace restriction is used to build and test the system shape.
- Early compliance and replay behaviour are concept tests rather than complete regulatory automation.

These assumptions are acceptable during prototype development, but they must remain visible. They should not become hidden legal or safety claims.

## Regulatory Direction

The first regulatory profile is UK CAA focused.

The system should be designed so UK requirements can be represented first, while leaving room for later expansion into other countries and possible military use.

Regulatory logic should be structured as profiles or rule packs rather than scattered hardcoded checks. Future profiles may differ by:

- operation category
- authorisation requirements
- pilot competency
- platform requirements
- airspace permissions
- evidence retention
- incident reporting
- approval and override rules

## Audit Principle

VerityAtlas should be built as an evidence machine.

Important safety and compliance decisions should produce auditable records, including:

- what was checked
- what the result was
- who or what made the decision
- when it happened
- what evidence supported it
- whether anyone overrode it

This applies across planning, pre-flight assurance, live operations, replay, and post-flight review.

## Implementation Focus

Build in this order of importance:

1. Audit trail strength
2. Mission safety decisions
3. Planning-to-live-operation continuity
4. Regulatory clarity
5. Practical readiness for real users

Avoid spending early effort on polish, advanced terrain, multi-country rule engines, military-specific workflows, or complex UI unless they directly support the current safety and audit path.

