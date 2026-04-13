export class MissionNotActiveError extends Error {
  readonly statusCode = 409;
  readonly code = "MISSION_NOT_ACTIVE";

  constructor(
    public readonly missionId: string,
    public readonly missionStatus: string,
  ) {
    super(`Mission ${missionId} is not active. Current status: ${missionStatus}`);
    this.name = "MissionNotActiveError";
  }
}

export class MissionTelemetryValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "MISSION_TELEMETRY_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "MissionTelemetryValidationError";
  }
}