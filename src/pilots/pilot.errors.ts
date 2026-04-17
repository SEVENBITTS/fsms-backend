export class PilotValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "PILOT_VALIDATION_FAILED";
}

export class PilotNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "PILOT_NOT_FOUND";

  constructor(pilotId: string) {
    super(`Pilot not found: ${pilotId}`);
  }
}
