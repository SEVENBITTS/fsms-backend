import type { MissionReadinessCheck } from "../missions/mission-readiness.types";

export type AuditEvidenceType = "mission_readiness_gate";

export interface CreateAuditEvidenceSnapshotInput {
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
