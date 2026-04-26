# VerityATLAS Security And Data Protection Backlog

## Purpose

This document turns the security and data-protection architecture into a practical implementation backlog.

It is grouped into:

- must-have before production
- should-have for enterprise
- later for defence or private deployment

It is intended to guide delivery sequencing rather than act as a generic wishlist.

This backlog follows:

- `docs/verityatlas-security-data-protection-architecture.md`
- `docs/verityatlas-deployment-model.md`
- `docs/assurance-governance-architecture.md`

## Delivery Principles

- secure the shared commercial platform first
- remove trust in client-supplied role context as early as possible
- enforce organisation boundaries in code, storage, and file access
- make sensitive actions auditable
- keep storage abstraction flexible so cloud, hosted, and private deployments can share the same core model

## Must-Have Before Production

These are the controls I would treat as mandatory before calling VerityATLAS production-ready for real customer use in a multi-company environment.

### 1. Real Authentication

Required outcome:

- replace UI-selected or header-only actor context with real authenticated identity

Implementation items:

- add `users` and `organisation_memberships` tables
- choose primary auth pattern
- store password hashes securely if local auth is used
- issue secure sessions or tokens
- add login, logout, and identity middleware

### 2. Persistent RBAC

Required outcome:

- role-based access is derived from stored membership, not caller-supplied values

Implementation items:

- add persisted roles per organisation membership
- create shared authorization middleware
- map routes to required roles
- keep platform-admin separate from tenant roles

### 3. Tenant Isolation Review And Enforcement

Required outcome:

- every organisation-scoped route and repository enforces tenant boundaries

Implementation items:

- review all repository queries for organisation scoping
- add organisation-scope checks for mission, document, evidence, and file access
- create test coverage for cross-tenant denial cases
- review operator-facing responses for leaked identifiers

### 4. Secure File Upload Hardening

Required outcome:

- uploaded documents are validated before being relied on

Implementation items:

- add allowed content-type list
- add stricter maximum file size handling
- add basic file signature or extension sanity checks
- quarantine unexpected content types
- reject empty or malformed uploads consistently

### 5. Malware Scanning Or Quarantine Workflow

Required outcome:

- uploaded files are not blindly trusted

Implementation items:

- introduce scan status on stored files
- mark files as `pending_scan`, `clean`, `blocked`
- prevent preview/download of blocked files
- integrate with malware scanner when available

### 6. Stored File Access Audit Logging

Required outcome:

- sensitive file access is traceable

Implementation items:

- create `stored_file_access_events`
- record metadata read, preview, download, and upload actions
- record user, role, organisation, file ID, timestamp, and action
- expose logs to audit/governance reporting later

### 7. Encryption-At-Rest Strategy

Required outcome:

- files and sensitive records have a defined at-rest protection model

Implementation items:

- decide whether to encrypt files in application layer, storage layer, or both
- define encryption key ownership and rotation model
- document how local development differs from production

### 8. Secrets Management Baseline

Required outcome:

- secrets are managed safely

Implementation items:

- remove dependence on unmanaged long-lived secrets where possible
- document secret classes
- define rotation process
- prepare for managed secret store integration

### 9. Backup And Restore Controls

Required outcome:

- operational and evidence data can be restored without guesswork

Implementation items:

- define backup scope for database and file store
- document restore procedure
- test restore path
- ensure backups are protected and encrypted

### 10. Basic Security Headers And API Hardening

Required outcome:

- public-facing surface is less exposed to basic web risks

Implementation items:

- add security headers
- review response content types
- review raw upload routes carefully
- document TLS-only production requirement

### 11. Privacy And Retention Policy Model

Required outcome:

- the platform knows what should be retained, archived, or deleted

Implementation items:

- classify key data types
- define retention categories
- add retention metadata fields where needed
- add archival state where appropriate

### 12. Production Security Test Coverage

Required outcome:

- security assumptions are tested, not just described

Implementation items:

- cross-tenant access tests
- forbidden role tests
- file access denial tests
- blocked-file tests
- route-level authorization tests

## Should-Have For Enterprise

These are not the bare minimum for first production, but they become important for enterprise credibility and larger customers.

### 1. SSO And Enterprise Identity Integration

Implementation items:

- SAML or OIDC integration
- domain-controlled onboarding
- admin-managed organisation membership sync

### 2. MFA For Privileged Roles

Implementation items:

- require MFA for `compliance_manager`, `accountable_manager`, and `admin`
- step-up auth for highly sensitive actions if needed

### 3. Customer-Visible Access Logs

Implementation items:

- surface who accessed sensitive documents
- allow filtering by file, user, and action
- expose download/export history

### 4. Fine-Grained Document Policies

Implementation items:

- document-level role restrictions
- category-based restrictions
- restricted file flags for especially sensitive records

### 5. Secure Object Storage Migration Path

Implementation items:

- abstract away local file path dependence
- support managed blob or object storage
- add signed URL or mediated-download pattern where appropriate

### 6. Key Management Service Integration

Implementation items:

- integrate with managed KMS
- define key rotation behavior
- separate encryption keys from app secrets

### 7. Data Export And Subject Rights Tooling

Implementation items:

- export personal data tied to a user
- export organisation document inventories
- support controlled deletion or restricted retention handling

### 8. Security Monitoring And Alerting

Implementation items:

- alert on repeated failed access attempts
- alert on unusual download volume
- alert on unusual admin activity

### 9. Formal Security Administration Surfaces

Implementation items:

- user and role management screens
- role approval flows
- organisation security settings

### 10. Independent Security Review Readiness

Implementation items:

- security design documentation kept current
- threat-model summary maintained
- test evidence available for review

## Later For Defence Or Private Deployment

These are important for higher-assurance, sovereign, or defence-sensitive delivery, but they should not distract the commercial production baseline.

### 1. Private Deployment Packaging

Implementation items:

- environment-packaging discipline
- reproducible deployment bundles
- controlled configuration injection

### 2. Stronger Administrative Separation

Implementation items:

- separate platform operations from customer administration
- break-glass admin procedures
- stronger approval for high-impact admin actions

### 3. Sovereign Or Restricted Storage Options

Implementation items:

- customer-controlled storage endpoints
- restricted-region deployment options
- environment-specific encryption ownership

### 4. Air-Gapped Or Low-Connectivity Support

Implementation items:

- offline-capable file and evidence handling where possible
- sync and export controls for disconnected environments

### 5. Deployment Provenance And Hardening Evidence

Implementation items:

- hardened build process
- deployment integrity evidence
- documented patching and update rules

### 6. Enhanced Logging Protection

Implementation items:

- append-oriented immutable logging where required
- log shipping to customer-controlled monitoring if required

### 7. Higher-Assurance Access Controls

Implementation items:

- stricter separation of duties
- dual-approval for sensitive export or activation actions
- time-bounded privileged access

### 8. Security Baseline Validation For Private Environments

Implementation items:

- deployment validation checklist
- environment hardening checklist
- backup and restore verification for isolated environments

## Proposed Build Order

Recommended implementation sequence:

1. real authentication
2. persistent RBAC
3. tenant-isolation audit and fixes
4. file-upload hardening
5. file-access audit logs
6. privacy and retention baseline
7. encryption-at-rest and secrets strategy implementation
8. enterprise identity features
9. secure object storage migration
10. private and defence deployment hardening

## Suggested Initial Tickets

The first concrete tickets I would raise from this backlog are:

1. add user and organisation membership model
2. add authentication middleware and current-user resolution
3. replace stored-file role query/header logic with membership-derived access
4. create stored-file access audit event table and writer
5. enforce organisation checks on stored-file metadata and content routes
6. add file scan status and block access to unsafe uploads
7. define retention fields for uploaded regulatory and support documents

## Success Criteria

This backlog is successful when VerityATLAS can demonstrate:

- authenticated access to tenant-scoped records
- role-controlled access to files and evidence
- reliable audit logs for sensitive access
- protected document storage and retrieval
- defined retention and recovery controls
- a clear path from commercial SaaS security to enterprise and private high-assurance delivery
