import { HttpError } from "../utils/errors";

export class InvalidMissionTransitionError extends HttpError {
  constructor(message: string) {
    super(409, message, "invalid_state_transition");
    this.name = "InvalidMissionTransitionError";
  }
}