import { MissionRiskValidationError } from "./mission-risk.errors";
import type {
  CreateMissionRiskInput,
  OperatingCategory,
  RiskLevel,
} from "./mission-risk.types";

const OPERATING_CATEGORIES = new Set<OperatingCategory>([
  "open",
  "specific",
  "certified",
]);

const RISK_LEVELS = new Set<RiskLevel>(["low", "medium", "high"]);

function requiredEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: Set<T>,
): T {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    throw new MissionRiskValidationError(`${fieldName} is not supported`);
  }

  return value as T;
}

function optionalTrimmed(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new MissionRiskValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateCreateMissionRiskInput(input: CreateMissionRiskInput) {
  if (!input || typeof input !== "object") {
    throw new MissionRiskValidationError("Request body must be an object");
  }

  return {
    operatingCategory: requiredEnum(
      input.operatingCategory,
      "operatingCategory",
      OPERATING_CATEGORIES,
    ),
    missionComplexity: requiredEnum(
      input.missionComplexity,
      "missionComplexity",
      RISK_LEVELS,
    ),
    populationExposure: requiredEnum(
      input.populationExposure,
      "populationExposure",
      RISK_LEVELS,
    ),
    airspaceComplexity: requiredEnum(
      input.airspaceComplexity,
      "airspaceComplexity",
      RISK_LEVELS,
    ),
    weatherRisk: requiredEnum(input.weatherRisk, "weatherRisk", RISK_LEVELS),
    payloadRisk: requiredEnum(input.payloadRisk, "payloadRisk", RISK_LEVELS),
    mitigationSummary: optionalTrimmed(
      input.mitigationSummary,
      "mitigationSummary",
    ),
  };
}
