import { AuditEvidenceValidationError } from "./audit-evidence.errors";
import type {
  CreateConflictGuidanceAcknowledgementInput,
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationAuditSignoffInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionType,
  PostOperationAuditSignoffDecision,
} from "./audit-evidence.types";
import type {
  TrafficConflictGuidanceActionCode,
  TrafficConflictGuidanceAuthority,
  TrafficConflictGuidanceEvidenceAction,
} from "../conflict-assessment/traffic-conflict-assessment.types";

const DECISION_TYPES = new Set<MissionDecisionType>(["approval", "dispatch"]);
const CONFLICT_GUIDANCE_ACTION_CODES =
  new Set<TrafficConflictGuidanceActionCode>([
    "review_separation",
    "prepare_deconfliction",
    "hold_or_suspend",
  ]);
const CONFLICT_GUIDANCE_EVIDENCE_ACTIONS =
  new Set<TrafficConflictGuidanceEvidenceAction>([
    "record_operator_review",
    "record_supervisor_review",
  ]);
const CONFLICT_GUIDANCE_ACKNOWLEDGEMENT_ROLES =
  new Set<TrafficConflictGuidanceAuthority>(["operator", "supervisor"]);
const SIGNOFF_DECISIONS = new Set<PostOperationAuditSignoffDecision>([
  "approved",
  "rejected",
  "requires_follow_up",
]);

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AuditEvidenceValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateCreateAuditEvidenceSnapshotInput(
  input: CreateAuditEvidenceSnapshotInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
      createdBy: null,
    };
  }

  if (typeof input !== "object") {
    throw new AuditEvidenceValidationError("Request body must be an object");
  }

  return {
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateCreatePostOperationEvidenceSnapshotInput(
  input: CreatePostOperationEvidenceSnapshotInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
      createdBy: null,
    };
  }

  if (typeof input !== "object") {
    throw new AuditEvidenceValidationError("Request body must be an object");
  }

  return {
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuditEvidenceValidationError(`${fieldName} is required`);
  }

  return value.trim();
}

function requiredDecisionType(value: unknown): MissionDecisionType {
  if (typeof value !== "string" || !DECISION_TYPES.has(value as MissionDecisionType)) {
    throw new AuditEvidenceValidationError("decisionType is not supported");
  }

  return value as MissionDecisionType;
}

function requiredConflictGuidanceActionCode(
  value: unknown,
): TrafficConflictGuidanceActionCode {
  if (
    typeof value !== "string" ||
    !CONFLICT_GUIDANCE_ACTION_CODES.has(value as TrafficConflictGuidanceActionCode)
  ) {
    throw new AuditEvidenceValidationError("guidanceActionCode is not supported");
  }

  return value as TrafficConflictGuidanceActionCode;
}

function requiredConflictGuidanceEvidenceAction(
  value: unknown,
): Exclude<TrafficConflictGuidanceEvidenceAction, "none"> {
  if (
    typeof value !== "string" ||
    !CONFLICT_GUIDANCE_EVIDENCE_ACTIONS.has(value as TrafficConflictGuidanceEvidenceAction)
  ) {
    throw new AuditEvidenceValidationError(
      "evidenceAction must require operator or supervisor review",
    );
  }

  return value as Exclude<TrafficConflictGuidanceEvidenceAction, "none">;
}

function requiredAcknowledgementRole(
  value: unknown,
): TrafficConflictGuidanceAuthority {
  if (
    typeof value !== "string" ||
    !CONFLICT_GUIDANCE_ACKNOWLEDGEMENT_ROLES.has(value as TrafficConflictGuidanceAuthority)
  ) {
    throw new AuditEvidenceValidationError(
      "acknowledgementRole is not supported",
    );
  }

  return value as TrafficConflictGuidanceAuthority;
}

function requiredSignoffDecision(value: unknown): PostOperationAuditSignoffDecision {
  if (
    typeof value !== "string" ||
    !SIGNOFF_DECISIONS.has(value as PostOperationAuditSignoffDecision)
  ) {
    throw new AuditEvidenceValidationError("reviewDecision is not supported");
  }

  return value as PostOperationAuditSignoffDecision;
}

function requiredIsoDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AuditEvidenceValidationError(`${fieldName} is required`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AuditEvidenceValidationError(`${fieldName} must be a valid date`);
  }

  return parsed.toISOString();
}

export function validateCreateMissionDecisionEvidenceLinkInput(
  input: CreateMissionDecisionEvidenceLinkInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AuditEvidenceValidationError("Request body must be an object");
  }

  return {
    snapshotId: requiredString(input.snapshotId, "snapshotId"),
    decisionType: requiredDecisionType(input.decisionType),
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateCreateConflictGuidanceAcknowledgementInput(
  input: CreateConflictGuidanceAcknowledgementInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AuditEvidenceValidationError("Request body must be an object");
  }

  return {
    conflictId: requiredString(input.conflictId, "conflictId"),
    overlayId: requiredString(input.overlayId, "overlayId"),
    guidanceActionCode: requiredConflictGuidanceActionCode(
      input.guidanceActionCode,
    ),
    evidenceAction: requiredConflictGuidanceEvidenceAction(input.evidenceAction),
    acknowledgementRole: requiredAcknowledgementRole(input.acknowledgementRole),
    acknowledgedBy: requiredString(input.acknowledgedBy, "acknowledgedBy"),
    acknowledgementNote: optionalTrimmed(
      input.acknowledgementNote,
      "acknowledgementNote",
    ),
    guidanceSummary: optionalTrimmed(input.guidanceSummary, "guidanceSummary"),
  };
}

export function validateCreatePostOperationAuditSignoffInput(
  input: CreatePostOperationAuditSignoffInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AuditEvidenceValidationError("Request body must be an object");
  }

  return {
    accountableManagerName: requiredString(
      input.accountableManagerName,
      "accountableManagerName",
    ),
    accountableManagerRole: requiredString(
      input.accountableManagerRole,
      "accountableManagerRole",
    ),
    reviewDecision: requiredSignoffDecision(input.reviewDecision),
    signedAt: requiredIsoDate(input.signedAt, "signedAt"),
    signatureReference: optionalTrimmed(
      input.signatureReference,
      "signatureReference",
    ),
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}
