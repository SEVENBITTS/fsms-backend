import { InvalidMissionTransitionError } from "./errors";

export type MissionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "active"
  | "completed"
  | "aborted";

export function assertCanSubmit(status: MissionStatus): void {
  if (status !== "draft") {
    throw new InvalidMissionTransitionError(
      `Mission cannot be submitted from status ${status}`,
    );
  }
}

export function assertCanApprove(status: MissionStatus): void {
  if (status !== "submitted") {
    throw new InvalidMissionTransitionError(
      `Mission cannot be approved from status ${status}`,
    );
  }
}

export function assertCanLaunch(status: MissionStatus): void {
  if (status !== "approved") {
    throw new InvalidMissionTransitionError(
      `Mission cannot be launched from status ${status}`,
    );
  }
}

export function assertCanComplete(status: MissionStatus): void {
  if (status !== "active") {
    throw new InvalidMissionTransitionError(
      `Mission cannot be completed from status ${status}`,
    );
  }
}

export function assertCanAbort(status: MissionStatus): void {
  const abortable: MissionStatus[] = ["draft", "submitted", "approved", "active"];

  if (!abortable.includes(status)) {
    throw new InvalidMissionTransitionError(
      `Mission cannot be aborted from status ${status}`,
    );
  }
}