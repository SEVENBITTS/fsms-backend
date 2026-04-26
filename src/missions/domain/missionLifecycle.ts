import { InvalidMissionTransitionError } from "../errors";

export const missionLifecycleTransitions = {
  draft: ["submitted", "aborted"],
  submitted: ["approved", "aborted"],
  approved: ["active", "aborted"],
  active: ["completed", "aborted"],
  completed: [],
  aborted: [],
} as const;

export type MissionStatus = keyof typeof missionLifecycleTransitions;

export const assertMissionTransitionAllowed = (
  fromStatus: string,
  toStatus: string,
  action: string,
): void => {
  const allowedTargets =
    missionLifecycleTransitions[fromStatus as MissionStatus] ?? [];

  if (!allowedTargets.includes(toStatus as never)) {
    throw new InvalidMissionTransitionError(
      `Mission cannot be ${action} from status ${fromStatus}`,
    );
  }
};