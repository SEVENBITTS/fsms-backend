import { AirSafetyMeetingValidationError } from "./air-safety-meeting.errors";
import type {
  AirSafetyMeetingStatus,
  AirSafetyMeetingSignoffDecision,
  AirSafetyMeetingType,
  CreateAirSafetyMeetingInput,
  CreateGovernanceApprovalRollupSignoffInput,
  CreateAirSafetyMeetingSignoffInput,
} from "./air-safety-meeting.types";

const MEETING_TYPES = new Set<AirSafetyMeetingType>([
  "quarterly_air_safety_review",
  "event_triggered_safety_review",
  "sop_breach_review",
  "training_review",
  "maintenance_safety_review",
  "accountable_manager_review",
]);

const MEETING_STATUSES = new Set<AirSafetyMeetingStatus>([
  "scheduled",
  "completed",
  "cancelled",
]);

const SIGNOFF_DECISIONS = new Set<AirSafetyMeetingSignoffDecision>([
  "approved",
  "rejected",
  "requires_follow_up",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AirSafetyMeetingValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AirSafetyMeetingValidationError(`${fieldName} is required`);
  }

  return value.trim();
}

function requiredDate(value: unknown, fieldName: string): Date {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new AirSafetyMeetingValidationError(
      `${fieldName} must be a valid ISO timestamp`,
    );
  }

  return new Date(value);
}

function optionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return requiredDate(value, fieldName);
}

function requiredIsoDate(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AirSafetyMeetingValidationError(`${fieldName} is required`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AirSafetyMeetingValidationError(`${fieldName} must be a valid date`);
  }

  return parsed.toISOString();
}

function requiredSignoffDecision(
  value: unknown,
): AirSafetyMeetingSignoffDecision {
  if (
    typeof value !== "string" ||
    !SIGNOFF_DECISIONS.has(value as AirSafetyMeetingSignoffDecision)
  ) {
    throw new AirSafetyMeetingValidationError("reviewDecision is not supported");
  }

  return value as AirSafetyMeetingSignoffDecision;
}

function optionalDateOnly(value: unknown, fieldName: string): string | null {
  const normalized = optionalTrimmed(value, fieldName);

  if (!normalized) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new AirSafetyMeetingValidationError(
      `${fieldName} must be a YYYY-MM-DD date`,
    );
  }

  const parsed = Date.parse(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) {
    throw new AirSafetyMeetingValidationError(
      `${fieldName} must be a valid date`,
    );
  }

  return normalized;
}

function optionalStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AirSafetyMeetingValidationError(`${fieldName} must be an array`);
  }

  return value
    .map((item, index) => {
      if (typeof item !== "string") {
        throw new AirSafetyMeetingValidationError(
          `${fieldName}[${index}] must be a string`,
        );
      }

      return item.trim();
    })
    .filter(Boolean);
}

export function validateCreateAirSafetyMeetingInput(
  input: CreateAirSafetyMeetingInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AirSafetyMeetingValidationError("Request body must be an object");
  }

  const meetingType = input.meetingType ?? "quarterly_air_safety_review";
  if (!MEETING_TYPES.has(meetingType)) {
    throw new AirSafetyMeetingValidationError("meetingType is not supported");
  }

  const heldAt = optionalDate(input.heldAt, "heldAt");
  const status = input.status ?? (heldAt ? "completed" : "scheduled");
  if (!MEETING_STATUSES.has(status)) {
    throw new AirSafetyMeetingValidationError("status is not supported");
  }

  if (status === "completed" && !heldAt) {
    throw new AirSafetyMeetingValidationError(
      "heldAt is required for completed meetings",
    );
  }

  if (status === "cancelled" && heldAt) {
    throw new AirSafetyMeetingValidationError(
      "cancelled meetings cannot have heldAt",
    );
  }

  const scheduledPeriodStart = optionalDateOnly(
    input.scheduledPeriodStart,
    "scheduledPeriodStart",
  );
  const scheduledPeriodEnd = optionalDateOnly(
    input.scheduledPeriodEnd,
    "scheduledPeriodEnd",
  );

  if (
    scheduledPeriodStart &&
    scheduledPeriodEnd &&
    scheduledPeriodEnd < scheduledPeriodStart
  ) {
    throw new AirSafetyMeetingValidationError(
      "scheduledPeriodEnd must be on or after scheduledPeriodStart",
    );
  }

  return {
    meetingType,
    scheduledPeriodStart,
    scheduledPeriodEnd,
    dueAt: requiredDate(input.dueAt, "dueAt"),
    heldAt,
    status,
    chairperson: optionalTrimmed(input.chairperson, "chairperson"),
    attendees: optionalStringArray(input.attendees, "attendees"),
    agenda: optionalStringArray(input.agenda, "agenda"),
    minutes: optionalTrimmed(input.minutes, "minutes"),
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateCreateAirSafetyMeetingSignoffInput(
  input: CreateAirSafetyMeetingSignoffInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AirSafetyMeetingValidationError("Request body must be an object");
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
    reviewNotes: optionalTrimmed(input.reviewNotes, "reviewNotes"),
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateCreateGovernanceApprovalRollupSignoffInput(
  input: CreateGovernanceApprovalRollupSignoffInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new AirSafetyMeetingValidationError("Request body must be an object");
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
    reviewNotes: optionalTrimmed(input.reviewNotes, "reviewNotes"),
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}

export function validateQuarterlyComplianceQuery(input: {
  asOf?: unknown;
}): Date {
  return optionalDate(input.asOf, "asOf") ?? new Date();
}

export function validateAirSafetyMeetingId(value: unknown): string {
  const normalized = optionalTrimmed(value, "meetingId");

  if (!normalized) {
    throw new AirSafetyMeetingValidationError("meetingId is required");
  }

  if (!UUID_RE.test(normalized)) {
    throw new AirSafetyMeetingValidationError(
      "meetingId must be a valid UUID",
    );
  }

  return normalized;
}
