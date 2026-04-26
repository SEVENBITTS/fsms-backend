export type PilotStatus = "active" | "inactive" | "suspended" | "retired";

export type PilotEvidenceStatus = "active" | "inactive" | "revoked";

export interface CreatePilotInput {
  displayName?: string;
  caaReference?: string | null;
  status?: PilotStatus;
  notes?: string | null;
}

export interface Pilot {
  id: string;
  displayName: string;
  caaReference: string | null;
  status: PilotStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePilotEvidenceInput {
  evidenceType?: string;
  title?: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  status?: PilotEvidenceStatus;
  evidenceRef?: string | null;
  notes?: string | null;
}

export interface PilotEvidence {
  id: string;
  pilotId: string;
  evidenceType: string;
  title: string;
  issuedAt: string | null;
  expiresAt: string | null;
  status: PilotEvidenceStatus;
  evidenceRef: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PilotReadinessStatus {
  pilot: Pilot;
  currentEvidence: PilotEvidence[];
  expiredEvidence: PilotEvidence[];
  inactiveEvidence: PilotEvidence[];
  operationalAuthority: PilotOperationalAuthorityStatus;
}

export type PilotReadinessResult = "pass" | "warning" | "fail";

export type PilotOperationalAuthorityAuthorisationState =
  | "authorised"
  | "pending_amendment"
  | "restricted"
  | "inactive";

export interface PilotOperationalAuthorityAuthorisation {
  id: string;
  operationalAuthorityProfileId: string;
  organisationId: string;
  pilotId: string;
  authorisationState: PilotOperationalAuthorityAuthorisationState;
  allowedOperationTypes: string[];
  bvlosAuthorised: boolean;
  requiresAccountableReview: boolean;
  pendingAmendmentReference: string | null;
  pendingSubmittedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  latestReview: PilotOperationalAuthorityAuthorisationReview | null;
  reviewStatus: "not_required" | "required" | "completed";
}

export interface PilotOperationalAuthorityAuthorisationReview {
  id: string;
  operationalAuthorityPilotAuthorisationId: string;
  organisationId: string;
  decision:
    | "accepted_for_tracking"
    | "not_accepted"
    | "deferred"
    | "amendment_approved";
  reviewedBy: string;
  reviewRationale: string;
  evidenceRef: string | null;
  reviewedAt: string;
  createdAt: string;
}

export interface PilotOperationalAuthorityStatus {
  result: PilotReadinessResult | "not_recorded";
  summary: string;
  authorisations: PilotOperationalAuthorityAuthorisation[];
}

export type PilotReadinessReasonCode =
  | "PILOT_ACTIVE"
  | "PILOT_INACTIVE"
  | "PILOT_SUSPENDED"
  | "PILOT_RETIRED"
  | "PILOT_EVIDENCE_MISSING"
  | "PILOT_EVIDENCE_EXPIRED"
  | "PILOT_EVIDENCE_REVOKED"
  | "PILOT_OA_AUTHORISED"
  | "PILOT_OA_PENDING_AMENDMENT"
  | "PILOT_OA_RESTRICTED"
  | "PILOT_OA_INACTIVE"
  | "PILOT_OA_ACCOUNTABLE_REVIEW_REQUIRED";

export interface PilotReadinessReason {
  code: PilotReadinessReasonCode;
  severity: PilotReadinessResult;
  message: string;
  relatedEvidenceIds?: string[];
}

export interface PilotReadinessCheck {
  pilotId: string;
  result: PilotReadinessResult;
  reasons: PilotReadinessReason[];
  readinessStatus: PilotReadinessStatus;
}
