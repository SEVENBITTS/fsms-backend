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
