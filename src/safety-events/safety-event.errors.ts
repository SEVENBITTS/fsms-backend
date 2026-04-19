export class SafetyEventValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "SAFETY_EVENT_VALIDATION_FAILED";
}

export class SafetyEventReferenceNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "SAFETY_EVENT_REFERENCE_NOT_FOUND";

  constructor(message: string) {
    super(message);
  }
}
