import type { MissionReadinessCheck } from "../missions/mission-readiness.types";

export type AuditEvidenceType = "mission_readiness_gate";

export type PostOperationEvidenceType = "post_operation_completion";

export type MissionDecisionType = "approval" | "dispatch";

export type PostOperationAuditSignoffDecision =
  | "approved"
  | "rejected"
  | "requires_follow_up";

export interface CreateAuditEvidenceSnapshotInput {
  createdBy?: string | null;
}

export interface CreatePostOperationEvidenceSnapshotInput {
  createdBy?: string | null;
}

export interface CreatePostOperationAuditSignoffInput {
  accountableManagerName?: string;
  accountableManagerRole?: string;
  reviewDecision?: PostOperationAuditSignoffDecision;
  signedAt?: string;
  signatureReference?: string | null;
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

export interface MissionLifecycleEvidenceEvent {
  id: number;
  sequence: number;
  type: string;
  time: string;
  recordedAt: string;
  actorType: string;
  actorId: string | null;
  fromState: string | null;
  toState: string | null;
  summary: string;
  details: Record<string, unknown>;
}

export interface PlanningApprovalHandoffEvidence {
  id: string;
  missionId: string;
  auditEvidenceSnapshotId: string;
  missionDecisionEvidenceLinkId: string;
  planningReview: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface PostOperationCompletionSnapshot {
  missionId: string;
  missionPlanId: string | null;
  status: string;
  capturedAt: string;
  approvalEvent: MissionLifecycleEvidenceEvent | null;
  launchEvent: MissionLifecycleEvidenceEvent | null;
  completionEvent: MissionLifecycleEvidenceEvent | null;
  approvalEvidenceLink: MissionDecisionEvidenceLink | null;
  dispatchEvidenceLink: MissionDecisionEvidenceLink | null;
  planningApprovalHandoff: PlanningApprovalHandoffEvidence | null;
}

export interface PostOperationEvidenceSnapshot {
  id: string;
  missionId: string;
  evidenceType: PostOperationEvidenceType;
  lifecycleState: string;
  completionSnapshot: PostOperationCompletionSnapshot;
  createdBy: string | null;
  createdAt: string;
}

export interface PostOperationAuditSignoff {
  id: string;
  missionId: string;
  postOperationEvidenceSnapshotId: string;
  accountableManagerName: string;
  accountableManagerRole: string;
  reviewDecision: PostOperationAuditSignoffDecision;
  signedAt: string;
  signatureReference: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PostOperationEvidenceExportPackage {
  exportType: "post_operation_completion_evidence";
  formatVersion: 1;
  generatedAt: string;
  missionId: string;
  snapshotId: string;
  evidenceType: PostOperationEvidenceType;
  lifecycleState: string;
  createdBy: string | null;
  createdAt: string;
  completionSnapshot: PostOperationCompletionSnapshot;
}

export interface AuditReportField {
  label: string;
  value: string | number | boolean | null;
}

export interface AuditReportSection {
  heading: string;
  fields: AuditReportField[];
}

export interface AuditReportSmsControlMapping {
  code: string;
  title: string;
  controlArea: string;
  smsElements: string[];
}

export interface PostOperationEvidenceRenderedReport {
  renderType: "post_operation_completion_evidence_report";
  formatVersion: 1;
  generatedAt: string;
  sourceExport: PostOperationEvidenceExportPackage;
  report: {
    title: string;
    sections: AuditReportSection[];
    plainText: string;
  };
}

export interface PostOperationEvidencePdf {
  fileName: string;
  contentType: "application/pdf";
  content: Buffer;
}
