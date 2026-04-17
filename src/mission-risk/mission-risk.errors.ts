export class MissionRiskValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "MISSION_RISK_VALIDATION_FAILED";
}

export class MissionRiskMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}
