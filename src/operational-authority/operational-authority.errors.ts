export class OperationalAuthorityValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "OPERATIONAL_AUTHORITY_VALIDATION_FAILED";
}

export class OperationalAuthorityProfileNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "OA_PROFILE_NOT_FOUND";

  constructor(profileId: string) {
    super(`Operational authority profile not found: ${profileId}`);
  }
}

export class OperationalAuthorityDocumentNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "OA_DOCUMENT_NOT_FOUND";

  constructor(documentId: string) {
    super(`Operational authority document not found: ${documentId}`);
  }
}

export class OperationalAuthorityMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}

export class OperationalAuthorityPilotAuthorisationNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "OA_PILOT_AUTHORISATION_NOT_FOUND";

  constructor(authorisationId: string) {
    super(`Operational authority pilot authorisation not found: ${authorisationId}`);
  }
}
