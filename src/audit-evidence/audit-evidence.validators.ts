import { AuditEvidenceValidationError } from "./audit-evidence.errors";
import type { CreateAuditEvidenceSnapshotInput } from "./audit-evidence.types";

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
