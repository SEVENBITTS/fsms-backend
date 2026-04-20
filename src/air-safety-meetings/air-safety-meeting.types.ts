export type AirSafetyMeetingType =
  | "quarterly_air_safety_review"
  | "event_triggered_safety_review"
  | "sop_breach_review"
  | "training_review"
  | "maintenance_safety_review"
  | "accountable_manager_review";

export type AirSafetyMeetingStatus =
  | "scheduled"
  | "completed"
  | "cancelled";

export type QuarterlyComplianceStatus =
  | "compliant"
  | "due_soon"
  | "overdue";

export type AirSafetyMeetingSignoffDecision =
  | "approved"
  | "rejected"
  | "requires_follow_up";

export interface CreateAirSafetyMeetingInput {
  meetingType?: AirSafetyMeetingType;
  scheduledPeriodStart?: string | null;
  scheduledPeriodEnd?: string | null;
  dueAt?: string;
  heldAt?: string | null;
  status?: AirSafetyMeetingStatus;
  chairperson?: string | null;
  attendees?: string[];
  agenda?: string[];
  minutes?: string | null;
  createdBy?: string | null;
}

export interface CreateAirSafetyMeetingSignoffInput {
  accountableManagerName?: string;
  accountableManagerRole?: string;
  reviewDecision?: AirSafetyMeetingSignoffDecision;
  signedAt?: string;
  signatureReference?: string | null;
  reviewNotes?: string | null;
  createdBy?: string | null;
}

export interface AirSafetyMeeting {
  id: string;
  meetingType: AirSafetyMeetingType;
  scheduledPeriodStart: string | null;
  scheduledPeriodEnd: string | null;
  dueAt: string;
  heldAt: string | null;
  status: AirSafetyMeetingStatus;
  chairperson: string | null;
  attendees: string[];
  agenda: string[];
  minutes: string | null;
  createdBy: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface AirSafetyMeetingSignoff {
  id: string;
  airSafetyMeetingId: string;
  accountableManagerName: string;
  accountableManagerRole: string;
  reviewDecision: AirSafetyMeetingSignoffDecision;
  signedAt: string;
  signatureReference: string | null;
  reviewNotes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface QuarterlyAirSafetyMeetingCompliance {
  status: QuarterlyComplianceStatus;
  requirement: "quarterly_air_safety_meeting";
  requirementMonths: 3;
  dueSoonWindowDays: 30;
  asOf: string;
  lastCompletedMeeting: AirSafetyMeeting | null;
  nextDueAt: string | null;
  message: string;
}

export interface AirSafetyMeetingPackExportAgendaLink {
  id: string;
  safetyEventId: string;
  safetyEventMeetingTriggerId: string;
  airSafetyMeetingId: string;
  agendaItem: string;
  linkedBy: string | null;
  linkedAt: string;
  createdAt: string;
}

export interface AirSafetyMeetingPackExportSafetyEvent {
  id: string;
  eventType: string;
  severity: string;
  status: string;
  missionId: string | null;
  platformId: string | null;
  pilotId: string | null;
  postOperationEvidenceSnapshotId: string | null;
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

export interface AirSafetyMeetingPackExportMeetingTrigger {
  id: string;
  safetyEventId: string;
  meetingRequired: boolean;
  recommendedMeetingType: string | null;
  triggerReasons: string[];
  reviewFlags: Record<string, boolean>;
  assessedBy: string | null;
  assessedAt: string;
  createdAt: string;
}

export interface AirSafetyMeetingPackExportActionDecision {
  id: string;
  decision: string;
  decidedBy: string | null;
  decisionNotes: string | null;
  decidedAt: string;
  createdAt: string;
}

export interface AirSafetyMeetingPackExportImplementationEvidence {
  id: string;
  evidenceCategory: string;
  implementationSummary: string;
  evidenceReference: string | null;
  completedBy: string | null;
  completedAt: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

export interface AirSafetyMeetingPackExportActionProposal {
  id: string;
  proposalType: string;
  status: string;
  summary: string;
  rationale: string | null;
  proposedOwner: string | null;
  proposedDueAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  decisions: AirSafetyMeetingPackExportActionDecision[];
  implementationEvidence: AirSafetyMeetingPackExportImplementationEvidence[];
}

export interface AirSafetyMeetingPackExportAgendaItem {
  link: AirSafetyMeetingPackExportAgendaLink;
  safetyEvent: AirSafetyMeetingPackExportSafetyEvent;
  meetingTrigger: AirSafetyMeetingPackExportMeetingTrigger;
  actionProposals: AirSafetyMeetingPackExportActionProposal[];
}

export interface AirSafetyMeetingPackSignoffApprovalContext {
  status:
    | "unsigned"
    | AirSafetyMeetingSignoffDecision;
  latestSignoff: AirSafetyMeetingSignoff | null;
}

export interface AirSafetyMeetingPackExport {
  exportType: "air_safety_meeting_pack";
  formatVersion: 1;
  generatedAt: string;
  meetingId: string;
  meeting: AirSafetyMeeting;
  signoffApproval: AirSafetyMeetingPackSignoffApprovalContext;
  agendaItems: AirSafetyMeetingPackExportAgendaItem[];
}

export interface AirSafetyMeetingApprovalRollupRecord {
  meetingId: string;
  meetingType: AirSafetyMeetingType;
  meetingStatus: AirSafetyMeetingStatus;
  dueAt: string;
  heldAt: string | null;
  chairperson: string | null;
  createdAt: string;
  latestSignoffApprovalStatus: "unsigned" | AirSafetyMeetingSignoffDecision;
  latestSignoffId: string | null;
  accountableManagerName: string | null;
  accountableManagerRole: string | null;
  signedAt: string | null;
  signatureReference: string | null;
  reviewNotes: string | null;
}

export interface AirSafetyMeetingApprovalRollupExport {
  exportType: "air_safety_meeting_approval_rollup";
  formatVersion: 1;
  generatedAt: string;
  records: AirSafetyMeetingApprovalRollupRecord[];
}

export interface AirSafetyMeetingReportField {
  label: string;
  value: string | number | boolean | null;
}

export interface AirSafetyMeetingReportSection {
  heading: string;
  fields: AirSafetyMeetingReportField[];
}

export interface AirSafetyMeetingPackRenderedReport {
  renderType: "air_safety_meeting_pack_report";
  formatVersion: 1;
  generatedAt: string;
  sourceExport: AirSafetyMeetingPackExport;
  report: {
    title: string;
    sections: AirSafetyMeetingReportSection[];
    plainText: string;
  };
}

export interface AirSafetyMeetingPackPdf {
  fileName: string;
  contentType: "application/pdf";
  content: Buffer;
}
