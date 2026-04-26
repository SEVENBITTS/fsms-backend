# VerityATLAS Deployment Model

## Purpose

This note sets out the recommended deployment options for VerityATLAS and explains how the platform should support:

- multiple companies
- multiple concurrent operations
- different assurance and security postures

It is intended as a short reference note for product, architecture, and investor discussions.

This note assumes:

- company: `VerityAir Systems Ltd`
- platform: `VerityATLAS`
- primary market: regulated commercial drone operators
- secondary market: higher-assurance enterprise, government, and defence users

## Core Position

VerityATLAS should be deployable in three ways:

1. multi-tenant cloud
2. single-tenant hosted
3. private or defence-managed deployment

The recommended primary commercial model is:

- `multi-tenant cloud SaaS`

The recommended higher-assurance expansion path is:

- `single-tenant hosted`
- `private cloud / on-prem`

## Can VerityATLAS Support Multiple Companies Simultaneously

Yes, that should be a core product capability.

The platform direction already supports this well because operational governance is being anchored to organisation-level objects such as:

- Operational Authorisation
- insurance
- SOPs
- missions
- platforms
- pilots
- evidence packs
- risk surfaces

In production terms, the platform should operate as:

- one platform service
- many tenant organisations
- each tenant isolated by company boundary
- many active missions and reviews running at the same time

That means the end product should be capable of serving multiple operators simultaneously from a cloud-based environment, provided tenant isolation and access control are properly enforced.

## Option 1: Multi-Tenant Cloud

### Best fit

- commercial drone operators
- SMEs and growth-stage operators
- customers who want fast adoption and lower setup friction

### Model

- one shared VerityATLAS application stack
- one shared control plane
- each customer isolated as a tenant or organisation
- organisation-scoped data, users, permissions, and evidence

### Advantages

- strongest commercial scalability
- lowest onboarding friction
- best fit for recurring SaaS revenue
- efficient updates and feature rollout
- easier to maintain a common product baseline

### Risks and requirements

- strict tenant isolation is mandatory
- organisation-scoped authorisation must be enforced everywhere
- auditability and data segregation must be provable
- incident impact can be broader if the shared platform is not well controlled

### Recommended use

This should be the default delivery model for the commercial market.

## Option 2: Single-Tenant Hosted

### Best fit

- large enterprise operators
- critical infrastructure customers
- higher-assurance commercial customers
- customers who require stronger isolation than standard SaaS

### Model

- one dedicated hosted environment per customer
- isolated database and app instance
- managed by VerityAir Systems Ltd or a trusted hosting arrangement

### Advantages

- stronger isolation story
- easier customer-specific configuration
- lower shared-platform risk
- good bridge between SaaS and defence-grade delivery

### Risks and requirements

- higher cost to serve
- more operational overhead
- version management can become more complex
- customisation pressure can grow if not controlled

### Recommended use

This is the most likely premium deployment option for higher-value enterprise accounts.

## Option 3: Private / Defence Deployment

### Best fit

- defence users
- government users
- sovereign or restricted data environments
- customers requiring private cloud or on-prem operation

### Model

- VerityATLAS deployed into a customer-controlled environment
- private cloud, air-gapped, or tightly controlled hosting posture
- operational data remains inside the customer boundary

### Advantages

- strongest control and assurance posture
- best fit for sensitive mission and operational data
- supports procurement cases where shared SaaS is not acceptable

### Risks and requirements

- highest deployment and support complexity
- slowest upgrade cycle
- more difficult observability and support operations
- needs disciplined packaging, configuration, and deployment automation

### Recommended use

This should be treated as a deliberate later-stage delivery option for defence and sensitive public-sector customers.

## Recommended Product Strategy

### Phase 1

- build around `multi-tenant cloud SaaS`
- design for multiple companies from the start
- keep all core domains organisation-scoped

### Phase 2

- support `single-tenant hosted` for premium or higher-assurance customers

### Phase 3

- package for `private / defence deployment` where required

This keeps the primary commercial route clean while preserving a credible path into dual-use and defence markets.

## Minimum Architecture Requirements

For any of these deployment models to be credible, VerityATLAS should support:

- organisation or tenant identity as a first-class concept
- organisation-scoped access control
- organisation-scoped data queries by default
- audit logging of user and governance actions
- secure evidence storage
- role-based control for accountable review and override
- deployment automation and observability

For multi-tenant cloud specifically, the architecture should also assume:

- strict tenant separation in every read and write path
- no cross-tenant identifiers in operator-facing responses
- strong operational monitoring and backup controls

## Guidance For Positioning

The safest and strongest positioning line is:

VerityATLAS is designed to operate as a multi-company assurance platform in the cloud, with higher-isolation delivery options for enterprise and defence customers.

That is stronger than claiming only one delivery route, and more credible than implying defence-grade hosting on day one if it is not yet fully productised.

## Recommendation

The recommended deployment strategy is:

1. `multi-tenant cloud` as the primary commercial product
2. `single-tenant hosted` as the premium higher-assurance option
3. `private / defence deployment` as the controlled later-stage route

This gives VerityAir Systems Ltd the broadest commercial path while keeping VerityATLAS aligned with enterprise and defence expansion.
