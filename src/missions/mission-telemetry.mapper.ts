import { randomUUID } from "crypto";
import type {
  MissionTelemetryInput,
  MissionTelemetryRow,
} from "./mission-telemetry.types";

export function toMissionTelemetryRow(
  missionId: string,
  input: MissionTelemetryInput,
): MissionTelemetryRow {
  return {
    id: randomUUID(),
    missionId,
    recordedAt: new Date(input.timestamp),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    altitudeM: input.altitudeM ?? null,
    speedMps: input.speedMps ?? null,
    headingDeg: input.headingDeg ?? null,
    progressPct: input.progressPct ?? null,
    payload: input.payload ?? {},
  };
}