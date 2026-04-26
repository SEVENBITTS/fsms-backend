export class MissionAccessMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly type = "mission_not_found";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}

export class MissionAccessOrganisationMissingError extends Error {
  readonly statusCode = 409;
  readonly type = "mission_organisation_missing";

  constructor(missionId: string) {
    super(`Mission has no organisation context: ${missionId}`);
  }
}
