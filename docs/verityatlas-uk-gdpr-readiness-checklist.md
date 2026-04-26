# VerityATLAS UK GDPR Readiness Checklist

## Purpose

This document gives a practical UK GDPR readiness view against the current VerityATLAS build.

It is intended to provide an honest overview of current position, not a legal sign-off.

Status values:

- `implemented`
- `partial`
- `missing`

Assessment date:

- `2026-04-25`

Assessment basis:

- current backend and UI build in this repository
- current security and data-protection notes in `docs/`
- current ICO UK GDPR guidance as reviewed on `2026-04-25`

Important note:

This checklist is an architectural and implementation-readiness assessment.

It does not replace:

- legal advice
- a formal privacy review
- a DPIA where required
- controller/processor contract review

## Overall Position

Current overall status:

- `partial`

Reason:

The build is increasingly aligned with UK GDPR principles, especially around accountability, file controls, organisation scoping, and privacy-by-design direction. However, several core production controls are still not fully implemented, especially:

- real authentication
- persistent RBAC
- full tenant-isolation enforcement
- retention and deletion controls
- privacy notices and lawful basis documentation
- subject-rights handling

## 1. Lawfulness, Fairness And Transparency

### 1.1 Lawful Basis Identified For Each Processing Purpose

Status:

- `missing`

Current position:

- the system processes personal and operational data
- there is no implemented lawful-basis register in the build
- there is no documented mapping from data type to lawful basis in the product itself

What is needed:

- lawful basis register by data category and feature area
- controller/processor position clarified for platform operations
- special-category review if any such data is processed in future

### 1.2 Privacy Information / Right To Be Informed

Status:

- `missing`

Current position:

- there is no visible privacy notice flow in the current product surfaces
- there is no onboarding or collection-time privacy information mechanism in the current UI

What is needed:

- privacy notice
- collection-time transparency wording
- retention and sharing information
- role-specific notices where relevant

### 1.3 Fair Processing And Transparent System Behaviour

Status:

- `partial`

Current position:

- the recent compliance-signalling language is a positive step
- the system increasingly explains why warnings or blockers exist
- however transparency for personal-data handling is not yet implemented

Build evidence:

- `docs/assurance-governance-architecture.md`
- OA and insurance advisory wording across governance docs

## 2. Purpose Limitation

### 2.1 Personal Data Used For Clear, Specific Purposes

Status:

- `partial`

Current position:

- the product domains are becoming clearly purpose-shaped
- OA, insurance, documents, stored files, audit evidence, and mission governance all have specific functional roles
- there is not yet a formal processing-purpose inventory

Build evidence:

- `src/operational-authority`
- `src/insurance`
- `src/organisation-documents`
- `src/stored-files`
- `src/audit-evidence`

What is needed:

- written purpose inventory
- data-use matrix by module
- checks on reuse of personal data across unrelated features

## 3. Data Minimisation

### 3.1 Only Necessary Personal Data Collected And Stored

Status:

- `partial`

Current position:

- the architecture notes explicitly lean toward least privilege and purpose-based design
- the implementation still allows broad free-text entry in several places
- there is not yet a minimisation review of all stored fields

Build evidence:

- `docs/verityatlas-security-data-protection-architecture.md`
- organisation-scoped domain models

What is needed:

- field-by-field minimisation review
- remove unnecessary free-text collection
- document why each personal field is required

## 4. Accuracy

### 4.1 Data Can Be Updated And Corrected

Status:

- `partial`

Current position:

- some records are versioned or superseded rather than overwritten
- this is positive for auditability
- there is not yet a clear rectification workflow for personal data

Build evidence:

- OA and insurance profile activation and supersession
- evidence and governance records favour append/audit patterns

What is needed:

- rectification workflow
- correction trail for personal identity and competency fields
- operator/admin correction surfaces

## 5. Storage Limitation

### 5.1 Retention, Archival, And Deletion Rules Exist

Status:

- `missing`

Current position:

- the docs call for retention and archival logic
- the current implementation does not yet enforce retention periods or deletion rules
- stored files and evidence records do not yet have live retention governance

What is needed:

- retention categories
- archive vs delete rules
- legal/regulatory hold logic
- scheduled review of aged records

## 6. Integrity And Confidentiality (Security)

### 6.1 Appropriate Technical And Organisational Security Measures

Status:

- `partial`

Current position:

- there is useful progress on file checksums, stored-file metadata, and lightweight role hooks
- there is not yet a complete production-grade security posture

Build evidence:

- `src/stored-files`
- `src/stored-files/stored-files.access.ts`
- `docs/verityatlas-security-data-protection-architecture.md`

### 6.2 Authentication

Status:

- `missing`

Current position:

- there is no real authentication layer in the current build

What is needed:

- user identity
- login/session or token handling
- authenticated current-user resolution

### 6.3 Role-Based Access Control

Status:

- `partial`

Current position:

- lightweight role hooks exist around stored-file routes
- role context is still caller-supplied rather than membership-derived

Build evidence:

- `src/stored-files/stored-files.access.ts`
- `src/stored-files/stored-files.controller.ts`
- `static/operator-document-portal.html`
- `static/operator-document-portal.js`

### 6.4 Tenant Isolation

Status:

- `partial`

Current position:

- newer modules are organisation-scoped
- this is the correct direction
- there has not yet been a full tenant-isolation audit across the whole platform

Build evidence:

- organisation IDs in OA, insurance, organisation-documents, stored-files, and missions
- `docs/verityatlas-deployment-model.md`

### 6.5 File Upload Security

Status:

- `partial`

Current position:

- filenames are sanitised
- checksums are created
- size limit exists on the raw upload route
- role checks exist
- malware scanning and stricter file-type validation are not yet implemented

Build evidence:

- `src/stored-files/stored-files.validators.ts`
- `src/stored-files/stored-files.routes.ts`
- `src/stored-files/stored-files.service.ts`

### 6.6 Encryption At Rest

Status:

- `missing`

Current position:

- stored files are written to local storage
- there is no implemented encryption-at-rest strategy in the current build

### 6.7 Secrets Management

Status:

- `missing`

Current position:

- standard environment-based configuration exists
- there is no implemented managed secrets or key-management model in the app

### 6.8 Access Audit Logging

Status:

- `partial`

Current position:

- there is strong audit thinking in the wider FSMS build
- however dedicated access-event logging for file preview/download/export is not yet implemented

Build evidence:

- `src/audit-evidence`
- governance and sign-off patterns across the build

## 7. Accountability

### 7.1 Ability To Demonstrate Compliance

Status:

- `partial`

Current position:

- architecture and governance documentation is strong
- audit evidence and sign-off patterns are good
- UK GDPR-specific governance artefacts are still incomplete

Build evidence:

- `docs/assurance-governance-architecture.md`
- `docs/verityatlas-security-data-protection-architecture.md`
- `docs/verityatlas-security-data-protection-backlog.md`

What is needed:

- records of processing activities
- privacy governance register
- security control register
- retention register

### 7.2 Data Protection By Design And By Default

Status:

- `partial`

Current position:

- the product direction is increasingly privacy-aware
- organisation scoping, role-shaped file access, and secure-document thinking support this
- the platform does not yet fully enforce privacy by default through real identity and least-privilege membership controls

Build evidence:

- `docs/verityatlas-security-data-protection-architecture.md`
- `docs/assurance-governance-architecture.md`

### 7.3 DPIA Capability

Status:

- `missing`

Current position:

- there is no implemented DPIA workflow or documented trigger process in the current build

What is needed:

- DPIA template/process
- trigger criteria for new sensitive processing
- review and approval trail

## 8. Individual Rights

### 8.1 Right Of Access

Status:

- `missing`

Current position:

- no implemented data subject access workflow

### 8.2 Right To Rectification

Status:

- `partial`

Current position:

- some versioning patterns support correction history
- there is no explicit right-to-rectification workflow

### 8.3 Right To Erasure

Status:

- `missing`

Current position:

- no implemented erasure handling

### 8.4 Right To Restriction / Objection / Portability

Status:

- `missing`

Current position:

- no implemented support workflows

### 8.5 Rights Related To Automated Decision-Making And Profiling

Status:

- `partial`

Current position:

- the system makes assessments and surfaces governance/risk outcomes
- it generally uses advisory rather than automatic irreversible decisions
- there is no formal automated-decision review position documented yet

What is needed:

- document where assessments are advisory
- document where human review remains required
- assess whether any feature crosses into relevant automated-decision territory

## 9. Records Management

### 9.1 Records Of Processing Activities

Status:

- `missing`

Current position:

- no implemented ROPA-style internal register in the build

### 9.2 Data Inventory

Status:

- `partial`

Current position:

- the codebase structure and docs make the data domains increasingly clear
- there is no formal maintained data inventory document yet

## 10. Processor / Controller Governance

### 10.1 Roles, Responsibilities, And Contracts

Status:

- `missing`

Current position:

- not implemented in the product documentation as a formal governance set

What is needed:

- controller/processor analysis
- customer contract terms
- third-party supplier review where storage, email, auth, or scanning services are used

## 11. International Transfers

### 11.1 Transfers Under Control

Status:

- `missing`

Current position:

- no implemented transfer assessment or documented hosting-region position in the build

Note:

- this becomes especially important once managed storage, auth, scanning, monitoring, or analytics services are introduced

## 12. Breach Management

### 12.1 Detection, Response, And Reporting Readiness

Status:

- `missing`

Current position:

- there is no implemented privacy/security incident response workflow in the build

What is needed:

- incident classification
- breach response process
- reporting decision workflow
- evidence capture and notification support

## 13. Current Build Strengths

Areas where the build is clearly moving the right way:

- organisation-scoped governance objects
- advisory and accountable governance model
- strong audit and evidence orientation
- file checksum and metadata capture
- first-step role hooks around file access
- security and data-protection architecture now documented

## 14. Highest-Priority Gaps

The biggest UK GDPR readiness gaps right now are:

1. real authentication
2. persistent RBAC tied to users and organisations
3. full tenant-isolation enforcement
4. privacy notice and lawful basis documentation
5. retention and deletion controls
6. file access audit logs
7. encryption-at-rest and secrets-management model
8. data subject rights handling

## 15. Recommended Overall Reading

Current position:

- `partial`

Interpretation:

VerityATLAS is being designed in a way that is increasingly compatible with UK GDPR principles, especially accountability, security direction, and privacy-by-design thinking.

However, the current build should not yet be treated as fully UK GDPR-ready for live multi-company production use until the highest-priority missing controls are implemented.

## Related Documents

- `docs/verityatlas-security-data-protection-architecture.md`
- `docs/verityatlas-security-data-protection-backlog.md`
- `docs/assurance-governance-architecture.md`
- `docs/verityatlas-deployment-model.md`
