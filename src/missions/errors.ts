export class InvalidMissionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMissionTransitionError";
  }
}