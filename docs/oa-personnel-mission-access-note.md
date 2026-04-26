# OA Personnel And Mission Access Note

## Summary

This note introduces two linked architecture decisions for VerityATLAS:

1. mission-derived tenant isolation should be applied consistently to remaining mission-facing routes
2. Operational Authority (OA) compliance should be extended so assigned pilots are checked against OA personnel conditions as well as general readiness evidence

## Mission-derived tenant isolation

Mission-facing routes should not trust a `missionId` alone. The route should:

- resolve mission context from the stored mission record
- derive the mission `organisation_id`
- require an authenticated user with active membership in that organisation
- only then allow governance, risk, or evidence views to be returned

This keeps operator-facing mission workflows aligned with the tenant controls already added around stored files, OA, insurance, and organisation documents.

## OA personnel conditions

OA compliance should support personnel controls, not just generic mission conditions. The first slice is pilot authorisation against the active OA profile.

The model should support:

- pilot explicitly authorised under the active OA profile
- pilot pending OA amendment
- pilot restricted or inactive under the OA profile
- mission-type restrictions by pilot
- BVLOS-specific pilot authorisation or review flags

This is distinct from general pilot readiness:

- readiness checks whether the pilot is current and fit from an evidence perspective
- OA personnel checks whether the pilot is inside the operator's recorded authorised envelope

Both matter, and both should appear in mission governance.

## Pending amendment caveat

If a pilot is intended to be included under the OA but the formal CAA amendment is not yet approved, the system should not treat that pilot as fully authorised.

The pilot should be represented as:

- `pending_amendment`

That state should surface as an advisory governance finding such as:

- pilot appears aligned with readiness requirements but is pending OA amendment
- the assigned pilot is not yet evidenced as fully authorised in the recorded OA profile
- accountable review is recommended before continuation

## First implementation slice

The first implementation slice should:

- add a shared mission access service to derive organisation ownership from mission records
- use that service to protect remaining mission-governance and risk-map routes
- add an OA pilot authorisation table linked to OA profiles and pilots
- add service methods to assess pilot alignment against the active OA profile
- fold OA personnel findings into mission governance

## Deliberate boundaries

This slice does not try to complete the whole personnel model. It should remain limited to:

- pilot-to-OA-profile linkage
- advisory pending amendment support
- basic operation-type and BVLOS matching
- tenant isolation on mission-governance and risk-map

Further work can later add:

- platform-specific pilot approvals
- named crew roles beyond pilot
- OA amendment workflow support
- UI editing surfaces for OA personnel records
