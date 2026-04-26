import { MissionPlanningValidationError } from "./mission-planning.errors";
import type {
  CreateMissionPlanningApprovalHandoffInput,
  CreateMissionPlanningDraftInput,
  UpdateMissionPlanningDraftInput,
} from "./mission-planning.types";

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new MissionPlanningValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalObject<T>(value: unknown, fieldName: string): T | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new MissionPlanningValidationError(`${fieldName} must be an object`);
  }

  return value as T;
}

function requiredPatchObject<T>(value: unknown, fieldName: string): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MissionPlanningValidationError(`${fieldName} must be an object`);
  }

  return value as T;
}

export function validateCreateMissionPlanningDraftInput(
  input: CreateMissionPlanningDraftInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
      organisationId: null,
      missionPlanId: null,
      platformId: null,
      pilotId: null,
      riskInput: null,
      airspaceInput: null,
    };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new MissionPlanningValidationError("Request body must be an object");
  }

  return {
    organisationId: optionalTrimmed(input.organisationId, "organisationId"),
    missionPlanId: optionalTrimmed(input.missionPlanId, "missionPlanId"),
    platformId: optionalTrimmed(input.platformId, "platformId"),
    pilotId: optionalTrimmed(input.pilotId, "pilotId"),
    riskInput: optionalObject(input.riskInput, "riskInput"),
    airspaceInput: optionalObject(input.airspaceInput, "airspaceInput"),
  };
}

export function validateUpdateMissionPlanningDraftInput(
  input: UpdateMissionPlanningDraftInput | undefined,
) {
  if (input === undefined || input === null) {
    throw new MissionPlanningValidationError("Request body must be an object");
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new MissionPlanningValidationError("Request body must be an object");
  }

  return {
    organisationId: {
      provided: Object.prototype.hasOwnProperty.call(input, "organisationId"),
      value: optionalTrimmed(input.organisationId, "organisationId"),
    },
    missionPlanId: {
      provided: Object.prototype.hasOwnProperty.call(input, "missionPlanId"),
      value: optionalTrimmed(input.missionPlanId, "missionPlanId"),
    },
    platformId: {
      provided: Object.prototype.hasOwnProperty.call(input, "platformId"),
      value: optionalTrimmed(input.platformId, "platformId"),
    },
    pilotId: {
      provided: Object.prototype.hasOwnProperty.call(input, "pilotId"),
      value: optionalTrimmed(input.pilotId, "pilotId"),
    },
    riskInput: requiredPatchObject(input.riskInput, "riskInput"),
    airspaceInput: requiredPatchObject(input.airspaceInput, "airspaceInput"),
  };
}

export function validateCreateMissionPlanningApprovalHandoffInput(
  input: CreateMissionPlanningApprovalHandoffInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
      createdBy: null,
    };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    throw new MissionPlanningValidationError("Request body must be an object");
  }

  return {
    createdBy: optionalTrimmed(input.createdBy, "createdBy"),
  };
}
