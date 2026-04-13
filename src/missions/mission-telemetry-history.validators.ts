import { MissionTelemetryValidationError } from "./mission-telemetry.errors";
import type { MissionTelemetryHistoryQuery } from "./mission-telemetry.types";

export interface ValidatedMissionTelemetryHistoryQuery {
  from?: Date;
  to?: Date;
  limit: number;
}

function parseOptionalDate(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new MissionTelemetryValidationError(
      `${fieldName} must be a valid ISO timestamp`,
    );
  }

  return new Date(value);
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 100;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new MissionTelemetryValidationError("limit must be a positive integer");
  }

  if (parsed > 1000) {
    throw new MissionTelemetryValidationError("limit must be <= 1000");
  }

  return parsed;
}

export function validateMissionTelemetryHistoryQuery(
  query: MissionTelemetryHistoryQuery,
): ValidatedMissionTelemetryHistoryQuery {
  const from = parseOptionalDate(query.from, "from");
  const to = parseOptionalDate(query.to, "to");
  const limit = parseLimit(query.limit);

  if (from && to && from > to) {
    throw new MissionTelemetryValidationError("from must be <= to");
  }

  return { from, to, limit };
}