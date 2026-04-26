import {
  OperationalAuthorityValidationError,
} from "./operational-authority.errors";
import type {
  ActivateOperationalAuthorityProfileInput,
  CreateOperationalAuthorityConditionInput,
  CreateOperationalAuthorityDocumentInput,
  CreateOperationalAuthorityPilotAuthorisationInput,
  CreateOperationalAuthorityPilotAuthorisationReviewInput,
  CreateOperationalAuthoritySopChangeRecommendationInput,
  CreateOperationalAuthoritySopDocumentInput,
  MissionOperationType,
  OperationalAuthorityConditionCode,
  OperationalAuthorityPilotAuthorisationReviewDecision,
  OperationalAuthorityPilotAuthorisationState,
  OperationalAuthoritySopChangeRecommendationType,
  OperationalAuthoritySopDocumentStatus,
  UpdateOperationalAuthorityPilotAuthorisationInput,
  UploadOperationalAuthorityDocumentInput,
} from "./operational-authority.types";

const CONDITION_CODES = new Set<OperationalAuthorityConditionCode>([
  "ALLOWED_OPERATION_TYPE",
  "BVLOS_AUTHORISED",
  "BVLOS_REQUIRES_REVIEW",
  "PILOT_NAMED_AUTHORISATION",
  "PILOT_PENDING_AMENDMENT",
]);

const MISSION_OPERATION_TYPES = new Set<MissionOperationType>([
  "vlos_commercial",
  "bvlos_commercial",
  "inspection",
  "survey",
  "emergency_support",
]);

const PILOT_AUTHORISATION_STATES = new Set<OperationalAuthorityPilotAuthorisationState>([
  "authorised",
  "pending_amendment",
  "restricted",
  "inactive",
]);

const PILOT_AUTHORISATION_REVIEW_DECISIONS =
  new Set<OperationalAuthorityPilotAuthorisationReviewDecision>([
    "accepted_for_tracking",
    "not_accepted",
    "deferred",
    "amendment_approved",
  ]);

const SOP_DOCUMENT_STATUSES = new Set<OperationalAuthoritySopDocumentStatus>([
  "draft",
  "active",
  "under_review",
  "superseded",
]);

const SOP_CHANGE_RECOMMENDATION_TYPES =
  new Set<OperationalAuthoritySopChangeRecommendationType>([
    "sop_review_recommended",
    "sop_amendment_recommended",
    "new_sop_required",
    "oa_variation_review_recommended",
  ]);

function requiredTrimmed(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must be a string`,
    );
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must not be empty`,
    );
  }

  return trimmed;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredTrimmed(value, fieldName);
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new OperationalAuthorityValidationError(`${fieldName} must be a boolean`);
  }

  return value;
}

function optionalStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must be an array of strings`,
    );
  }

  return value.map((item, index) =>
    requiredTrimmed(item, `${fieldName}[${index}]`),
  );
}

function requiredIsoDate(value: unknown, fieldName: string): string {
  const parsed = new Date(requiredTrimmed(value, fieldName));

  if (Number.isNaN(parsed.getTime())) {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must be a valid ISO date`,
    );
  }

  return parsed.toISOString();
}

function optionalIsoDate(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = new Date(requiredTrimmed(value, fieldName));

  if (Number.isNaN(parsed.getTime())) {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must be a valid ISO date`,
    );
  }

  return parsed.toISOString();
}

function requiredConditionCode(
  value: unknown,
): OperationalAuthorityConditionCode {
  if (typeof value !== "string" || !CONDITION_CODES.has(value as OperationalAuthorityConditionCode)) {
    throw new OperationalAuthorityValidationError(
      "conditionCode is not supported",
    );
  }

  return value as OperationalAuthorityConditionCode;
}

function requiredConditionPayload(
  value: unknown,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OperationalAuthorityValidationError(
      "conditionPayload must be an object",
    );
  }

  return value as Record<string, unknown>;
}

function validateAllowedOperationTypes(
  payload: Record<string, unknown>,
): void {
  const allowed = payload.allowedOperationTypes;

  if (!Array.isArray(allowed) || allowed.length === 0) {
    throw new OperationalAuthorityValidationError(
      "ALLOWED_OPERATION_TYPE requires a non-empty allowedOperationTypes array",
    );
  }

  for (const item of allowed) {
    if (
      typeof item !== "string" ||
      !MISSION_OPERATION_TYPES.has(item as MissionOperationType)
    ) {
      throw new OperationalAuthorityValidationError(
        "allowedOperationTypes contains an unsupported value",
      );
    }
  }
}

function validateOperationTypesArray(
  value: unknown,
  fieldName: string,
): MissionOperationType[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new OperationalAuthorityValidationError(`${fieldName} must be an array`);
  }

  return value.map((item, index) => {
    if (
      typeof item !== "string" ||
      !MISSION_OPERATION_TYPES.has(item as MissionOperationType)
    ) {
      throw new OperationalAuthorityValidationError(
        `${fieldName}[${index}] contains an unsupported mission operation type`,
      );
    }

    return item as MissionOperationType;
  });
}

function validateBooleanPayloadField(
  payload: Record<string, unknown>,
  fieldName: string,
): void {
  if (typeof payload[fieldName] !== "boolean") {
    throw new OperationalAuthorityValidationError(
      `${fieldName} must be a boolean`,
    );
  }
}

function validateCondition(
  input: CreateOperationalAuthorityConditionInput,
): CreateOperationalAuthorityConditionInput & {
  conditionCode: OperationalAuthorityConditionCode;
  conditionTitle: string;
  clauseReference: string | null;
  conditionPayload: Record<string, unknown>;
} {
  const conditionCode = requiredConditionCode(input.conditionCode);
  const conditionPayload = requiredConditionPayload(input.conditionPayload);

  if (conditionCode === "ALLOWED_OPERATION_TYPE") {
    validateAllowedOperationTypes(conditionPayload);
  }

  if (
    conditionCode === "BVLOS_AUTHORISED" ||
    conditionCode === "BVLOS_REQUIRES_REVIEW"
  ) {
    validateBooleanPayloadField(conditionPayload, "enabled");
  }

  return {
    conditionCode,
    conditionTitle: requiredTrimmed(input.conditionTitle, "conditionTitle"),
    clauseReference: optionalTrimmed(input.clauseReference, "clauseReference"),
    conditionPayload,
  };
}

function validatePilotAuthorisationState(
  value: unknown,
  fieldName: string,
): OperationalAuthorityPilotAuthorisationState {
  if (
    typeof value !== "string" ||
    !PILOT_AUTHORISATION_STATES.has(value as OperationalAuthorityPilotAuthorisationState)
  ) {
    throw new OperationalAuthorityValidationError(`${fieldName} is not supported`);
  }

  return value as OperationalAuthorityPilotAuthorisationState;
}

function validatePilotAuthorisationReviewDecision(
  value: unknown,
  fieldName: string,
): OperationalAuthorityPilotAuthorisationReviewDecision {
  if (
    typeof value !== "string" ||
    !PILOT_AUTHORISATION_REVIEW_DECISIONS.has(
      value as OperationalAuthorityPilotAuthorisationReviewDecision,
    )
  ) {
    throw new OperationalAuthorityValidationError(`${fieldName} is not supported`);
  }

  return value as OperationalAuthorityPilotAuthorisationReviewDecision;
}

function validateSopDocumentStatus(
  value: unknown,
): OperationalAuthoritySopDocumentStatus {
  if (value === undefined || value === null || value === "") {
    return "draft";
  }

  if (
    typeof value !== "string" ||
    !SOP_DOCUMENT_STATUSES.has(value as OperationalAuthoritySopDocumentStatus)
  ) {
    throw new OperationalAuthorityValidationError("status is not supported");
  }

  return value as OperationalAuthoritySopDocumentStatus;
}

function validateSopChangeRecommendationType(
  value: unknown,
): OperationalAuthoritySopChangeRecommendationType {
  if (
    typeof value !== "string" ||
    !SOP_CHANGE_RECOMMENDATION_TYPES.has(
      value as OperationalAuthoritySopChangeRecommendationType,
    )
  ) {
    throw new OperationalAuthorityValidationError(
      "recommendationType is not supported",
    );
  }

  return value as OperationalAuthoritySopChangeRecommendationType;
}

export function validateCreateOperationalAuthorityDocumentInput(
  input: CreateOperationalAuthorityDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  const issueDate = requiredIsoDate(input.issueDate, "issueDate");
  const effectiveFrom = requiredIsoDate(input.effectiveFrom, "effectiveFrom");
  const expiresAt = requiredIsoDate(input.expiresAt, "expiresAt");

  if (new Date(expiresAt) <= new Date(effectiveFrom)) {
    throw new OperationalAuthorityValidationError(
      "expiresAt must be after effectiveFrom",
    );
  }

  const conditions = Array.isArray(input.conditions)
    ? input.conditions.map((condition) => validateCondition(condition))
    : [];

  return {
    authorityName: requiredTrimmed(input.authorityName, "authorityName"),
    referenceNumber: requiredTrimmed(input.referenceNumber, "referenceNumber"),
    issueDate,
    effectiveFrom,
    expiresAt,
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
    conditions,
  };
}

export function validateActivateOperationalAuthorityProfileInput(
  input: ActivateOperationalAuthorityProfileInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    activatedBy: requiredTrimmed(input.activatedBy, "activatedBy"),
  };
}

export function validateUploadOperationalAuthorityDocumentInput(
  input: UploadOperationalAuthorityDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  const sourceClauseRefs =
    input.sourceClauseRefs === undefined || input.sourceClauseRefs === null
      ? []
      : Array.isArray(input.sourceClauseRefs)
        ? input.sourceClauseRefs.map((item, index) =>
            requiredTrimmed(item, `sourceClauseRefs[${index}]`),
          )
        : (() => {
            throw new OperationalAuthorityValidationError(
              "sourceClauseRefs must be an array of strings",
            );
          })();

  return {
    uploadedFileId: requiredTrimmed(input.uploadedFileId, "uploadedFileId"),
    sourceDocumentType: requiredTrimmed(
      input.sourceDocumentType,
      "sourceDocumentType",
    ),
    uploadedFileName: optionalTrimmed(input.uploadedFileName, "uploadedFileName"),
    uploadedFileChecksum: optionalTrimmed(
      input.uploadedFileChecksum,
      "uploadedFileChecksum",
    ),
    sourceClauseRefs,
    documentReviewNotes: optionalTrimmed(
      input.documentReviewNotes,
      "documentReviewNotes",
    ),
    uploadedBy: optionalTrimmed(input.uploadedBy, "uploadedBy"),
  };
}

export function validateCreateOperationalAuthoritySopDocumentInput(
  input: CreateOperationalAuthoritySopDocumentInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    sopCode: requiredTrimmed(input.sopCode, "sopCode"),
    title: requiredTrimmed(input.title, "title"),
    version: requiredTrimmed(input.version, "version"),
    status: validateSopDocumentStatus(input.status),
    owner: optionalTrimmed(input.owner, "owner"),
    sourceDocumentId: optionalTrimmed(
      input.sourceDocumentId,
      "sourceDocumentId",
    ),
    sourceDocumentType: optionalTrimmed(
      input.sourceDocumentType,
      "sourceDocumentType",
    ),
    sourceClauseRefs: optionalStringArray(
      input.sourceClauseRefs,
      "sourceClauseRefs",
    ),
    linkedOaConditionIds: optionalStringArray(
      input.linkedOaConditionIds,
      "linkedOaConditionIds",
    ),
    changeRecommendationScope: optionalStringArray(
      input.changeRecommendationScope,
      "changeRecommendationScope",
    ),
    reviewNotes: optionalTrimmed(input.reviewNotes, "reviewNotes"),
  };
}

export function validateCreateOperationalAuthoritySopChangeRecommendationInput(
  input: CreateOperationalAuthoritySopChangeRecommendationInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    profileId: requiredTrimmed(input.profileId, "profileId"),
    sopDocumentId: requiredTrimmed(input.sopDocumentId, "sopDocumentId"),
    parentOaConditionId: optionalTrimmed(
      input.parentOaConditionId,
      "parentOaConditionId",
    ),
    sopClauseRef: optionalTrimmed(input.sopClauseRef, "sopClauseRef"),
    recommendationType: validateSopChangeRecommendationType(
      input.recommendationType,
    ),
    evidenceSourceType: requiredTrimmed(
      input.evidenceSourceType,
      "evidenceSourceType",
    ),
    evidenceSourceId: requiredTrimmed(
      input.evidenceSourceId,
      "evidenceSourceId",
    ),
    findingSummary: requiredTrimmed(input.findingSummary, "findingSummary"),
    recommendation: requiredTrimmed(input.recommendation, "recommendation"),
    createdBy: requiredTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateCreateOperationalAuthorityPilotAuthorisationInput(
  input: CreateOperationalAuthorityPilotAuthorisationInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    pilotId: requiredTrimmed(input.pilotId, "pilotId"),
    authorisationState: validatePilotAuthorisationState(
      input.authorisationState,
      "authorisationState",
    ),
    allowedOperationTypes: validateOperationTypesArray(
      input.allowedOperationTypes,
      "allowedOperationTypes",
    ),
    bvlosAuthorised: optionalBoolean(input.bvlosAuthorised, "bvlosAuthorised") ?? false,
    requiresAccountableReview:
      optionalBoolean(
        input.requiresAccountableReview,
        "requiresAccountableReview",
      ) ?? false,
    pendingAmendmentReference: optionalTrimmed(
      input.pendingAmendmentReference,
      "pendingAmendmentReference",
    ),
    pendingSubmittedAt: optionalIsoDate(
      input.pendingSubmittedAt,
      "pendingSubmittedAt",
    ),
    approvedAt: optionalIsoDate(input.approvedAt, "approvedAt"),
    notes: optionalTrimmed(input.notes, "notes"),
  };
}

export function validateUpdateOperationalAuthorityPilotAuthorisationInput(
  input: UpdateOperationalAuthorityPilotAuthorisationInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    authorisationState: validatePilotAuthorisationState(
      input.authorisationState,
      "authorisationState",
    ),
    allowedOperationTypes: validateOperationTypesArray(
      input.allowedOperationTypes,
      "allowedOperationTypes",
    ),
    bvlosAuthorised: optionalBoolean(input.bvlosAuthorised, "bvlosAuthorised") ?? false,
    requiresAccountableReview:
      optionalBoolean(
        input.requiresAccountableReview,
        "requiresAccountableReview",
      ) ?? false,
    pendingAmendmentReference: optionalTrimmed(
      input.pendingAmendmentReference,
      "pendingAmendmentReference",
    ),
    pendingSubmittedAt: optionalIsoDate(
      input.pendingSubmittedAt,
      "pendingSubmittedAt",
    ),
    approvedAt: optionalIsoDate(input.approvedAt, "approvedAt"),
    notes: optionalTrimmed(input.notes, "notes"),
  };
}

export function validateCreateOperationalAuthorityPilotAuthorisationReviewInput(
  input: CreateOperationalAuthorityPilotAuthorisationReviewInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new OperationalAuthorityValidationError("Request body must be an object");
  }

  return {
    decision: validatePilotAuthorisationReviewDecision(
      input.decision,
      "decision",
    ),
    reviewedBy: requiredTrimmed(input.reviewedBy, "reviewedBy"),
    reviewRationale: requiredTrimmed(
      input.reviewRationale,
      "reviewRationale",
    ),
    evidenceRef: optionalTrimmed(input.evidenceRef, "evidenceRef"),
    reviewedAt: optionalIsoDate(input.reviewedAt, "reviewedAt"),
  };
}
