import { AuditEvidenceValidationError } from "./audit-evidence.errors";
import type {
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationAuditSignoffInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionType,
  PostOperationAuditSignoffDecision,
} from "./audit-evidence.types";

const DECISION_TYPES = new Set<MissionDecisionType>(["approval", "dispatch"]);
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
