export class AirspaceComplianceValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "AIRSPACE_COMPLIANCE_VALIDATION_FAILED";
}

export class AirspaceComplianceMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}
