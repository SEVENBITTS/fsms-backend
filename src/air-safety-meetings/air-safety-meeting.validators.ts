import { AirSafetyMeetingValidationError } from "./air-safety-meeting.errors";
import type {
  AirSafetyMeetingStatus,
  AirSafetyMeetingType,
  CreateAirSafetyMeetingInput,
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

export function validateQuarterlyComplianceQuery(input: {
  asOf?: unknown;
}): Date {
  return optionalDate(input.asOf, "asOf") ?? new Date();
}
