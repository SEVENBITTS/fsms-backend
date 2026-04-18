import { MissionPlanningValidationError } from "./mission-planning.errors";
import type { CreateMissionPlanningDraftInput } from "./mission-planning.types";

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

export function validateCreateMissionPlanningDraftInput(
  input: CreateMissionPlanningDraftInput | undefined,
) {
  if (input === undefined || input === null) {
    return {
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
    missionPlanId: optionalTrimmed(input.missionPlanId, "missionPlanId"),
    platformId: optionalTrimmed(input.platformId, "platformId"),
    pilotId: optionalTrimmed(input.pilotId, "pilotId"),
    riskInput: optionalObject(input.riskInput, "riskInput"),
    airspaceInput: optionalObject(input.airspaceInput, "airspaceInput"),
  };
}
