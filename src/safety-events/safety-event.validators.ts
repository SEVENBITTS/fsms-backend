import { SafetyEventValidationError } from "./safety-event.errors";
import type {
  AssessSafetyEventMeetingTriggerInput,
  CreateSafetyEventAgendaLinkInput,
  CreateSafetyEventInput,
  SafetyEventSeverity,
  SafetyEventStatus,
  SafetyEventType,
} from "./safety-event.types";

const EVENT_TYPES = new Set<SafetyEventType>([
  "sop_breach",
  "training_need",
  "maintenance_concern",
  "airspace_deviation",
  "mission_planning_issue",
  "platform_readiness_issue",
  "pilot_readiness_issue",
  "operational_incident",
  "near_miss",
  "post_operation_finding",
]);

const SEVERITIES = new Set<SafetyEventSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

const STATUSES = new Set<SafetyEventStatus>([
  "open",
  "under_review",
  "closed",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new SafetyEventValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredTrimmed(value: unknown, fieldName: string): string {
  const normalized = optionalTrimmed(value, fieldName);

  if (!normalized) {
    throw new SafetyEventValidationError(`${fieldName} is required`);
  }

  return normalized;
}

function optionalUuid(value: unknown, fieldName: string): string | null {
  const normalized = optionalTrimmed(value, fieldName);

  if (!normalized) {
    return null;
  }

  if (!UUID_RE.test(normalized)) {
    throw new SafetyEventValidationError(`${fieldName} must be a valid UUID`);
  }

  return normalized;
}

function requiredDate(value: unknown, fieldName: string): Date {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new SafetyEventValidationError(
      `${fieldName} must be a valid ISO timestamp`,
    );
  }

  return new Date(value);
}

function optionalBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new SafetyEventValidationError(`${fieldName} must be a boolean`);
  }

  return value;
}

export function validateCreateSafetyEventInput(
  input: CreateSafetyEventInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new SafetyEventValidationError("Request body must be an object");
  }

  const eventType = input.eventType;
  if (!eventType || !EVENT_TYPES.has(eventType)) {
    throw new SafetyEventValidationError("eventType is required and supported");
  }

  const severity = input.severity;
  if (!severity || !SEVERITIES.has(severity)) {
    throw new SafetyEventValidationError("severity is required and supported");
  }

  const status = input.status ?? "open";
  if (!STATUSES.has(status)) {
    throw new SafetyEventValidationError("status is not supported");
  }

  return {
    eventType,
    severity,
    status,
    missionId: optionalUuid(input.missionId, "missionId"),
    platformId: optionalUuid(input.platformId, "platformId"),
    pilotId: optionalUuid(input.pilotId, "pilotId"),
    postOperationEvidenceSnapshotId: optionalUuid(
      input.postOperationEvidenceSnapshotId,
      "postOperationEvidenceSnapshotId",
    ),
    airSafetyMeetingId: optionalUuid(
      input.airSafetyMeetingId,
      "airSafetyMeetingId",
    ),
    reportedBy: optionalTrimmed(input.reportedBy, "reportedBy"),
    eventOccurredAt: requiredDate(input.eventOccurredAt, "eventOccurredAt"),
    summary: requiredTrimmed(input.summary, "summary"),
    description: optionalTrimmed(input.description, "description"),
    immediateActionTaken: optionalTrimmed(
      input.immediateActionTaken,
      "immediateActionTaken",
    ),
    sopReference: optionalTrimmed(input.sopReference, "sopReference"),
    meetingRequired: optionalBoolean(
      input.meetingRequired,
      "meetingRequired",
    ),
    sopReviewRequired: optionalBoolean(
      input.sopReviewRequired,
      "sopReviewRequired",
    ),
    trainingRequired: optionalBoolean(
      input.trainingRequired,
      "trainingRequired",
    ),
    maintenanceReviewRequired: optionalBoolean(
      input.maintenanceReviewRequired,
      "maintenanceReviewRequired",
    ),
    accountableManagerReviewRequired: optionalBoolean(
      input.accountableManagerReviewRequired,
      "accountableManagerReviewRequired",
    ),
    regulatorReportableReviewRequired: optionalBoolean(
      input.regulatorReportableReviewRequired,
      "regulatorReportableReviewRequired",
    ),
  };
}

export function validateSafetyEventId(value: unknown): string {
  const normalized = requiredTrimmed(value, "eventId");

  if (!UUID_RE.test(normalized)) {
    throw new SafetyEventValidationError("eventId must be a valid UUID");
  }

  return normalized;
}

export function validateSafetyEventMeetingTriggerId(value: unknown): string {
  const normalized = requiredTrimmed(
    value,
    "safetyEventMeetingTriggerId",
  );

  if (!UUID_RE.test(normalized)) {
    throw new SafetyEventValidationError(
      "safetyEventMeetingTriggerId must be a valid UUID",
    );
  }

  return normalized;
}

export function validateAssessMeetingTriggerInput(
  input: AssessSafetyEventMeetingTriggerInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
      assessedBy: null,
    };
  }

  if (typeof input !== "object") {
    throw new SafetyEventValidationError("Request body must be an object");
  }

  return {
    assessedBy: optionalTrimmed(input.assessedBy, "assessedBy"),
  };
}

export function validateCreateAgendaLinkInput(
  input: CreateSafetyEventAgendaLinkInput | undefined,
) {
  if (!input || typeof input !== "object") {
    throw new SafetyEventValidationError("Request body must be an object");
  }

  return {
    airSafetyMeetingId: optionalUuid(
      input.airSafetyMeetingId,
      "airSafetyMeetingId",
    ) ?? requiredTrimmed(input.airSafetyMeetingId, "airSafetyMeetingId"),
    agendaItem: requiredTrimmed(input.agendaItem, "agendaItem"),
    linkedBy: optionalTrimmed(input.linkedBy, "linkedBy"),
  };
}
