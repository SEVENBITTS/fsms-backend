export class InsuranceValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "INSURANCE_VALIDATION_FAILED";
}

export class InsuranceProfileNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "INSURANCE_PROFILE_NOT_FOUND";

  constructor(profileId: string) {
    super(`Insurance profile not found: ${profileId}`);
  }
}

export class InsuranceDocumentNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "INSURANCE_DOCUMENT_NOT_FOUND";

  constructor(documentId: string) {
    super(`Insurance document not found: ${documentId}`);
  }
}

export class InsuranceMissionNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "MISSION_NOT_FOUND";

  constructor(missionId: string) {
    super(`Mission not found: ${missionId}`);
  }
}
