import { AuditEvidenceValidationError } from "./audit-evidence.errors";
import type {
  CreateAuditEvidenceSnapshotInput,
  CreateMissionDecisionEvidenceLinkInput,
  CreatePostOperationEvidenceSnapshotInput,
  MissionDecisionType,
} from "./audit-evidence.types";

const DECISION_TYPES = new Set<MissionDecisionType>(["approval", "dispatch"]);

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
