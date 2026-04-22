export class MissionExternalOverlayMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly type = "mission_not_found";

  constructor(missionId: string) {
    super(`Mission ${missionId} not found`);
  }
}

export class MissionExternalOverlayRefreshRunNotFoundError extends Error {
  readonly statusCode = 404;
  readonly type = "refresh_run_not_found";

  constructor(missionId: string, refreshRunId: string) {
    super(`Refresh run ${refreshRunId} not found for mission ${missionId}`);
  }
}

export class MissionExternalOverlayRefreshRunDiffQueryInvalidError extends Error {
  readonly statusCode = 400;
  readonly type = "refresh_run_diff_query_invalid";

  constructor(message: string) {
    super(message);
  }
}

export class MissionExternalOverlayRefreshRunChronologyQueryInvalidError extends Error {
  readonly statusCode = 400;
  readonly type = "refresh_run_chronology_query_invalid";

  constructor(message: string) {
    super(message);
  }
}

export class MissionExternalOverlayRefreshRunTransitionDrilldownQueryInvalidError extends Error {
  readonly statusCode = 400;
  readonly type = "refresh_run_transition_drilldown_query_invalid";

  constructor(message: string) {
    super(message);
  }
}

export class MissionExternalOverlayRefreshRunTransitionArtifactQueryInvalidError extends Error {
  readonly statusCode = 400;
  readonly type = "refresh_run_transition_artifact_query_invalid";

  constructor(message: string) {
    super(message);
  }
}
