# VerityATLAS Security Implementation Plan

## Purpose

This document turns the highest-priority UK GDPR and security gaps into a sequenced implementation plan for the current VerityATLAS build.

It starts with:

- authentication
- organisation membership
- RBAC
- tenant isolation

It then sequences the next highest-priority production security controls.

This plan is intended to guide build work in the current TypeScript backend and operator UI, not act as a generic policy note.

It follows:

- `docs/verityatlas-uk-gdpr-readiness-checklist.md`
- `docs/verityatlas-security-data-protection-backlog.md`
- `docs/verityatlas-security-data-protection-architecture.md`

## Guiding Principle

The first security milestone is not “more roles”.

It is:

- real user identity
- real organisation membership
- real permission decisions
- real tenant boundaries

Without those, later privacy and security controls sit on weak foundations.

## Current Starting Point

The build currently has:

- organisation IDs appearing in newer domains
- lightweight role hooks on stored-file routes
- document and evidence audit thinking
- stored-file metadata and checksum capture

The build does not yet have:

- authenticated users
- persisted organisation memberships
- membership-derived RBAC
- system-wide tenant enforcement

That means the correct next build sequence is:

1. auth foundation
2. organisation membership and RBAC
3. tenant-isolation enforcement
4. audit and file hardening
5. privacy and retention baseline

## Phase 1: Identity Foundation

### Goal

Introduce real user identity and session context so the platform no longer trusts role hints from the UI.

### Outcomes

- users exist as first-class records
- login resolves a current authenticated user
- requests can be associated with a user ID

### Proposed tables

#### `043_create_users.sql`

Suggested columns:

- `id text primary key`
- `email text not null unique`
- `display_name text not null`
- `password_hash text not null`
- `status text not null`
- `mfa_state text not null default 'not_enabled'`
- `last_login_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### `044_create_user_sessions.sql`

Suggested columns:

- `id text primary key`
- `user_id text not null references users(id)`
- `session_token_hash text not null`
- `expires_at timestamptz not null`
- `revoked_at timestamptz null`
- `created_at timestamptz not null default now()`

### Proposed modules

- `src/auth`
- `src/users`

Expected files:

- `auth.repository.ts`
- `auth.service.ts`
- `auth.controller.ts`
- `auth.routes.ts`
- `auth.middleware.ts`
- `auth.types.ts`
- `auth.validators.ts`
- `auth.errors.ts`

### Route impact

New routes:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Middleware outcome:

- add authenticated current-user resolution to request context

### First implementation notes

- use secure password hashing
- use session tokens or secure token approach
- do not carry forward UI-selected actor role as an authority source

### Tests

- login success
- login failure
- `GET /auth/me` requires authentication
- revoked session cannot access protected route

## Phase 2: Organisation Membership And RBAC

### Goal

Make organisation membership and role assignment persistent, so permissions are derived from stored membership rather than caller input.

### Outcomes

- users belong to one or more organisations
- organisation roles are stored and enforced
- stored-file access uses membership-derived roles

### Proposed tables

#### `045_create_organisation_memberships.sql`

Suggested columns:

- `id text primary key`
- `organisation_id text not null`
- `user_id text not null references users(id)`
- `role text not null`
- `status text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique constraint:

- `(organisation_id, user_id)`

#### `046_create_platform_admin_memberships.sql`

Suggested columns:

- `id text primary key`
- `user_id text not null references users(id)`
- `role text not null`
- `status text not null`
- `created_at timestamptz not null default now()`

### Proposed modules

- `src/organisation-memberships`
- shared `authorization` middleware in `src/auth` or `src/security`

### Route impact

New routes:

- `GET /organisations/:organisationId/memberships`
- `POST /organisations/:organisationId/memberships`
- `PATCH /organisation-memberships/:membershipId`

### First implementation notes

- role set should map to current platform assumptions:
  - `viewer`
  - `operator`
  - `operations_manager`
  - `compliance_manager`
  - `accountable_manager`
  - `admin`
- `platform_admin` should remain separate from tenant roles

### Existing route upgrade targets

First routes to convert:

- stored-file metadata route
- stored-file preview/download route
- stored-file upload route
- document portal routes
- OA and insurance upload routes

### Tests

- user with membership can access allowed route
- user without membership is denied
- user with low privilege is denied high-privilege route
- file routes no longer accept client-supplied actor role as authority

## Phase 3: Tenant Isolation Enforcement

### Goal

Make organisation boundaries enforceable across records, routes, and file access paths.

### Outcomes

- organisation scope is derived from membership and object ownership
- cross-tenant access attempts fail consistently
- file routes validate the file belongs to an accessible organisation

### Workstreams

#### 1. Repository audit

Review all repositories for:

- organisation filter missing
- mission access not linked back to organisation membership
- object lookups that can bypass tenant checks

#### 2. Route audit

Review all routes that expose:

- mission data
- OA and insurance data
- stored files
- supporting documents
- evidence exports

#### 3. Response audit

Check for:

- cross-tenant IDs in responses
- overly broad list endpoints
- object discovery through predictable identifiers

### Proposed supporting module

- `src/tenant-scope`

Expected files:

- `tenant-scope.service.ts`
- `tenant-scope.middleware.ts`
- `tenant-scope.types.ts`

### Proposed route behavior

- current user must have membership in the organisation that owns the object
- platform-admin path must be explicit and separate

### Tests

- tenant A cannot read tenant B file metadata
- tenant A cannot download tenant B file content
- tenant A cannot list tenant B documents
- mission access denied if mission organisation is outside membership

## Phase 4: Stored File Access Audit Logging

### Goal

Make access to sensitive files attributable and reviewable.

### Outcomes

- upload, metadata read, preview, and download actions are logged
- logs capture user, role, organisation, file, action, and timestamp

### Proposed table

#### `047_create_stored_file_access_events.sql`

Suggested columns:

- `id text primary key`
- `stored_file_id text not null references stored_files(id)`
- `organisation_id text not null`
- `user_id text not null references users(id)`
- `role text not null`
- `action text not null`
- `result text not null`
- `source_ip text null`
- `user_agent text null`
- `created_at timestamptz not null default now()`

### Proposed module

- extend `src/stored-files`

### Tests

- metadata access writes audit event
- download writes audit event
- denied access writes denied audit event

## Phase 5: File Upload Hardening

### Goal

Harden uploaded source records before they are trusted in the platform.

### Outcomes

- allowed content types enforced
- unsafe files quarantined or blocked
- preview/download prevented until file state is acceptable

### Proposed schema updates

#### `048_add_scan_status_to_stored_files.sql`

Suggested columns:

- `scan_status text not null default 'pending'`
- `scan_summary text null`
- `scanned_at timestamptz null`

### Work items

- file type allowlist
- content signature checks where feasible
- scan state in stored-file model
- block preview/download for unsafe files

### Tests

- disallowed content type rejected
- pending or blocked file cannot be previewed
- clean file remains accessible

## Phase 6: Privacy And Retention Baseline

### Goal

Turn privacy and storage-limitation requirements into real product controls.

### Outcomes

- retention metadata exists
- records can be classified for archive, delete, or legal hold
- privacy information and lawful-basis documentation are no longer outside the product plan

### Proposed tables or fields

#### `049_add_retention_fields_to_documents_and_files.sql`

Suggested fields:

- `retention_category text`
- `retention_review_at timestamptz`
- `legal_hold boolean not null default false`
- `archived_at timestamptz null`

### Work items

- retention categories by document and evidence type
- privacy notice draft
- lawful-basis register
- initial controller/processor mapping

### Tests

- records can be classified
- legal-hold records cannot be routine-deleted
- archived records are excluded from standard working lists where appropriate

## Phase 7: Encryption And Secrets

### Goal

Add production-safe protection for stored files and secrets.

### Outcomes

- encryption-at-rest strategy is implemented or formally integrated
- secrets model is defined and usable in production

### Work items

- decide file encryption model
- document dev vs prod storage differences
- adopt secrets-management approach
- define key rotation ownership

## Phase 8: Privacy Rights And Governance Support

### Goal

Support operational privacy governance beyond baseline security.

### Outcomes

- access, rectification, erasure, and restriction workflows can be managed
- UK GDPR governance artefacts are supportable internally

### Work items

- data subject access request workflow
- rectification workflow
- erasure/restriction decision workflow
- records-of-processing register
- DPIA support template/process

## Module Plan

Recommended modules by phase:

### Phase 1

- `src/auth`
- `src/users`

### Phase 2

- `src/organisation-memberships`
- authorization middleware in `src/auth` or `src/security`

### Phase 3

- `src/tenant-scope`

### Phase 4 and 5

- extend `src/stored-files`

### Phase 6 and 8

- `src/privacy-governance`

## Route Conversion Priority

Convert these routes first because they are closest to current sensitive-document handling:

1. `POST /organisations/:organisationId/files`
2. `GET /files/:fileId`
3. `GET /files/:fileId/content`
4. `GET /organisations/:organisationId/document-portal`
5. `POST /organisations/:organisationId/documents`
6. `POST /organisation-documents/:documentId/upload`
7. `POST /organisations/:organisationId/operational-authority-documents`
8. `POST /operational-authority-documents/:documentId/upload`
9. `POST /organisations/:organisationId/insurance-documents`
10. `POST /insurance-documents/:documentId/upload`

## First Test Gate

The first security gate should be passed before later privacy features proceed.

Definition:

- authenticated user context exists
- membership-derived role checks exist
- stored-file routes reject unauthenticated callers
- stored-file routes reject non-member callers
- stored-file routes reject low-privilege callers for content access
- cross-tenant file access tests are green

## Recommended Immediate Tickets

Raise these first:

1. create `users` and `user_sessions`
2. create `organisation_memberships`
3. add auth middleware and `currentUser`
4. replace stored-file actor-role hooks with membership-derived authz
5. add tenant-scope validation to stored-file and document portal routes
6. add cross-tenant and forbidden-role test coverage

## Success Criteria

This plan is successful when VerityATLAS can demonstrate:

- every sensitive route is tied to a real authenticated user
- organisation membership determines access
- file and document access is tenant-safe
- access decisions are testable and auditable
- later privacy and retention controls are built on a real security foundation
