import type { MissionReadinessCheck } from "../missions/mission-readiness.types";

export type AuditEvidenceType = "mission_readiness_gate";

export type MissionDecisionType = "approval" | "dispatch";

export interface CreateAuditEvidenceSnapshotInput {
  createdBy?: string | null;
}

export interface CreateMissionDecisionEvidenceLinkInput {
  snapshotId?: string;
  decisionType?: MissionDecisionType;
  createdBy?: string | null;
}

export interface AuditEvidenceSnapshot {
  id: string;
  missionId: string;
  evidenceType: AuditEvidenceType;
  readinessResult: MissionReadinessCheck["result"];
  gateResult: MissionReadinessCheck["gate"]["result"];
  blocksApproval: boolean;
  blocksDispatch: boolean;
  requiresReview: boolean;
  readinessSnapshot: MissionReadinessCheck;
  createdBy: string | null;
  createdAt: string;
}

export interface MissionDecisionEvidenceLink {
  id: string;
  missionId: string;
  auditEvidenceSnapshotId: string;
  decisionType: MissionDecisionType;
  createdBy: string | null;
  createdAt: string;
}
