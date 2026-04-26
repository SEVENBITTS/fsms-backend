import { PlatformValidationError } from "./platform.errors";
import type {
  CreateMaintenanceRecordInput,
  CreateMaintenanceScheduleInput,
  CreatePlatformInput,
  MaintenanceScheduleStatus,
  PlatformStatus,
} from "./platform.types";

const PLATFORM_STATUSES = new Set<PlatformStatus>([
  "active",
  "inactive",
  "maintenance_due",
  "grounded",
  "retired",
]);

const SCHEDULE_STATUSES = new Set<MaintenanceScheduleStatus>([
  "active",
  "inactive",
]);

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new PlatformValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredTrimmed(value: unknown, fieldName: string): string {
  const normalized = optionalTrimmed(value, fieldName);

  if (!normalized) {
    throw new PlatformValidationError(`${fieldName} is required`);
  }

  return normalized;
}

function optionalNonNegativeNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new PlatformValidationError(`${fieldName} must be a non-negative number`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new PlatformValidationError(`${fieldName} must be a positive integer`);
  }

  return value;
}

function optionalPositiveNumber(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new PlatformValidationError(`${fieldName} must be a positive number`);
  }

  return value;
}

function optionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new PlatformValidationError(`${fieldName} must be a valid ISO timestamp`);
  }

  return new Date(value);
}

export function validateCreatePlatformInput(input: CreatePlatformInput) {
  if (!input || typeof input !== "object") {
    throw new PlatformValidationError("Request body must be an object");
  }

  const status = input.status ?? "active";

  if (!PLATFORM_STATUSES.has(status)) {
    throw new PlatformValidationError("status is not supported");
  }

  return {
    name: requiredTrimmed(input.name, "name"),
    registration: optionalTrimmed(input.registration, "registration"),
    platformType: optionalTrimmed(input.platformType, "platformType"),
    manufacturer: optionalTrimmed(input.manufacturer, "manufacturer"),
    model: optionalTrimmed(input.model, "model"),
    serialNumber: optionalTrimmed(input.serialNumber, "serialNumber"),
    status,
    totalFlightHours: optionalNonNegativeNumber(
      input.totalFlightHours,
      "totalFlightHours",
    ) ?? 0,
    notes: optionalTrimmed(input.notes, "notes"),
  };
}

export function validateCreateMaintenanceScheduleInput(
  input: CreateMaintenanceScheduleInput,
) {
  if (!input || typeof input !== "object") {
    throw new PlatformValidationError("Request body must be an object");
  }

  const status = input.status ?? "active";

  if (!SCHEDULE_STATUSES.has(status)) {
    throw new PlatformValidationError("status is not supported");
  }

  return {
    taskName: requiredTrimmed(input.taskName, "taskName"),
    description: optionalTrimmed(input.description, "description"),
    intervalDays: optionalPositiveInteger(input.intervalDays, "intervalDays"),
    intervalFlightHours: optionalPositiveNumber(
      input.intervalFlightHours,
      "intervalFlightHours",
    ),
    nextDueAt: optionalDate(input.nextDueAt, "nextDueAt"),
    nextDueFlightHours: optionalNonNegativeNumber(
      input.nextDueFlightHours,
      "nextDueFlightHours",
    ),
    status,
  };
}

export function validateCreateMaintenanceRecordInput(
  input: CreateMaintenanceRecordInput,
) {
  if (!input || typeof input !== "object") {
    throw new PlatformValidationError("Request body must be an object");
  }

  const completedAt = optionalDate(input.completedAt, "completedAt");

  if (!completedAt) {
    throw new PlatformValidationError("completedAt is required");
  }

  return {
    scheduleId: optionalTrimmed(input.scheduleId, "scheduleId"),
    taskName: optionalTrimmed(input.taskName, "taskName"),
    completedAt,
    completedBy: requiredTrimmed(input.completedBy, "completedBy"),
    completedFlightHours: optionalNonNegativeNumber(
      input.completedFlightHours,
      "completedFlightHours",
    ),
    notes: optionalTrimmed(input.notes, "notes"),
    evidenceRef: optionalTrimmed(input.evidenceRef, "evidenceRef"),
  };
}
