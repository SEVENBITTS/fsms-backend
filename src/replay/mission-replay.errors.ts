export class MissionReplayValidationError extends Error {
  readonly statusCode = 400;
  readonly code = "MISSION_REPLAY_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "MissionReplayValidationError";
  }
}
