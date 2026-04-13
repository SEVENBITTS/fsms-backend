import { InvalidMissionTransitionError } from "../../../missions/errors";

export const missionLifecycleTransitions = {
  draft: ["submitted", "aborted"],
  submitted: ["approved", "aborted"],
  approved: ["active", "aborted"],
  active: ["completed", "aborted"],
  completed: [],
  aborted: [],
} as const;

export type MissionStatus = keyof typeof missionLifecycleTransitions;

export const missionLifecycleActions = {
  submit: {
    targetStatus: "submitted",
    verb: "submitted",
  },
  approve: {
    targetStatus: "approved",
    verb: "approved",
  },
  launch: {
    targetStatus: "active",
    verb: "launched",
  },
  complete: {
    targetStatus: "completed",
    verb: "completed",
  },
  abort: {
    targetStatus: "aborted",
    verb: "aborted",
  },
} as const;

export type MissionLifecycleAction = keyof typeof missionLifecycleActions;

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

export const checkMissionActionAllowed = (
  fromStatus: string,
  action: MissionLifecycleAction,
) => {
  const actionConfig = missionLifecycleActions[action];
  const allowedTargets =
    missionLifecycleTransitions[fromStatus as MissionStatus] ?? [];

  const allowed = allowedTargets.includes(actionConfig.targetStatus as never);

  return {
    action,
    currentStatus: fromStatus,
    targetStatus: actionConfig.targetStatus,
    allowed,
    error: allowed
      ? null
      : {
          type: "invalid_state_transition",
          message: `Mission cannot be ${actionConfig.verb} from status ${fromStatus}`,
        },
  };
};

export const assertMissionActionAllowed = (
  fromStatus: string,
  action: MissionLifecycleAction,
): void => {
  const result = checkMissionActionAllowed(fromStatus, action);

  if (!result.allowed) {
    throw new InvalidMissionTransitionError(result.error!.message);
  }
};