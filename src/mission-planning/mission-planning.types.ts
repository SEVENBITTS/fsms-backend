import type { CreateAirspaceComplianceInput } from "../airspace-compliance/airspace-compliance.types";
import type {
  AuditEvidenceSnapshot,
  AuditReportSmsControlMapping,
  MissionDecisionEvidenceLink,
} from "../audit-evidence/audit-evidence.types";
import type { CreateMissionRiskInput } from "../mission-risk/mission-risk.types";
import type { MissionRiskAssessment } from "../mission-risk/mission-risk.types";
import type { AirspaceComplianceAssessment } from "../airspace-compliance/airspace-compliance.types";
import type { MissionReadinessCheck } from "../missions/mission-readiness.types";
import type { Platform } from "../platforms/platform.types";
import type { Pilot } from "../pilots/pilot.types";
import type { MissionLifecycleAction } from "../modules/missions/domain/missionLifecycle";

export interface CreateMissionPlanningDraftInput {
  missionPlanId?: string | null;
  platformId?: string | null;
  pilotId?: string | null;
  riskInput?: CreateMissionRiskInput | null;
  airspaceInput?: CreateAirspaceComplianceInput | null;
}

export interface UpdateMissionPlanningDraftInput {
  missionPlanId?: string | null;
  platformId?: string | null;
  pilotId?: string | null;
  riskInput?: CreateMissionRiskInput;
  airspaceInput?: CreateAirspaceComplianceInput;
}

export interface MissionPlanningChecklistItem {
  key: "platform" | "pilot" | "risk" | "airspace";
  status: "present" | "missing";
  message: string;
}

export interface MissionPlanningDraft {
  missionId: string;
  missionPlanId: string | null;
  status: "draft";
  platformId: string | null;
  pilotId: string | null;
  placeholders: {
    platformAssigned: boolean;
    pilotAssigned: boolean;
    riskInputPresent: boolean;
    airspaceInputPresent: boolean;
  };
  checklist: MissionPlanningChecklistItem[];
  readinessCheckAvailable: boolean;
}

export interface MissionPlanningReview {
  missionId: string;
  missionPlanId: string | null;
  status: "draft";
  platformId: string | null;
  pilotId: string | null;
  readyForApproval: boolean;
  blockingReasons: string[];
  checklist: MissionPlanningChecklistItem[];
}

export interface CreateMissionPlanningApprovalHandoffInput {
  createdBy?: string | null;
}

export interface MissionPlanningApprovalHandoff {
  review: MissionPlanningReview;
  snapshot: AuditEvidenceSnapshot;
  approvalEvidenceLink: MissionDecisionEvidenceLink;
  smsControlMappings: AuditReportSmsControlMapping[];
}

export interface MissionPlanningApprovalHandoffTrace {
  id: string;
  missionId: string;
  auditEvidenceSnapshotId: string;
  missionDecisionEvidenceLinkId: string;
  planningReview: MissionPlanningReview;
  createdBy: string | null;
  createdAt: string;
}

export interface MissionPlanningWorkspacePlatformStatus {
  assignedPlatformId: string | null;
  state: "assigned" | "missing" | "not_found";
  summary: Platform | null;
}

export interface MissionPlanningWorkspacePilotStatus {
  assignedPilotId: string | null;
  state: "assigned" | "missing" | "not_found";
  summary: Pilot | null;
}

export interface MissionPlanningWorkspaceEvidenceStatus {
  readinessSnapshotCount: number;
  latestReadinessSnapshot: AuditEvidenceSnapshot | null;
  approvalEvidenceLinkCount: number;
  latestApprovalEvidenceLink: MissionDecisionEvidenceLink | null;
  dispatchEvidenceLinkCount: number;
  latestDispatchEvidenceLink: MissionDecisionEvidenceLink | null;
}

export interface MissionPlanningWorkspaceApprovalStatus {
  ready: boolean;
  handoffCreated: boolean;
  latestApprovalHandoff: MissionPlanningApprovalHandoffTrace | null;
  blockingReasons: string[];
}

export interface MissionPlanningWorkspaceDispatchStatus {
  ready: boolean;
  blockingReasons: string[];
}

export interface MissionPlanningWorkspaceNextAction {
  action: MissionLifecycleAction;
  currentStatus: string;
  targetStatus: string;
  allowed: boolean;
  error: {
    type: string;
    message: string;
  } | null;
}

export interface MissionPlanningWorkspace {
  mission: {
    id: string;
    missionPlanId: string | null;
    status: string;
    platformId: string | null;
    pilotId: string | null;
    lastEventSequenceNo: number;
  };
  planning: {
    status: string;
    missionPlanId: string | null;
    platformId: string | null;
    pilotId: string | null;
    placeholders: MissionPlanningDraft["placeholders"];
    checklist: MissionPlanningChecklistItem[];
    readyForApproval: boolean;
    blockingReasons: string[];
  };
  platform: MissionPlanningWorkspacePlatformStatus;
  pilot: MissionPlanningWorkspacePilotStatus;
  missionRisk: MissionRiskAssessment | null;
  airspaceCompliance: AirspaceComplianceAssessment | null;
  readiness: MissionReadinessCheck;
  evidence: MissionPlanningWorkspaceEvidenceStatus;
  approval: MissionPlanningWorkspaceApprovalStatus;
  dispatch: MissionPlanningWorkspaceDispatchStatus;
  missingRequirements: string[];
  blockingReasons: string[];
  nextAllowedActions: MissionPlanningWorkspaceNextAction[];
}
