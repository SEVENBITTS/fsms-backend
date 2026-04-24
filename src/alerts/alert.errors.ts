export class AlertValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "ALERT_VALIDATION_FAILED";
}

export class AlertMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}

export class AlertNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "ALERT_NOT_FOUND";

  constructor(alertId: string) {
    super(`Alert not found: ${alertId}`);
  }
}

export class AlertMissionMismatchError extends Error {
  readonly statusCode = 404;
  readonly code = "ALERT_NOT_FOUND";

  constructor(alertId: string, missionId: string) {
    super(`Alert ${alertId} was not found for mission ${missionId}`);
  }
}
