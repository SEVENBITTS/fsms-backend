export class MissionExternalOverlayMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly type = "mission_not_found";

  constructor(missionId: string) {
    super(`Mission ${missionId} not found`);
  }
}
