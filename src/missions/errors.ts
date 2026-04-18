import { HttpError } from "../utils/errors";

export class InvalidMissionTransitionError extends HttpError {
  constructor(message: string) {
    super(409, message, "invalid_state_transition");
    this.name = "InvalidMissionTransitionError";
  }
}

export class MissionApprovalEvidenceRequiredError extends HttpError {
  constructor() {
    super(
      400,
      "Mission approval requires a linked readiness evidence snapshot",
      "mission_approval_evidence_required",
    );
    this.name = "MissionApprovalEvidenceRequiredError";
  }
}

export class InvalidMissionApprovalEvidenceError extends HttpError {
  constructor(message: string) {
    super(409, message, "invalid_mission_approval_evidence");
    this.name = "InvalidMissionApprovalEvidenceError";
  }
}

export class MissionDispatchEvidenceRequiredError extends HttpError {
  constructor() {
    super(
      400,
      "Mission launch requires a linked readiness evidence snapshot",
      "mission_dispatch_evidence_required",
    );
    this.name = "MissionDispatchEvidenceRequiredError";
  }
}

export class InvalidMissionDispatchEvidenceError extends HttpError {
  constructor(message: string) {
    super(409, message, "invalid_mission_dispatch_evidence");
    this.name = "InvalidMissionDispatchEvidenceError";
  }
}
