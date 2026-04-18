export class MissionPlanningValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "MISSION_PLANNING_VALIDATION_FAILED";
}

export class MissionPlanningDraftNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_DRAFT_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission planning draft not found: ${missionId}`);
  }
}

export class MissionPlanningReferenceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_PLANNING_REFERENCE_NOT_FOUND";

  constructor(message: string) {
    super(message);
  }
}
