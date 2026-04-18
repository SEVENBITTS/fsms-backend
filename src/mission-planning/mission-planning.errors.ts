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

export class MissionPlanningReviewNotReadyError extends Error {
  readonly statusCode = 409;
  readonly code = "MISSION_PLANNING_REVIEW_NOT_READY";

  constructor(readonly blockingReasons: string[]) {
    super("Mission planning review is not ready for approval handoff");
  }
}
