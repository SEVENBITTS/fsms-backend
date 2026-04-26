export type OperationalAuthorityDocumentStatus =
  | "draft"
  | "active"
  | "expired"
  | "superseded"
  | "revoked";

export type OperationalAuthorityProfileReviewStatus = "draft" | "reviewed";

export type OperationalAuthorityProfileActivationStatus =
  | "draft"
  | "active"
  | "superseded";

export type OperationalAuthorityConditionCode =
  | "ALLOWED_OPERATION_TYPE"
  | "BVLOS_AUTHORISED"
  | "BVLOS_REQUIRES_REVIEW"
  | "PILOT_NAMED_AUTHORISATION"
  | "PILOT_PENDING_AMENDMENT";

export type MissionOperationType =
  | "vlos_commercial"
  | "bvlos_commercial"
  | "inspection"
  | "survey"
  | "emergency_support";

export interface CreateOperationalAuthorityConditionInput {
  conditionCode?: OperationalAuthorityConditionCode;
  conditionTitle?: string;
  clauseReference?: string | null;
  conditionPayload?: Record<string, unknown>;
}

export interface CreateOperationalAuthorityDocumentInput {
  authorityName?: string;
  referenceNumber?: string;
  issueDate?: string;
  effectiveFrom?: string;
  expiresAt?: string;
  uploadedBy?: string | null;
  conditions?: CreateOperationalAuthorityConditionInput[];
}

export interface UploadOperationalAuthorityDocumentInput {
  uploadedFileId?: string;
  sourceDocumentType?: string;
  uploadedFileName?: string | null;
  uploadedFileChecksum?: string | null;
  sourceClauseRefs?: string[] | null;
  documentReviewNotes?: string | null;
  uploadedBy?: string | null;
}

export type OperationalAuthoritySopDocumentStatus =
  | "draft"
  | "active"
  | "under_review"
  | "superseded";

export interface CreateOperationalAuthoritySopDocumentInput {
  sopCode?: string;
  title?: string;
  version?: string;
  status?: OperationalAuthoritySopDocumentStatus;
  owner?: string | null;
  sourceDocumentId?: string | null;
  sourceDocumentType?: string | null;
  sourceClauseRefs?: string[] | null;
  linkedOaConditionIds?: string[] | null;
  changeRecommendationScope?: string[] | null;
  reviewNotes?: string | null;
}

export interface ActivateOperationalAuthorityProfileInput {
  activatedBy?: string;
}

export interface CreateOperationalAuthorityPilotAuthorisationInput {
  pilotId?: string;
  authorisationState?: OperationalAuthorityPilotAuthorisationState;
  allowedOperationTypes?: MissionOperationType[] | null;
  bvlosAuthorised?: boolean;
  requiresAccountableReview?: boolean;
  pendingAmendmentReference?: string | null;
  pendingSubmittedAt?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
}

export interface UpdateOperationalAuthorityPilotAuthorisationInput {
  authorisationState?: OperationalAuthorityPilotAuthorisationState;
  allowedOperationTypes?: MissionOperationType[] | null;
  bvlosAuthorised?: boolean;
  requiresAccountableReview?: boolean;
  pendingAmendmentReference?: string | null;
  pendingSubmittedAt?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
}

export type OperationalAuthorityPilotAuthorisationReviewDecision =
  | "accepted_for_tracking"
  | "not_accepted"
  | "deferred"
  | "amendment_approved";

export interface CreateOperationalAuthorityPilotAuthorisationReviewInput {
  decision?: OperationalAuthorityPilotAuthorisationReviewDecision;
  reviewedBy?: string;
  reviewRationale?: string;
  evidenceRef?: string | null;
  reviewedAt?: string | null;
}

export interface OperationalAuthorityDocument {
  id: string;
  organisationId: string;
  authorityName: string;
  referenceNumber: string;
  issueDate: string;
  effectiveFrom: string;
  expiresAt: string;
  status: OperationalAuthorityDocumentStatus;
  uploadedFileId: string | null;
  sourceDocumentType: string | null;
  uploadedFileName: string | null;
  uploadedFileChecksum: string | null;
  sourceClauseRefs: string[];
  documentReviewNotes: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAuthorityProfile {
  id: string;
  organisationId: string;
  operationalAuthorityDocumentId: string;
  versionNumber: number;
  reviewStatus: OperationalAuthorityProfileReviewStatus;
  activationStatus: OperationalAuthorityProfileActivationStatus;
  activatedBy: string | null;
  activatedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAuthorityCondition {
  id: string;
  operationalAuthorityProfileId: string;
  conditionCode: OperationalAuthorityConditionCode;
  conditionTitle: string;
  clauseReference: string | null;
  conditionPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAuthoritySopDocument {
  id: string;
  operationalAuthorityProfileId: string;
  organisationId: string;
  sopCode: string;
  title: string;
  version: string;
  status: OperationalAuthoritySopDocumentStatus;
  owner: string | null;
  sourceDocumentId: string | null;
  sourceDocumentType: string | null;
  sourceClauseRefs: string[];
  linkedOaConditionIds: string[];
  changeRecommendationScope: string[];
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OperationalAuthorityPilotAuthorisationState =
  | "authorised"
  | "pending_amendment"
  | "restricted"
  | "inactive";

export interface OperationalAuthorityPilotAuthorisation {
  id: string;
  operationalAuthorityProfileId: string;
  organisationId: string;
  pilotId: string;
  authorisationState: OperationalAuthorityPilotAuthorisationState;
  allowedOperationTypes: MissionOperationType[];
  bvlosAuthorised: boolean;
  requiresAccountableReview: boolean;
  pendingAmendmentReference: string | null;
  pendingSubmittedAt: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OperationalAuthorityPilotAuthorisationReview {
  id: string;
  operationalAuthorityPilotAuthorisationId: string;
  organisationId: string;
  decision: OperationalAuthorityPilotAuthorisationReviewDecision;
  reviewedBy: string;
  reviewRationale: string;
  evidenceRef: string | null;
  reviewedAt: string;
  createdAt: string;
}

export type OperationalAuthorityAssessmentResult = "pass" | "warning" | "fail";

export type OperationalAuthorityAssessmentReasonCode =
  | "OA_ACTIVE_PROFILE_MISSING"
  | "OA_PROFILE_INACTIVE"
  | "OA_PROFILE_REVIEW_REQUIRED"
  | "OA_DOCUMENT_NOT_YET_EFFECTIVE"
  | "OA_DOCUMENT_EXPIRED"
  | "OA_DOCUMENT_RENEWAL_SOON"
  | "OA_OPERATION_TYPE_NOT_AUTHORISED"
  | "OA_BVLOS_NOT_AUTHORISED"
  | "OA_BVLOS_REQUIRES_REVIEW"
  | "OA_PILOT_AUTHORISATION_MISSING"
  | "OA_PILOT_PENDING_AMENDMENT"
  | "OA_PILOT_RESTRICTED"
  | "OA_PILOT_OPERATION_TYPE_NOT_AUTHORISED"
  | "OA_PILOT_BVLOS_NOT_AUTHORISED"
  | "OA_PILOT_REQUIRES_ACCOUNTABLE_REVIEW"
  | "OA_PILOT_WITHIN_PERSONNEL_SCOPE"
  | "OA_WITHIN_PROFILE"
  | "MISSION_ORGANISATION_MISSING";

export interface OperationalAuthorityAssessmentReason {
  code: OperationalAuthorityAssessmentReasonCode;
  severity: OperationalAuthorityAssessmentResult;
  message: string;
  clauseReference?: string | null;
}

export interface OperationalAuthorityAssessment {
  missionId: string;
  organisationId: string | null;
  result: OperationalAuthorityAssessmentResult;
  reasons: OperationalAuthorityAssessmentReason[];
  profile: OperationalAuthorityProfile | null;
  document: OperationalAuthorityDocument | null;
  pilotAuthorisation: OperationalAuthorityPilotAuthorisation | null;
}
