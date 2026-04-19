export class AirSafetyMeetingValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "AIR_SAFETY_MEETING_VALIDATION_FAILED";
}
