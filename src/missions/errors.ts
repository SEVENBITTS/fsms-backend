import { addSyntheticLeadingComment } from "typescript";

export class InvalidMissionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMissionTransitionError";
  }
} i am not changing addSyntheticLeadingComment