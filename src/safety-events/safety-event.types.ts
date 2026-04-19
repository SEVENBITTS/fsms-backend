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

export type SafetyEventMeetingType =
  | "event_triggered_safety_review"
  | "sop_breach_review"
  | "training_review"
  | "maintenance_safety_review"
  | "accountable_manager_review";

export interface AssessSafetyEventMeetingTriggerInput {
  assessedBy?: string | null;
}

export interface SafetyEventMeetingTriggerReviewFlags {
  sopReviewRequired: boolean;
  trainingRequired: boolean;
  maintenanceReviewRequired: boolean;
  accountableManagerReviewRequired: boolean;
  regulatorReportableReviewRequired: boolean;
}

export interface SafetyEventMeetingTrigger {
  id: string;
  safetyEventId: string;
  meetingRequired: boolean;
  recommendedMeetingType: SafetyEventMeetingType | null;
  triggerReasons: string[];
  reviewFlags: SafetyEventMeetingTriggerReviewFlags;
  assessedBy: string | null;
  assessedAt: string;
  createdAt: string;
}

export interface CreateSafetyEventAgendaLinkInput {
  airSafetyMeetingId?: string;
  agendaItem?: string;
  linkedBy?: string | null;
}

export interface SafetyEventAgendaLink {
  id: string;
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  agendaItem: string;
  linkedBy: string | null;
  linkedAt: string;
  createdAt: string;
}

export type SafetyActionProposalType =
  | "sop_change"
  | "training_action"
  | "maintenance_action"
  | "accountable_manager_review"
  | "general_safety_action";

export type SafetyActionProposalStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "completed";

export interface CreateSafetyActionProposalInput {
  proposalType?: SafetyActionProposalType;
  status?: SafetyActionProposalStatus;
  summary?: string;
  rationale?: string | null;
  proposedOwner?: string | null;
  proposedDueAt?: string | null;
  createdBy?: string | null;
}

export interface SafetyActionProposal {
  id: string;
  safetyEventAgendaLinkId: string;
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  proposalType: SafetyActionProposalType;
  status: SafetyActionProposalStatus;
  summary: string;
  rationale: string | null;
  proposedOwner: string | null;
  proposedDueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
