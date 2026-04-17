import type {
  MissionTelemetryBatchInput,
  MissionTelemetryInput,
} from "./mission-telemetry.types";
import { MissionTelemetryValidationError } from "./mission-telemetry.errors";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertRecord(record: MissionTelemetryInput, index: number): void {
  if (!record || typeof record !== "object") {
    throw new MissionTelemetryValidationError(`records[${index}] must be an object`);
  }

  if (!record.timestamp || Number.isNaN(Date.parse(record.timestamp))) {
    throw new MissionTelemetryValidationError(
      `records[${index}].timestamp must be a valid ISO timestamp`,
    );
  }

  if (record.lat !== undefined) {
    if (!isFiniteNumber(record.lat) || record.lat < -90 || record.lat > 90) {
      throw new MissionTelemetryValidationError(
        `records[${index}].lat must be between -90 and 90`,
      );
    }
  }

  if (record.lng !== undefined) {
    if (!isFiniteNumber(record.lng) || record.lng < -180 || record.lng > 180) {
      throw new MissionTelemetryValidationError(
        `records[${index}].lng must be between -180 and 180`,
      );
    }
  }

  for (const [key, value] of Object.entries({
    altitudeM: record.altitudeM,
    speedMps: record.speedMps,
    headingDeg: record.headingDeg,
    progressPct: record.progressPct,
  })) {
    if (value !== undefined && !isFiniteNumber(value)) {
      throw new MissionTelemetryValidationError(
        `records[${index}].${key} must be a finite number`,
      );
    }
  }

  if (
    record.progressPct !== undefined &&
    (record.progressPct < 0 || record.progressPct > 100)
  ) {
    throw new MissionTelemetryValidationError(
      `records[${index}].progressPct must be between 0 and 100`,
    );
  }

  if (
    record.payload !== undefined &&
    (typeof record.payload !== "object" ||
      record.payload === null ||
      Array.isArray(record.payload))
  ) {
    throw new MissionTelemetryValidationError(
      `records[${index}].payload must be an object`,
    );
  }
}

export function validateMissionTelemetryBatch(
  input: MissionTelemetryBatchInput,
): void {
  if (!input || typeof input !== "object") {
    throw new MissionTelemetryValidationError("Request body must be an object");
  }

  if (!Array.isArray(input.records) || input.records.length === 0) {
    throw new MissionTelemetryValidationError("records must be a non-empty array");
  }

  input.records.forEach(assertRecord);
}