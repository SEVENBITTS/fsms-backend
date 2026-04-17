import type { PlatformReadinessCheck } from "../platforms/platform.types";
import type { PilotReadinessCheck } from "../pilots/pilot.types";
import type { MissionRiskAssessment } from "../mission-risk/mission-risk.types";

export type MissionReadinessResult = "pass" | "warning" | "fail";

export type MissionReadinessReasonCode =
  | "MISSION_PLATFORM_READY"
  | "MISSION_PLATFORM_WARNING"
  | "MISSION_PLATFORM_FAILED"
  | "MISSION_PLATFORM_NOT_ASSIGNED"
  | "MISSION_PLATFORM_NOT_FOUND"
  | "MISSION_PILOT_READY"
  | "MISSION_PILOT_WARNING"
  | "MISSION_PILOT_FAILED"
  | "MISSION_PILOT_NOT_ASSIGNED"
  | "MISSION_PILOT_NOT_FOUND"
  | "MISSION_RISK_READY"
  | "MISSION_RISK_WARNING"
  | "MISSION_RISK_FAILED";

export interface MissionReadinessReason {
  code: MissionReadinessReasonCode;
  severity: MissionReadinessResult;
  message: string;
  source: "mission" | "platform" | "pilot" | "risk";
  relatedPlatformId?: string;
  relatedPlatformReasonCodes?: string[];
  relatedPilotId?: string;
  relatedPilotReasonCodes?: string[];
  relatedRiskReasonCodes?: string[];
}

export interface MissionReadinessGate {
  result: MissionReadinessResult;
  blocksApproval: boolean;
  blocksDispatch: boolean;
  requiresReview: boolean;
}

export interface MissionReadinessCheck {
  missionId: string;
  platformId: string | null;
  pilotId: string | null;
  result: MissionReadinessResult;
  gate: MissionReadinessGate;
  reasons: MissionReadinessReason[];
  platformReadiness: PlatformReadinessCheck | null;
  pilotReadiness: PilotReadinessCheck | null;
  missionRisk: MissionRiskAssessment | null;
}
