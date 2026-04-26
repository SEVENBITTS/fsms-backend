import { AirspaceComplianceValidationError } from "./airspace-compliance.errors";
import type {
  AirspaceClass,
  CreateAirspaceComplianceInput,
  PermissionStatus,
  RestrictionStatus,
} from "./airspace-compliance.types";

const AIRSPACE_CLASSES = new Set<AirspaceClass>(["a", "b", "c", "d", "e", "f", "g"]);
const RESTRICTION_STATUSES = new Set<RestrictionStatus>([
  "clear",
  "permission_required",
  "restricted",
  "prohibited",
]);
const PERMISSION_STATUSES = new Set<PermissionStatus>([
  "not_required",
  "pending",
  "granted",
  "denied",
]);

function requiredEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: Set<T>,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new AirspaceComplianceValidationError(`${fieldName} is not supported`);
  }

  return value as T;
}

function requiredNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AirspaceComplianceValidationError(
      `${fieldName} must be a non-negative integer`,
    );
  }

  return value;
}

function optionalBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new AirspaceComplianceValidationError(`${fieldName} must be a boolean`);
  }

  return value;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new AirspaceComplianceValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateCreateAirspaceComplianceInput(
  input: CreateAirspaceComplianceInput,
) {
  if (!input || typeof input !== "object") {
    throw new AirspaceComplianceValidationError("Request body must be an object");
  }

  return {
    airspaceClass: requiredEnum(
      input.airspaceClass,
      "airspaceClass",
      AIRSPACE_CLASSES,
    ),
    maxAltitudeFt: requiredNonNegativeInteger(
      input.maxAltitudeFt,
      "maxAltitudeFt",
    ),
    restrictionStatus: requiredEnum(
      input.restrictionStatus,
      "restrictionStatus",
      RESTRICTION_STATUSES,
    ),
    permissionStatus: requiredEnum(
      input.permissionStatus,
      "permissionStatus",
      PERMISSION_STATUSES,
    ),
    controlledAirspace: optionalBoolean(
      input.controlledAirspace,
      "controlledAirspace",
    ),
    nearbyAerodrome: optionalBoolean(input.nearbyAerodrome, "nearbyAerodrome"),
    evidenceRef: optionalTrimmed(input.evidenceRef, "evidenceRef"),
    notes: optionalTrimmed(input.notes, "notes"),
  };
}
