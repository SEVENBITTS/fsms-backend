# VerityATLAS Security And Data Protection Architecture

## Purpose

This document defines the required security and data-protection architecture for VerityATLAS.

It is intended to answer:

- what security posture the platform should be designed around
- what data-protection controls are needed for commercial production use
- how that posture should evolve for enterprise and defence-sensitive delivery

It is a top-level reference note for product, architecture, compliance, and deployment decisions.

This note assumes:

- company: `VerityAir Systems Ltd`
- platform: `VerityATLAS`
- primary market: regulated commercial drone operators
- secondary market: higher-assurance enterprise, government, and defence users

## Core Position

VerityATLAS will hold and process sensitive information, including:

- company Operational Authorisation records
- insurance records
- certificates and supporting documents
- mission plans and mission events
- pilot and platform records
- audit evidence and sign-offs
- renewal evidence packs
- operational risk and safety data

Because of that, security and data protection cannot be treated as add-ons.

They must be part of the platform architecture from the point where VerityATLAS serves real companies in a shared environment.

## Security Principle

VerityATLAS should assume:

- every company is a separate trust boundary
- every user action is attributable
- every document and evidence record may become part of an audit, renewal, or dispute process
- every file and operational record should be protected against unauthorised access, accidental loss, cross-tenant exposure, and silent tampering

## Current-State Reality

The current build is moving in the right direction, but it is not yet a complete production security model.

Strengths already visible in the build:

- organisation-scoped domain objects are becoming first-class
- audit and evidence flows already exist
- stored file metadata and checksums are now recorded
- lightweight role hooks are now in place around file access

Important gaps still to close before production:

- no full authentication and user identity layer
- no full tenant-isolation enforcement across all routes and queries
- no persistent RBAC system tied to real users and organisations
- no encryption-at-rest design for stored files and sensitive database content
- no malware scanning for uploaded files
- no retention/deletion/export model for privacy and governance obligations
- no full access audit trail for file open, download, or export actions
- no formal secrets-management or key-management model in the application design

## Threat Model

Minimum threats the architecture should explicitly protect against:

- cross-tenant data leakage
- unauthorised internal or external access
- accidental disclosure of uploaded source documents
- misuse of document preview and download functions
- malicious or malformed file uploads
- silent evidence alteration or replacement
- excessive privilege assigned to operational users
- compromise of stored credentials, tokens, or secrets
- loss of auditability for renewal, override, and sign-off decisions
- accidental data retention beyond need
- data loss during incident or recovery events

## Data Classes

Recommended high-level data classes:

### 1. Operationally Sensitive

- live mission and dispatch data
- mission timelines
- readiness and override records
- risk and safety signals

### 2. Regulatory And Assurance Sensitive

- OA source documents
- insurance source documents
- evidence packs
- audit evidence
- sign-offs and accountable review records

### 3. Personal Data

- pilot identity and competency records
- named signatories
- uploader identities
- reviewer identities

### 4. Commercially Sensitive

- contracts
- customer-specific supporting documents
- operating procedures and manuals

Different data classes may share the same platform, but they should not all have the same access pattern or retention logic.

## Security Architecture Layers

### Identity

The platform should move from header or query-supplied actor context to real identity.

Required direction:

- user identity managed centrally
- each user tied to one or more organisations
- each request resolved to a user, organisation scope, and permitted role set

### Authentication

Production authentication should support:

- secure session or token-based authentication
- MFA for privileged roles
- short-lived access tokens where tokens are used
- secure password storage if password auth is offered
- SSO capability for enterprise accounts later

### Authorisation

Authorisation should be:

- role-based
- organisation-scoped
- object-aware where needed

Examples:

- a viewer may read metadata but not file content
- an operator may work mission flows but not approve governance overrides
- a compliance manager may review OA and insurance source records
- an accountable manager may activate packs or approve certain exceptions
- an admin may manage tenant settings but should still be organisation-scoped in multi-tenant environments unless there is a controlled platform-admin layer

### Tenant Isolation

For multi-tenant cloud, tenant isolation must be explicit and universal.

That means:

- every relevant table carries organisation or tenant context
- every repository read and write filters by organisation where required
- no route should trust a client-provided identifier without scope validation
- platform-admin access must be separate from tenant-user access
- file paths, downloads, and previews must not bypass organisation checks

### Storage Security

Stored evidence and document files should support:

- encryption at rest
- checksum verification
- immutable audit records for key evidence events
- controlled preview and download paths
- storage path abstraction so local storage can be replaced by managed object storage later

### Transmission Security

Production delivery should assume:

- TLS everywhere
- no plain HTTP for customer traffic
- secure headers
- safe handling of file download and inline preview responses

### Secrets And Key Management

Secrets should not be embedded in code or unmanaged environment sprawl.

Required direction:

- managed secrets store
- controlled rotation
- separate application secrets, database credentials, and encryption keys
- documented key ownership and recovery procedures

### Auditability

Security-sensitive actions should be auditable.

Examples:

- login success and failure
- role changes
- upload of OA, insurance, and supporting documents
- preview, open, download, and export of stored files
- activation of profiles
- creation of evidence packs
- override creation and approval

Audit logs should be:

- append-oriented
- time-stamped
- attributable to a user identity
- protected from routine tampering

## File Upload Security

Uploaded documents are a major risk surface.

The platform should protect against:

- oversized uploads
- unexpected content types
- executable or disguised content
- malware
- duplicate or replacement ambiguity

Required file-upload posture:

- size limits
- content-type validation
- filename sanitisation
- checksum creation
- malware scanning or quarantine workflow
- safe preview behavior
- file access logging

## Data Protection Model

VerityATLAS should support data protection by design and by default.

That means:

- least-privilege access
- data minimisation
- clear purpose for stored data
- retention rules
- export capability where required
- deletion or archival rules where lawful and appropriate

## Privacy And Regulatory Considerations

For UK and similar commercial use, the platform should be designed assuming:

- personal data rights may apply
- organisational records may require defined retention
- safety and audit evidence may need longer retention than ordinary working data
- deletion requests may need reconciliation with legal or regulatory retention duties

This means the architecture should distinguish:

- deletable operational convenience data
- retained regulatory evidence
- archived records
- legally constrained records

## Role Model

Suggested baseline role set:

- `viewer`
- `operator`
- `operations_manager`
- `compliance_manager`
- `accountable_manager`
- `admin`
- `platform_admin`

Important distinction:

- tenant roles act inside one organisation
- platform roles act at the service layer and should be tightly restricted

## Recommended Control Model By Deployment Type

### Multi-Tenant Cloud

Minimum assumptions:

- strict tenant separation
- per-request organisation scope validation
- RBAC enforced everywhere
- secure cloud storage for files
- centralised logging and monitoring
- encrypted backups

### Single-Tenant Hosted

Additional advantages:

- stronger environment isolation
- customer-specific data boundary
- simpler assurance story for larger customers

Still required:

- RBAC
- encryption
- auditability
- patching and monitoring

### Private / Defence Deployment

Additional expectations:

- customer-controlled network boundary
- more restrictive admin model
- stronger configuration control
- stronger evidence of hardening and deployment provenance
- support for sovereign or disconnected operation where required

## Minimum Production Security Requirements

Before VerityATLAS should be considered production-ready for multi-company use, it should have:

- real authentication
- persistent RBAC bound to users and organisations
- tenant-isolation review across all core routes and repositories
- secure file ingestion controls
- secure stored-file access controls
- encryption-at-rest strategy
- secrets-management strategy
- access audit logs
- backup and restore controls
- incident logging and monitoring

## Security Design Guidance For Current Build

The current implementation should evolve in this order:

1. replace role context passed from the UI with authenticated user context
2. enforce organisation scope on every file and document access path
3. add upload scanning and stricter file validation
4. add access logging for preview, download, and export
5. move from local file storage abstraction to deployable secure storage options
6. add retention and archival controls

## Success Criteria

VerityATLAS should eventually be able to prove:

- who accessed sensitive records
- why they were allowed to access them
- that one customer cannot see another customer's records
- that evidence files were not silently modified
- that uploaded records are retained, exported, archived, or deleted according to policy
- that the deployment model in use matches the customer's assurance needs

## Related Documents

- `docs/assurance-governance-architecture.md`
- `docs/assurance-governance-delivery-plan.md`
- `docs/verityatlas-deployment-model.md`

## Positioning Line

VerityATLAS should be designed as an assurance platform where security, tenant isolation, and data protection are part of the operating model, not a later wrapper around it.
