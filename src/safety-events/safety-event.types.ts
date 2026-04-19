export type SafetyEventType =
  | "sop_breach"
  | "training_need"
  | "maintenance_concern"
  | "airspace_deviation"
  | "mission_planning_issue"
  | "platform_readiness_issue"
  | "pilot_readiness_issue"
  | "operational_incident"
  | "near_miss"
  | "post_operation_finding";

export type SafetyEventSeverity = "low" | "medium" | "high" | "critical";

export type SafetyEventStatus = "open" | "under_review" | "closed";

export interface CreateSafetyEventInput {
  eventType?: SafetyEventType;
  severity?: SafetyEventSeverity;
  status?: SafetyEventStatus;
  missionId?: string | null;
  platformId?: string | null;
  pilotId?: string | null;
  postOperationEvidenceSnapshotId?: string | null;
  airSafetyMeetingId?: string | null;
  reportedBy?: string | null;
  eventOccurredAt?: string;
  summary?: string;
  description?: string | null;
  immediateActionTaken?: string | null;
  sopReference?: string | null;
  meetingRequired?: boolean;
  sopReviewRequired?: boolean;
  trainingRequired?: boolean;
  maintenanceReviewRequired?: boolean;
  accountableManagerReviewRequired?: boolean;
  regulatorReportableReviewRequired?: boolean;
}

export interface SafetyEvent {
  id: string;
  eventType: SafetyEventType;
  severity: SafetyEventSeverity;
  status: SafetyEventStatus;
  missionId: string | null;
  platformId: string | null;
  pilotId: string | null;
  postOperationEvidenceSnapshotId: string | null;
  airSafetyMeetingId: string | null;
  reportedBy: string | null;
  eventOccurredAt: string;
  reportedAt: string;
  summary: string;
  description: string | null;
  immediateActionTaken: string | null;
  sopReference: string | null;
  meetingRequired: boolean;
  sopReviewRequired: boolean;
  trainingRequired: boolean;
  maintenanceReviewRequired: boolean;
  accountableManagerReviewRequired: boolean;
  regulatorReportableReviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
