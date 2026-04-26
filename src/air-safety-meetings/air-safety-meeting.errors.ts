export class AirSafetyMeetingValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "AIR_SAFETY_MEETING_VALIDATION_FAILED";
}

export class AirSafetyMeetingNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "AIR_SAFETY_MEETING_NOT_FOUND";

  constructor(meetingId: string) {
    super(`Air safety meeting not found: ${meetingId}`);
  }
}

export class AirSafetyMeetingSignoffNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = "AIR_SAFETY_MEETING_SIGNOFF_NOT_FOUND";

  constructor(signoffId: string) {
    super(`Air safety meeting sign-off not found: ${signoffId}`);
  }
}
