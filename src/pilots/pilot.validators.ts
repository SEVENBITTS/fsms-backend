import { PilotValidationError } from "./pilot.errors";
import type {
  CreatePilotEvidenceInput,
  CreatePilotInput,
  PilotEvidenceStatus,
  PilotStatus,
} from "./pilot.types";

const PILOT_STATUSES = new Set<PilotStatus>([
  "active",
  "inactive",
  "suspended",
  "retired",
]);

const EVIDENCE_STATUSES = new Set<PilotEvidenceStatus>([
  "active",
  "inactive",
  "revoked",
]);

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new PilotValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredTrimmed(value: unknown, fieldName: string): string {
  const normalized = optionalTrimmed(value, fieldName);

  if (!normalized) {
    throw new PilotValidationError(`${fieldName} is required`);
  }

  return normalized;
}

function optionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new PilotValidationError(`${fieldName} must be a valid ISO timestamp`);
  }

  return new Date(value);
}

export function validateCreatePilotInput(input: CreatePilotInput) {
  if (!input || typeof input !== "object") {
    throw new PilotValidationError("Request body must be an object");
  }

  const status = input.status ?? "active";

  if (!PILOT_STATUSES.has(status)) {
    throw new PilotValidationError("status is not supported");
  }

  return {
    displayName: requiredTrimmed(input.displayName, "displayName"),
    caaReference: optionalTrimmed(input.caaReference, "caaReference"),
    status,
    notes: optionalTrimmed(input.notes, "notes"),
  };
}

export function validateCreatePilotEvidenceInput(input: CreatePilotEvidenceInput) {
  if (!input || typeof input !== "object") {
    throw new PilotValidationError("Request body must be an object");
  }

  const status = input.status ?? "active";

  if (!EVIDENCE_STATUSES.has(status)) {
    throw new PilotValidationError("status is not supported");
  }

  return {
    evidenceType: requiredTrimmed(input.evidenceType, "evidenceType"),
    title: requiredTrimmed(input.title, "title"),
    issuedAt: optionalDate(input.issuedAt, "issuedAt"),
    expiresAt: optionalDate(input.expiresAt, "expiresAt"),
    status,
    evidenceRef: optionalTrimmed(input.evidenceRef, "evidenceRef"),
    notes: optionalTrimmed(input.notes, "notes"),
  };
}
