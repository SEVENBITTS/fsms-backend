export type InsuranceDocumentStatus =
  | "draft"
  | "active"
  | "expired"
  | "superseded"
  | "cancelled";

export type InsuranceProfileReviewStatus = "draft" | "reviewed";

export type InsuranceProfileActivationStatus =
  | "draft"
  | "active"
  | "superseded";

export type InsuranceConditionCode =
  | "ALLOWED_OPERATION_TYPE"
  | "BVLOS_COVERED"
  | "BVLOS_REQUIRES_REVIEW";

export interface CreateInsuranceConditionInput {
  conditionCode?: InsuranceConditionCode;
  conditionTitle?: string;
  clauseReference?: string | null;
  conditionPayload?: Record<string, unknown>;
}

export interface CreateInsuranceDocumentInput {
  providerName?: string;
  policyNumber?: string;
  issueDate?: string;
  effectiveFrom?: string;
  expiresAt?: string;
  uploadedBy?: string | null;
  conditions?: CreateInsuranceConditionInput[];
}

export interface UploadInsurancePolicyInput {
  uploadedFileId?: string;
  sourceDocumentType?: string;
  uploadedFileName?: string | null;
  uploadedFileChecksum?: string | null;
  policyScheduleRefs?: string[] | null;
  documentReviewNotes?: string | null;
  uploadedBy?: string | null;
}

export interface ActivateInsuranceProfileInput {
  activatedBy?: string;
}

export interface InsuranceDocument {
  id: string;
  organisationId: string;
  providerName: string;
  policyNumber: string;
  issueDate: string;
  effectiveFrom: string;
  expiresAt: string;
  status: InsuranceDocumentStatus;
  uploadedFileId: string | null;
  sourceDocumentType: string | null;
  uploadedFileName: string | null;
  uploadedFileChecksum: string | null;
  policyScheduleRefs: string[];
  documentReviewNotes: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceProfile {
  id: string;
  organisationId: string;
  insuranceDocumentId: string;
  versionNumber: number;
  reviewStatus: InsuranceProfileReviewStatus;
  activationStatus: InsuranceProfileActivationStatus;
  activatedBy: string | null;
  activatedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceCondition {
  id: string;
  insuranceProfileId: string;
  conditionCode: InsuranceConditionCode;
  conditionTitle: string;
  clauseReference: string | null;
  conditionPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type InsuranceAssessmentResult = "pass" | "warning" | "fail";

export type InsuranceAssessmentReasonCode =
  | "INSURANCE_ACTIVE_PROFILE_MISSING"
  | "INSURANCE_PROFILE_INACTIVE"
  | "INSURANCE_PROFILE_REVIEW_REQUIRED"
  | "INSURANCE_DOCUMENT_NOT_YET_EFFECTIVE"
  | "INSURANCE_DOCUMENT_EXPIRED"
  | "INSURANCE_DOCUMENT_RENEWAL_SOON"
  | "INSURANCE_OPERATION_TYPE_NOT_COVERED"
  | "INSURANCE_BVLOS_NOT_COVERED"
  | "INSURANCE_BVLOS_REVIEW_REQUIRED"
  | "INSURANCE_WITHIN_PROFILE"
  | "MISSION_ORGANISATION_MISSING";

export interface InsuranceAssessmentReason {
  code: InsuranceAssessmentReasonCode;
  severity: InsuranceAssessmentResult;
  message: string;
  clauseReference?: string | null;
}

export interface InsuranceAssessment {
  missionId: string;
  organisationId: string | null;
  result: InsuranceAssessmentResult;
  reasons: InsuranceAssessmentReason[];
  profile: InsuranceProfile | null;
  document: InsuranceDocument | null;
}
