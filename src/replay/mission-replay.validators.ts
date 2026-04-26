import { MissionReplayValidationError } from "./mission-replay.errors";
import type {
  MissionReplayQuery,
  ValidatedMissionReplayQuery,
} from "./mission-replay.types";

function parseOptionalDate(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new MissionReplayValidationError(
      `${fieldName} must be a valid ISO timestamp`,
    );
  }

  return new Date(value);
}

export function validateMissionReplayQuery(
  query: MissionReplayQuery,
): ValidatedMissionReplayQuery {
  const from = parseOptionalDate(query.from, "from");
  const to = parseOptionalDate(query.to, "to");

  if (from && to && from > to) {
    throw new MissionReplayValidationError("from must be <= to");
  }

  return { from, to };
}
